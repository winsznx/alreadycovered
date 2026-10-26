import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        ink: "var(--ink)",
        "ink-secondary": "var(--ink-secondary)",
        "ink-muted": "var(--ink-muted)",
        border: "var(--border)",
        verified: "var(--verified)",
        "verified-soft": "var(--verified-soft)",
        review: "var(--review)",
        "review-soft": "var(--review-soft)",
        blocking: "var(--blocking)",
        "blocking-soft": "var(--blocking-soft)",
      },
      borderRadius: {
        control: "10px",
        panel: "16px",
        card: "20px",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
