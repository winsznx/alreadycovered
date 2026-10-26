import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-black disabled:bg-ink-muted",
  secondary: "bg-surface border border-border text-ink hover:bg-surface-muted",
  ghost: "bg-transparent text-ink-secondary hover:bg-surface-muted",
  danger: "bg-blocking text-white hover:brightness-95",
};

export function Button({
  variant = "primary",
  size = "md",
  pill = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg"; pill?: boolean }) {
  const sizeClasses = size === "lg" ? "min-h-[48px] px-6 text-[15px]" : "px-4 py-2 text-sm";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 ${pill ? "rounded-full" : "rounded-control"} ${sizeClasses} font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
