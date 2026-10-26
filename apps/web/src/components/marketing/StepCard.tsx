export function StepCard({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <article className="relative flex flex-col gap-2 rounded-panel border border-border bg-surface p-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{index}</span>
      <h3 className="mt-2 text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-secondary">{description}</p>
    </article>
  );
}
