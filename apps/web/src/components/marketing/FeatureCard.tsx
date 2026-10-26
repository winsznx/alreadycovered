import type { ReactNode } from "react";

export function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-floating)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-control bg-verified-soft text-verified" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-secondary">{description}</p>
    </article>
  );
}
