import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
import { AppLoadBoundary } from "./components/AppLoadBoundary";
import { PublicSite } from "./components/PublicListings";
import { LandingPage } from "./components/LandingPage";
import { getSession, loadPublicListings, signInWithGoogle, watchAuth } from "./lib/data";
import { isSupabaseConfigured } from "./lib/supabase";
import { isMaintenanceRoute } from "./lib/routing";

const WorkspaceApp = lazy(() => import("./WorkspaceApp"));

export default function App({ initialListings = null }) {
  const [session, setSession] = useState(undefined);
  const [error, setError] = useState("");
  const [listings, setListings] = useState(initialListings || []);
  const [busy, setBusy] = useState(initialListings === null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    getSession().then(value => { if (active) setSession(value); }).catch(() => { if (active) { setSession(null); } });
    const stop = watchAuth(setSession);
    return () => { active = false; stop?.(); };
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured || session !== null || isMaintenanceRoute()) return;
    let active = true;
    if (initialListings === null) setBusy(true);
    setError("");
    loadPublicListings().then(value => { if (active) setListings(value); })
      .catch(() => { if (active) setError("Available homes could not be loaded. Please refresh to try again."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [session, initialListings]);
  if (!isSupabaseConfigured) return <LandingPage onSignIn={signInWithGoogle} setupMissing />;
  const loading = <main className="app-boot-screen"><p role="status">Loading…</p></main>;
  if (session === undefined && initialListings !== null && !isMaintenanceRoute()) return <PublicSite listings={listings} busy={false} error={error} onSignIn={signInWithGoogle} />;
  if (session === undefined) return loading;
  if (session || isMaintenanceRoute()) return <AppLoadBoundary><Suspense fallback={loading}><WorkspaceApp session={session} /></Suspense></AppLoadBoundary>;
  return <PublicSite listings={listings} busy={busy} error={error} onSignIn={signInWithGoogle} />;
}
