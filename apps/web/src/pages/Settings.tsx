import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { api } from "../lib/api";
import type { ModelHealth } from "@alreadycovered/shared";
import type { RoutineView } from "../lib/types";

const ROUTINE_CATEGORIES = ["arrival", "transitions", "materials", "dismissal", "other"] as const;

export function Settings({ profileId }: { profileId: string }) {
  const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
  const [testing, setTesting] = useState(false);
  const [routines, setRoutines] = useState<RoutineView[]>([]);

  async function loadRoutines() {
    const result = await api.getRoutines(profileId);
    setRoutines(result.routines);
  }

  useEffect(() => {
    void api.settings().then((s) => setModelHealth(s.modelHealth));
    void loadRoutines();
  }, [profileId]);

  async function saveRoutines(next: RoutineView[]) {
    setRoutines(next);
    await api.putRoutines(
      profileId,
      next.map((r) => ({
        category: r.category,
        title: r.title,
        text: r.text,
        verified: !!r.teacherVerifiedAt,
        includeInPacket: r.includeInPacket,
      })),
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Panel
        title="Local model"
        action={
          <Button
            variant="secondary"
            className="text-xs"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              setModelHealth(await api.testModel());
              setTesting(false);
            }}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
        }
      >
        {modelHealth && (
          <div className="space-y-1 text-sm">
            <p>
              Configured model: <strong>{modelHealth.configuredModel}</strong>
            </p>
            <StatusTag
              label={modelHealth.reachable ? (modelHealth.installedTag ? "Ready" : "Model not pulled") : "Unavailable"}
              tone={modelHealth.reachable && modelHealth.installedTag ? "verified" : "blocking"}
            />
            {modelHealth.error && <p className="text-ink-secondary">{modelHealth.error}</p>}
            {!modelHealth.reachable && (
              <p className="text-ink-secondary">
                The AI model isn&rsquo;t reachable right now. Existing drafts are still visible, but new instructions
                can&rsquo;t be generated until it&rsquo;s back - try again in a moment, or come back later.
              </p>
            )}
            {modelHealth.reachable && !modelHealth.installedTag && (
              <p className="text-ink-secondary">
                The configured model isn&rsquo;t installed on the server yet. This is expected to be resolved shortly -
                try again in a moment.
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Classroom routines"
        action={
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => saveRoutines([...routines, { id: `new-${Date.now()}`, profileId, category: "other", title: "", text: "", teacherVerifiedAt: null, includeInPacket: true }])}
          >
            + Add routine
          </Button>
        }
      >
        <div className="space-y-3">
          {routines.map((routine, idx) => (
            <div key={routine.id} className="rounded-control border border-border p-3">
              <div className="flex gap-2">
                <select
                  className="rounded-control border border-border bg-surface px-2 py-1 text-sm"
                  value={routine.category}
                  onChange={(e) => {
                    const next = [...routines];
                    next[idx] = { ...routine, category: e.target.value };
                    setRoutines(next);
                  }}
                >
                  {ROUTINE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  className="flex-1 rounded-control border border-border bg-surface px-2 py-1 text-sm"
                  placeholder="Title"
                  value={routine.title}
                  onChange={(e) => {
                    const next = [...routines];
                    next[idx] = { ...routine, title: e.target.value };
                    setRoutines(next);
                  }}
                />
              </div>
              <textarea
                className="mt-2 w-full rounded-control border border-border bg-surface px-2 py-1 text-sm"
                rows={2}
                placeholder="Describe this routine for a substitute teacher"
                value={routine.text}
                onChange={(e) => {
                  const next = [...routines];
                  next[idx] = { ...routine, text: e.target.value };
                  setRoutines(next);
                }}
              />
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!routine.teacherVerifiedAt}
                  onChange={(e) => {
                    const next = [...routines];
                    next[idx] = { ...routine, teacherVerifiedAt: e.target.checked ? new Date().toISOString() : null };
                    setRoutines(next);
                  }}
                />
                Verified by me
              </label>
              <div className="mt-2">
                <Button variant="primary" className="text-xs" onClick={() => saveRoutines(routines)}>
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
