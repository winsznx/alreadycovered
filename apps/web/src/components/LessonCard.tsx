import { useState } from "react";
import type { PacketBlockView } from "../lib/types";
import { minutesToLabel } from "../lib/format";
import { StatusTag } from "./StatusTag";
import { Button } from "./Button";

const LINK_STATUS_TONE: Record<string, { label: string; tone: "verified" | "review" | "blocking" }> = {
  confirmed: { label: "Confirmed", tone: "verified" },
  proposed: { label: "Proposed match", tone: "review" },
  ambiguous: { label: "Ambiguous", tone: "blocking" },
  missing: { label: "Missing material", tone: "blocking" },
  rejected: { label: "Rejected", tone: "blocking" },
};

export function LessonCard({
  block,
  selected,
  onSelect,
  onSaveEdit,
}: {
  block: PacketBlockView;
  selected: boolean;
  onSelect: () => void;
  onSaveEdit: (summary: string, steps: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftSummary, setDraftSummary] = useState(block.instruction?.summary ?? "");
  const [draftSteps, setDraftSteps] = useState((block.instruction?.steps ?? []).join("\n"));

  const linkStatus = block.materialLink ? LINK_STATUS_TONE[block.materialLink.status] : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-panel border px-4 py-3 text-left transition-colors ${
        selected ? "border-ink bg-surface-muted" : "border-border bg-surface hover:bg-surface-muted"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {minutesToLabel(block.startMinute)}&ndash;{minutesToLabel(block.endMinute)} &middot; {block.subject}
        </span>
        {linkStatus && <StatusTag label={linkStatus.label} tone={linkStatus.tone} />}
      </div>

      {block.needsGeneration && <p className="mt-1 text-xs text-ink-muted">Generating substitute instructions&hellip;</p>}

      {block.instruction && !editing && (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-medium text-ink">{block.instruction.lessonTitle}</p>
          <p className="text-sm text-ink-secondary">{block.instruction.summary}</p>
          {block.instruction.unsupportedQuestions.length > 0 && (
            <p className="text-xs text-review">{block.instruction.unsupportedQuestions.length} question(s) need teacher input</p>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="inline-block text-xs font-medium text-ink-secondary underline"
          >
            Edit
          </span>
        </div>
      )}

      {editing && (
        <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            className="w-full rounded-control border border-border bg-surface p-2 text-sm"
            value={draftSummary}
            onChange={(e) => setDraftSummary(e.target.value)}
            rows={2}
            placeholder="Lesson objective"
          />
          <textarea
            className="w-full rounded-control border border-border bg-surface p-2 text-sm"
            value={draftSteps}
            onChange={(e) => setDraftSteps(e.target.value)}
            rows={4}
            placeholder="One step per line"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="text-xs"
              onClick={() => {
                onSaveEdit(draftSummary, draftSteps.split("\n").map((s) => s.trim()).filter(Boolean));
                setEditing(false);
              }}
            >
              Save teacher edit
            </Button>
            <Button variant="ghost" className="text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </button>
  );
}
