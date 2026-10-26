import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { api } from "../lib/api";
import { minutesToLabel, packetStateLabel, packetStateTone } from "../lib/format";
import type { PacketView } from "../lib/types";
import { useActivityEvents } from "../lib/events";

function todayIso(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export function Dashboard({ timezone }: { timezone: string }) {
  const [date, setDate] = useState(() => todayIso(timezone));
  const [packet, setPacket] = useState<PacketView | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function loadForDate(targetDate: string) {
    setLoading(true);
    try {
      const result = await api.createPacket(targetDate);
      setPacket(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadForDate(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useActivityEvents((event) => {
    if (event.type === "packet.updated" || event.type === "lesson.generated") {
      void loadForDate(date);
    }
  });

  const linkedCount = packet?.blocks.filter((b) => b.materialLink?.sourceFileId).length ?? 0;
  const issueCount = packet?.issues.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Substitute preparation</h1>
          {packet && (
            <p className="mt-1 text-sm text-ink-secondary">
              {date} &middot; {packet.blocks.length} lesson(s) &middot; {linkedCount} material(s) linked &middot; {issueCount} need
              {issueCount === 1 ? "s" : ""} review
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-control border border-border bg-surface px-3 py-2 text-sm" />
          {packet && <StatusTag label={packetStateLabel(packet.state)} tone={packetStateTone(packet.state)} />}
        </div>
      </div>

      {loading && !packet && <p className="text-sm text-ink-secondary">Preparing…</p>}

      {packet && (
        <Panel title="Schedule">
          <ul className="space-y-2">
            {packet.blocks.map((b) => (
              <li key={b.timetableBlockId} className="flex items-center justify-between rounded-control border border-border px-3 py-2">
                <span className="text-sm">
                  {minutesToLabel(b.startMinute)}&ndash;{minutesToLabel(b.endMinute)} &middot; {b.subject}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-secondary">
                  {b.materialLink?.sourceFileName ?? "No material linked"}
                  {b.needsGeneration && <span className="text-review">generating…</span>}
                </span>
              </li>
            ))}
            {packet.blocks.length === 0 && <p className="text-sm text-ink-secondary">No school scheduled for this date.</p>}
          </ul>
          {packet.blocks.length > 0 && (
            <div className="mt-4">
              <Button onClick={() => navigate(`/packets/${packet.packetId}`)}>Review packet</Button>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
