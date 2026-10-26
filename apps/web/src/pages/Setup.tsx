import { useState } from "react";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { api, ApiError } from "../lib/api";

type ScheduleRow = { weekday: number; startMinute: number; endMinute: number; subject: string };

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function Setup({ onComplete }: { onComplete: () => Promise<void> }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [label, setLabel] = useState("");
  const [grade, setGrade] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [rows, setRows] = useState<ScheduleRow[]>([{ weekday: 1, startMinute: 540, endMinute: 600, subject: "" }]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitSetup() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.createProfile({
        label,
        grade,
        timezone,
        locale: "en-US",
        schedule: rows.filter((r) => r.subject.trim().length > 0),
      });
      await onComplete();
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Setup could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Set up your class</h1>
        <p className="mt-2 text-sm text-ink-secondary">You'll upload your lesson files on the next screen - just your class and weekly schedule for now.</p>
      </div>

      {step === 1 && (
        <Panel title="1. Your class">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink">Class label</label>
              <input className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Grade 4A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Grade</label>
              <input className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="4" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-ink">Timezone</label>
            <input className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="mt-4">
            <Button onClick={() => setStep(2)} disabled={!label || !grade}>
              Continue
            </Button>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="2. Weekly schedule">
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr,1fr,1fr,2fr,auto] items-center gap-2">
                <select
                  className="rounded-control border border-border bg-surface px-2 py-1.5 text-sm"
                  value={row.weekday}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, weekday: Number(e.target.value) } : r)))}
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  className="rounded-control border border-border bg-surface px-2 py-1.5 text-sm"
                  value={`${String(Math.floor(row.startMinute / 60)).padStart(2, "0")}:${String(row.startMinute % 60).padStart(2, "0")}`}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, startMinute: timeToMinutes(e.target.value) } : r)))}
                />
                <input
                  type="time"
                  className="rounded-control border border-border bg-surface px-2 py-1.5 text-sm"
                  value={`${String(Math.floor(row.endMinute / 60)).padStart(2, "0")}:${String(row.endMinute % 60).padStart(2, "0")}`}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, endMinute: timeToMinutes(e.target.value) } : r)))}
                />
                <input
                  className="rounded-control border border-border bg-surface px-2 py-1.5 text-sm"
                  placeholder="Subject"
                  value={row.subject}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, subject: e.target.value } : r)))}
                />
                <button type="button" className="text-xs text-ink-muted" onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-ink-secondary underline"
            onClick={() => setRows((rs) => [...rs, { weekday: 1, startMinute: 540, endMinute: 600, subject: "" }])}
          >
            + Add block
          </button>
          {submitError && <p className="mt-2 text-sm text-blocking">{submitError}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={submitSetup} disabled={submitting}>
              {submitting ? "Saving…" : "Continue to upload files"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
