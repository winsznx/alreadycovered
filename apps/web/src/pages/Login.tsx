import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { api, ApiError } from "../lib/api";

export function Login({ onAuthed }: { onAuthed: () => Promise<void> }) {
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
      await api.login(email, password);
      await onAuthed();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Link to="/" className="mb-8 text-sm font-semibold tracking-tight">
        AlreadyCovered
      </Link>
      <Panel title="Log in">
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-ink">Email</label>
            <input type="email" required className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Password</label>
            <input type="password" required className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-blocking">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Log in"}
          </Button>
        </form>
      </Panel>
      <p className="mt-4 text-center text-sm text-ink-secondary">
        New here?{" "}
        <Link to="/signup" className="font-medium text-ink underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
