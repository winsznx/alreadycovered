import type { CandidateSource, SourceChunk, SourceFile } from "@alreadycovered/shared";

export type RetrievalInput = {
  subject: string;
  sources: SourceFile[];
  chunksByFileId: Map<string, SourceChunk[]>;
  pinnedFileId?: string | null;
  maxCandidates?: number;
};

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "to", "in", "on", "for", "with"]);

/**
 * Common classroom-subject synonyms. Real lesson files rarely spell out the
 * literal subject name ("Mathematics") - a fractions worksheet says
 * "fractions," "numerator," "worksheet," not "mathematics." This closes that
 * exact gap (documented in internal/VALIDATION.md from the first build pass)
 * without needing a vector index: a small, honest, editable keyword map.
 */
const SUBJECT_SYNONYMS: Record<string, string[]> = {
  math: ["math", "maths", "mathematics", "arithmetic", "fraction", "fractions", "number", "numbers", "geometry", "algebra", "equation", "addition", "subtraction", "multiplication", "division", "worksheet"],
  mathematics: ["math", "maths", "mathematics", "arithmetic", "fraction", "fractions", "number", "numbers", "geometry", "algebra", "equation", "addition", "subtraction", "multiplication", "division", "worksheet"],
  reading: ["reading", "literacy", "book", "chapter", "story", "comprehension", "novel", "vocabulary", "passage"],
  "english language arts": ["reading", "writing", "literacy", "vocabulary", "grammar", "essay", "comprehension"],
  ela: ["reading", "writing", "literacy", "vocabulary", "grammar", "essay", "comprehension"],
  writing: ["writing", "essay", "paragraph", "draft", "composition", "narrative"],
  science: ["science", "experiment", "lab", "hypothesis", "observation", "biology", "chemistry", "physics", "ecosystem"],
  "social studies": ["history", "geography", "civics", "community", "culture", "map", "government"],
  history: ["history", "historical", "timeline", "era", "civilization"],
  art: ["art", "drawing", "painting", "craft", "sketch", "color", "colour"],
  music: ["music", "song", "rhythm", "instrument", "note", "melody"],
  pe: ["pe", "physical education", "gym", "fitness", "exercise", "sport"],
  "physical education": ["pe", "gym", "fitness", "exercise", "sport"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function expandSubjectTokens(subject: string): string[] {
  const base = tokenize(subject);
  const normalized = subject.toLowerCase().trim();
  const synonyms = SUBJECT_SYNONYMS[normalized] ?? [];
  for (const [key, words] of Object.entries(SUBJECT_SYNONYMS)) {
    if (base.includes(key) || key.includes(normalized)) {
      synonyms.push(...words);
    }
  }
  return [...new Set([...base, ...synonyms])];
}

function scoreText(subjectTokens: string[], text: string, weight: number): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const token of subjectTokens) {
    if (haystack.includes(token)) score += weight;
  }
  return score;
}

/**
 * Deterministic candidate shortlist. When a teacher has pinned a specific
 * file, its chunks are offered directly. Otherwise, filename matches are
 * weighted higher than body-text matches (a filename is a stronger, more
 * deliberate signal than an incidental word), and subject synonyms widen
 * recall beyond the literal subject string. Still no vector database - just
 * a slightly less naive keyword heuristic.
 */
export function shortlistCandidates(input: RetrievalInput): { candidates: CandidateSource[]; ambiguousFileIds: string[] } {
  const maxCandidates = input.maxCandidates ?? 6;
  const subjectTokens = expandSubjectTokens(input.subject);

  if (input.pinnedFileId) {
    const file = input.sources.find((s) => s.id === input.pinnedFileId);
    const chunks = input.chunksByFileId.get(input.pinnedFileId) ?? [];
    if (file) {
      return {
        candidates: chunks.slice(0, maxCandidates).map((chunk) => toCandidate(file, chunk)),
        ambiguousFileIds: [],
      };
    }
  }

  // Rank by FILE, not by individual chunk: a material link tracks exactly
  // one sourceFileId, so the candidate chunks it offers must all come from
  // that same file. Scoring chunks globally and taking the top N regardless
  // of file (the original implementation) could return a mix of chunks from
  // several files while only recording one as the "linked" file - the
  // unlinked chunks' ids would then silently drop out of every downstream
  // lookup that fetches chunks by that one file, producing a different
  // fingerprint than the one computed at link-creation time and causing a
  // "generated" instruction to never be found again. Found by direct
  // production debugging - see internal/VALIDATION.md.
  type FileScore = { file: SourceFile; score: number; chunks: SourceChunk[] };
  const byFile: FileScore[] = [];
  for (const file of input.sources) {
    if (file.status !== "indexed") continue;
    const filenameScore = scoreText(subjectTokens, file.displayName, 3);
    const fileChunks = input.chunksByFileId.get(file.id) ?? [];
    let fileScore = filenameScore;
    const scoredChunks: Array<{ chunk: SourceChunk; score: number }> = [];
    for (const chunk of fileChunks) {
      const bodyScore = scoreText(subjectTokens, `${chunk.heading ?? ""} ${chunk.text}`, 1);
      if (bodyScore > 0) {
        fileScore += bodyScore;
        scoredChunks.push({ chunk, score: bodyScore });
      }
    }
    if (fileScore > 0) {
      scoredChunks.sort((a, b) => b.score - a.score);
      // The file can win purely on a filename match with no individual chunk
      // scoring a hit (e.g. "science-lab-notes.md" for subject "Science"
      // when the chunk text itself never repeats the word) - fall back to
      // offering its chunks in document order rather than an empty list.
      const rankedChunks = scoredChunks.length > 0 ? scoredChunks.map((s) => s.chunk) : fileChunks;
      byFile.push({ file, score: fileScore, chunks: rankedChunks });
    }
  }

  byFile.sort((a, b) => b.score - a.score);
  const bestScore = byFile[0]?.score ?? 0;
  const ambiguousFileIds = bestScore > 0 ? byFile.filter((f) => f.score === bestScore).map((f) => f.file.id) : [];

  const bestFile = byFile[0];
  return {
    candidates: bestFile ? bestFile.chunks.slice(0, maxCandidates).map((chunk) => toCandidate(bestFile.file, chunk)) : [],
    ambiguousFileIds: ambiguousFileIds.length > 1 ? ambiguousFileIds : [],
  };
}

function toCandidate(file: SourceFile, chunk: SourceChunk): CandidateSource {
  return {
    id: chunk.id,
    fileId: file.id,
    heading: chunk.heading,
    page: chunk.pageStart,
    excerpt: chunk.text,
  };
}
