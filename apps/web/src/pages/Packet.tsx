import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { IssueList } from "../components/IssueList";
import { LessonCard } from "../components/LessonCard";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { api, ApiError } from "../lib/api";
import { packetStateLabel, packetStateTone } from "../lib/format";
import { useActivityEvents } from "../lib/events";
import type { PacketView } from "../lib/types";

export function Packet() {
  const { packetId } = useParams<{ packetId: string }>();
  const [packet, setPacket] = useState<PacketView | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{ id: string; exportedWithWarnings: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!packetId) return;
    const result = await api.getPacket(packetId);
    setPacket(result);
    if (!selectedBlock && result.blocks[0]) setSelectedBlock(result.blocks[0].timetableBlockId);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packetId]);

  useActivityEvents((event) => {
    if (event.packetId === packetId && (event.type === "packet.updated" || event.type === "lesson.generated")) {
      void reload();
    }
  });

  // Fallback poll while generation is in flight: SSE is not the database -
  // an event published in the brief window between navigating here and the
  // EventSource connecting can be missed, so self-heal rather than leave the
  // UI stuck showing "generating..." forever.
  useEffect(() => {
    if (!packet?.blocks.some((b) => b.needsGeneration)) return;
    const interval = setInterval(() => void reload(), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packet?.blocks.some((b) => b.needsGeneration)]);

  if (!packet) return <p className="text-sm text-ink-secondary">Loading packet…</p>;

  const selected = packet.blocks.find((b) => b.timetableBlockId === selectedBlock) ?? packet.blocks[0];

  async function handleSaveEdit(summary: string, steps: string[]) {
    setActionError(null);
    try {
      const updated = await api.patchBlock(packet!.packetId, selected!.timetableBlockId, {
        expectedRevision: packet!.revision,
        summary,
        steps,
      });
      setPacket(updated);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Could not save your edit.");
    }
  }

  async function handleReview() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await api.reviewPacket(packet!.packetId, {
        expectedRevision: packet!.revision,
        sourceFingerprint: packet!.sourceFingerprint,
        confirmTeacherReview: true,
      });
      setPacket(updated);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Could not mark this packet reviewed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(withWarnings: boolean) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.exportPacket(packet!.packetId, withWarnings);
      setExportResult(result.export);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  const canReview = packet.issues.length === 0 && packet.state !== "reviewed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{packet.localDate}</h1>
        <StatusTag label={packetStateLabel(packet.state)} tone={packetStateTone(packet.state)} />
      </div>

      <div className="grid grid-cols-[1fr,1.4fr] gap-6">
        <div className="space-y-2">
          {packet.blocks.map((b) => (
            <LessonCard key={b.timetableBlockId} block={b} selected={b.timetableBlockId === selected?.timetableBlockId} onSelect={() => setSelectedBlock(b.timetableBlockId)} onSaveEdit={handleSaveEdit} />
          ))}
        </div>

        <div className="space-y-4">
          <Panel title="Needs teacher attention">
            <IssueList issues={packet.issues} />
          </Panel>

          {selected?.materialLink?.sourceFileId && (
            <Panel title="Material permission">
              <p className="text-sm text-ink-secondary">
                {selected.materialLink.sourceFileName} &middot; {selected.materialLink.exportPermission}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  className="text-xs"
                  onClick={async () => {
                    const updated = await api.patchBlock(packet.packetId, selected.timetableBlockId, {
                      expectedRevision: packet.revision,
                      exportPermission: "approved",
                    });
                    setPacket(updated);
                  }}
                >
                  Include in handover
                </Button>
                <Button
                  variant="ghost"
                  className="text-xs"
                  onClick={async () => {
                    const updated = await api.patchBlock(packet.packetId, selected.timetableBlockId, {
                      expectedRevision: packet.revision,
                      exportPermission: "excluded",
                    });
                    setPacket(updated);
                  }}
                >
                  Exclude from handover
                </Button>
              </div>
            </Panel>
          )}

          <Panel title="Review and export">
            {actionError && <p className="mb-2 text-sm text-blocking">{actionError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleReview} disabled={!canReview || busy}>
                Mark reviewed
              </Button>
              <Button variant="secondary" onClick={() => handleExport(false)} disabled={busy || packet.issues.length > 0}>
                Export PDF + resources
              </Button>
              {packet.issues.length > 0 && (
                <Button variant="danger" onClick={() => handleExport(true)} disabled={busy}>
                  Export with warnings
                </Button>
              )}
            </div>
            {exportResult && (
              <div className="mt-3 rounded-control border border-border bg-surface-muted p-3 text-sm">
                <p className="font-medium">Export ready. Nothing was sent to the school or another person - download and share it yourself.</p>
                <div className="mt-2 flex gap-3">
                  <a className="underline" href={api.downloadUrl(exportResult.id, "pdf")}>
                    Download PDF
                  </a>
                  <a className="underline" href={api.downloadUrl(exportResult.id, "zip")}>
                    Download ZIP
                  </a>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
