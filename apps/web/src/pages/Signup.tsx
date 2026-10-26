import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { api, ApiError } from "../lib/api";

export function Signup({ onAuthed }: { onAuthed: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.signup(email, password, displayName || undefined);
      await onAuthed();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Link to="/" className="mb-8 text-sm font-semibold tracking-tight">
        AlreadyCovered
      </Link>
      <Panel title="Create your account">
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-ink">Your name (optional)</label>
            <input className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Email</label>
            <input type="email" required className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-blocking">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating account…" : "Start free"}
          </Button>
        </form>
      </Panel>
      <p className="mt-4 text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-ink underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
