import type { PropsWithChildren, ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
  children,
}: PropsWithChildren<{ eyebrow: string; title: ReactNode; description?: string; centered?: boolean }>) {
  return (
    <div className={`flex flex-col gap-4 ${centered ? "items-center text-center" : "md:flex-row md:items-end md:justify-between"}`}>
      <div className={centered ? "max-w-2xl" : "max-w-xl"}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-soft px-3 py-1 text-xs font-medium uppercase tracking-wide text-verified">
          {eyebrow}
        </span>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-ink sm:text-3xl">{title}</h2>
      </div>
      {description && <p className={`text-sm leading-relaxed text-ink-secondary ${centered ? "max-w-xl" : "max-w-sm md:text-right"}`}>{description}</p>}
      {children}
    </div>
  );
}
