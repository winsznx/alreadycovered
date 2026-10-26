export function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-panel border border-border bg-surface p-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink">
        {question}
        <span className="shrink-0 text-ink-muted transition-transform group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{answer}</p>
    </details>
  );
}
