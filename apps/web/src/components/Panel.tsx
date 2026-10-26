import type { PropsWithChildren, ReactNode } from "react";

export function Panel({ title, action, children }: PropsWithChildren<{ title?: string; action?: ReactNode }>) {
  return (
    <section className="rounded-panel border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
