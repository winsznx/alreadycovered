import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { api, ApiError } from "../lib/api";
import { useActivityEvents } from "../lib/events";
import type { SourcesResponse } from "../lib/types";

const STATUS_TONE: Record<string, { label: string; tone: "verified" | "review" | "blocking" | "neutral" }> = {
  indexed: { label: "Indexed", tone: "verified" },
  pending: { label: "Pending", tone: "neutral" },
  unsupported: { label: "Unsupported", tone: "neutral" },
  unreadable: { label: "No readable text", tone: "review" },
  error: { label: "Error", tone: "blocking" },
  deleted: { label: "Removed", tone: "blocking" },
};

export function Sources() {
  const [sources, setSources] = useState<SourcesResponse["sources"]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const result = await api.listSources();
    setSources(result.sources);
  }

  useEffect(() => {
    void reload();
  }, []);

  useActivityEvents((event) => {
    if (event.type === "file.indexed" || event.type === "file.failed" || event.type === "source.deleted") {
      void reload();
    }
  });

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await api.uploadSources(Array.from(fileList));
      const failed = result.uploaded.filter((u) => !u.ok);
      if (failed.length > 0) {
        setUploadError(`${failed.length} file(s) could not be indexed: ${failed.map((f) => f.displayName).join(", ")}`);
      }
      await reload();
    } catch (error) {
      setUploadError(error instanceof ApiError ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sources</h1>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : "Upload files"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-panel border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? "border-ink bg-surface-muted" : "border-border bg-surface"
        }`}
      >
        <p className="text-sm font-medium text-ink">Drag lesson files here, or click "Upload files"</p>
        <p className="mt-1 text-xs text-ink-muted">PDF, DOCX, TXT, or MD. Files stay private to your account.</p>
      </div>

      {uploadError && <p className="text-sm text-blocking">{uploadError}</p>}

      <Panel>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="py-2">File</th>
              <th className="py-2">Status</th>
              <th className="py-2">Indexed</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const tone = STATUS_TONE[s.status] ?? { label: s.status, tone: "neutral" as const };
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2">
                    <a className="underline" href={`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1/sources/${s.id}/open`} target="_blank" rel="noreferrer">
                      {s.displayName}
                    </a>
                  </td>
                  <td className="py-2">
                    <StatusTag label={tone.label} tone={tone.tone} />
                  </td>
                  <td className="py-2 text-ink-muted">{s.indexedAt ? new Date(s.indexedAt).toLocaleString() : "—"}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-ink-muted underline"
                      onClick={async () => {
                        await api.deleteSource(s.id);
                        await reload();
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {sources.length === 0 && (
              <tr>
                <td className="py-4 text-ink-secondary" colSpan={4}>
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
