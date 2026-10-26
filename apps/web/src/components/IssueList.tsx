import type { IssueView } from "../lib/types";
import { StatusTag } from "./StatusTag";

export function IssueList({ issues }: { issues: IssueView[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-ink-secondary">No open issues - everything referenced here is verified.</p>;
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <li key={issue.id} className="flex items-start gap-2 rounded-control border border-border bg-surface-muted px-3 py-2 text-sm">
          <StatusTag label={issue.severity === "blocking" ? "Blocking" : "Needs review"} tone={issue.severity === "blocking" ? "blocking" : "review"} />
          <span className="text-ink-secondary">{issue.humanMessage}</span>
        </li>
      ))}
    </ul>
  );
}
