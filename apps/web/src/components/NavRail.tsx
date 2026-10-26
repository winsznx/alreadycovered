import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/sources", label: "Sources" },
  { to: "/settings", label: "Settings" },
];

export function NavRail({ modelStatus }: { modelStatus: string }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight">AlreadyCovered</span>
          <nav className="flex gap-4 text-sm">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? "font-medium text-ink" : "text-ink-secondary hover:text-ink")}
                end={link.to === "/"}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-secondary">
          <span
            className={`rounded-full px-2.5 py-1 ${modelStatus === "ok" ? "bg-verified-soft text-verified" : "bg-review-soft text-review"}`}
          >
            Model {modelStatus === "ok" ? "ready" : "unavailable"}
          </span>
          <button
            type="button"
            className="rounded-full bg-surface-muted px-2.5 py-1 hover:bg-border"
            onClick={async () => {
              await api.logout();
              navigate("/", { replace: true });
              window.location.reload();
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
