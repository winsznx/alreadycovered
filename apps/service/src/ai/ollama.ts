import { LessonDraftSchema, type LessonDraft, type ModelHealth } from "@alreadycovered/shared";
import { z } from "zod";

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export function loadOllamaConfig(): OllamaConfig {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    model: process.env.OLLAMA_MODEL ?? "gemma4:e4b",
    // CPU-only hosted inference is meaningfully slower than Apple Silicon /
    // GPU-accelerated local runs - a trivial one-word reply measured ~40s on
    // the deployment VPS (6 vCPU, no GPU). 180s gives real lesson-length
    // prompts room without masking genuine unavailability forever.
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000),
  };
}

const TagsResponseSchema = z.object({
  models: z.array(z.object({ name: z.string(), digest: z.string().optional() })),
});

const PLAIN_JSON_INSTRUCTION = `Respond with ONLY a single JSON object, no prose, no markdown fences, no schema wrapper.
It must look exactly like this example in shape (use your own values, not these words):
{"lessonTitle":"Example title","summary":"Example summary.","steps":["Example step one.","Example step two."],"citedChunkIds":["chunk_id_1"],"requiredMaterialIds":["file_id_1"],"unansweredQuestions":[]}`;

export class OllamaClient {
  constructor(private readonly config: OllamaConfig) {}

  async checkHealth(): Promise<ModelHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return {
          reachable: false,
          configuredModel: this.config.model,
          installedTag: null,
          digest: null,
          error: `Ollama responded with HTTP ${response.status}`,
          checkedAt,
        };
      }
      const body = TagsResponseSchema.parse(await response.json());
      const match = body.models.find((m) => m.name === this.config.model);
      return {
        reachable: true,
        configuredModel: this.config.model,
        installedTag: match?.name ?? null,
        digest: match?.digest ?? null,
        error: match ? null : `Model "${this.config.model}" is not pulled locally yet.`,
        checkedAt,
      };
    } catch (error) {
      return {
        reachable: false,
        configuredModel: this.config.model,
        installedTag: null,
        digest: null,
        error: error instanceof Error ? error.message : "Could not reach local Ollama.",
        checkedAt,
      };
    }
  }

  /**
   * Calls /api/chat with a schema-constrained response (PRD §8.4). Retries once
   * on a schema-validation failure before surfacing a review-worthy error, per
   * Journey D: "re-ask once with schema; if still invalid ... Needs review".
   */
  async generateLessonDraft(systemPrompt: string, userPrompt: string): Promise<
    { ok: true; draft: LessonDraft; rawModelTag: string } | { ok: false; errorCode: "MODEL_UNAVAILABLE" | "MODEL_TIMEOUT" | "MODEL_INVALID_RESPONSE"; message: string }
  > {
    // Some locally-installed model/runtime combinations (observed: gemma4:e2b on
    // Ollama 0.40.11) reject the schema-constrained `format` field with
    // HTTP 501 "structured output is unavailable". Rather than silently
    // substituting a different model or faking success, we detect that
    // specific failure once and fall back to prompt-instructed JSON - still
    // Zod-validated exactly like the constrained path (schema validity is
    // never trusted blindly either way; see core/generation.ts).
    let useNativeFormat = true;

    const attempt = async (): Promise<{ ok: true; draft: LessonDraft } | { ok: false; message: string }> => {
      let response: Response;
      try {
        response = await fetch(`${this.config.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(this.config.timeoutMs),
          body: JSON.stringify({
            model: this.config.model,
            stream: false,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: useNativeFormat ? userPrompt : `${userPrompt}\n\n${PLAIN_JSON_INSTRUCTION}`,
              },
            ],
            ...(useNativeFormat ? { format: zodToOllamaFormat() } : {}),
            // gemma4 is a thinking-capable model: left on its default, it
            // emits a full chain-of-thought block before the answer, which
            // on CPU-only hardware (the hosted deployment) measured well
            // over a minute per call even for a trivial prompt. We only need
            // the structured final answer, not the reasoning trace, so
            // thinking is disabled - a real, measured latency fix, not a
            // quality-neutral default (see internal/DECISIONS.md).
            think: false,
            // Capped below the schema's worst case (12 steps x 400 chars) to
            // bound generation time on CPU-only hardware without truncating
            // a realistic lesson draft.
            options: { temperature: 0.1, num_predict: 640 },
          }),
        });
      } catch (error) {
        throw Object.assign(new Error("timeout_or_network"), { cause: error });
      }

      if (response.status === 501 && useNativeFormat) {
        useNativeFormat = false;
        return attempt();
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw Object.assign(new Error(`ollama_http_${response.status}`), { body: text });
      }

      const payload = (await response.json()) as { message?: { content?: string } };
      const content = extractJsonObject(payload.message?.content ?? "");
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        return { ok: false, message: "Model response was not valid JSON." };
      }
      const result = LessonDraftSchema.safeParse(parsedJson);
      if (!result.success) {
        return { ok: false, message: `Model response failed schema validation: ${result.error.message}` };
      }
      return { ok: true, draft: result.data };
    };

    try {
      const first = await attempt();
      if (first.ok) return { ok: true, draft: first.draft, rawModelTag: this.config.model };

      const second = await attempt();
      if (second.ok) return { ok: true, draft: second.draft, rawModelTag: this.config.model };

      return { ok: false, errorCode: "MODEL_INVALID_RESPONSE", message: second.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown model error.";
      if (message.includes("timeout_or_network")) {
        return { ok: false, errorCode: "MODEL_UNAVAILABLE", message: "Could not reach the local model service." };
      }
      return { ok: false, errorCode: "MODEL_TIMEOUT", message };
    }
  }
}

/** Strips markdown code fences the model sometimes wraps JSON in despite instructions. */
function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  if (fenced?.[1]) return fenced[1];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return trimmed;
}

/**
 * Ollama's structured-output `format` field accepts a JSON Schema object
 * (see docs/capabilities/structured-outputs.mdx). We hand-write the schema to
 * avoid an extra dependency; it must stay in sync with LessonDraftSchema.
 */
function zodToOllamaFormat(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      lessonTitle: { type: "string" },
      summary: { type: "string" },
      steps: { type: "array", items: { type: "string" } },
      citedChunkIds: { type: "array", items: { type: "string" } },
      requiredMaterialIds: { type: "array", items: { type: "string" } },
      unansweredQuestions: { type: "array", items: { type: "string" } },
    },
    required: ["lessonTitle", "summary", "steps", "citedChunkIds", "requiredMaterialIds", "unansweredQuestions"],
    additionalProperties: false,
  };
}
