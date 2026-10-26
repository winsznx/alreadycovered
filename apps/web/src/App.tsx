import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, HashRouter, Routes, useNavigate } from "react-router-dom";
import { NavRail } from "./components/NavRail";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Setup } from "./pages/Setup";
import { Dashboard } from "./pages/Dashboard";
import { Packet } from "./pages/Packet";
import { Sources } from "./pages/Sources";
import { Settings } from "./pages/Settings";
import { api, type CurrentUser } from "./lib/api";
import type { SettingsResponse } from "./lib/types";

type AuthState = { user: CurrentUser | null; settings: SettingsResponse | null };

function AuthedApp({ settings, onProfileCreated }: { settings: SettingsResponse; onProfileCreated: () => Promise<void> }) {
  const navigate = useNavigate();
  const setupComplete = settings.setupComplete === true;

  return (
    <>
      {setupComplete && <NavRail modelStatus={settings.modelHealth.reachable && settings.modelHealth.installedTag ? "ok" : "unavailable"} />}
      <main className="mx-auto max-w-5xl px-6 py-6">
        <Routes>
          <Route
            path="/setup"
            element={
              setupComplete ? (
                <Navigate to="/" replace />
              ) : (
                <Setup onComplete={() => onProfileCreated().then(() => navigate("/sources", { replace: true }))} />
              )
            }
          />
          {!setupComplete ? (
            <Route path="*" element={<Navigate to="/setup" replace />} />
          ) : (
            <>
              <Route path="/" element={<Dashboard timezone={settings.profile.timezone} />} />
              <Route path="/packets/:packetId" element={<Packet />} />
              <Route path="/sources" element={<Sources />} />
              <Route path="/settings" element={<Settings profileId={settings.profile.id} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </main>
    </>
  );
}

function UnauthedRoutes({ onAuthed }: { onAuthed: () => Promise<void> }) {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login onAuthed={onAuthed} />} />
      <Route path="/signup" element={<Signup onAuthed={onAuthed} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  const [state, setState] = useState<AuthState>({ user: null, settings: null });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const { user } = await api.me().catch(() => ({ user: null }));
    if (!user) {
      setState({ user: null, settings: null });
      setLoaded(true);
      return;
    }
    const settings = await api.settings().catch(() => null);
    setState({ user, settings });
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!loaded) {
    return <div className="flex h-screen items-center justify-center text-ink-secondary">Loading&hellip;</div>;
  }

  return (
    <HashRouter>
      {state.user && state.settings ? <AuthedApp settings={state.settings} onProfileCreated={refresh} /> : <UnauthedRoutes onAuthed={refresh} />}
    </HashRouter>
  );
}
