import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "../lib/auth.jsx";
import * as sharedStore from "../lib/sharedStore.js";
import { AuthCard } from "../pages/Login.jsx";
import "./DataGate.css";

// Loads the team's shared data once per sign-in, before any page renders,
// so pages can read it synchronously the way they read localStorage.
export default function DataGate({ children }) {
  const { user } = useAuth();
  const status = useSyncExternalStore(sharedStore.subscribeStatus, sharedStore.getStatus);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      await sharedStore.loadAll();
    } catch (err) {
      setLoadError(err.message || "Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    sharedStore.reset();
    load();
    return () => sharedStore.reset();
  }, [user?.id, load]);

  if (loadError) {
    return (
      <AuthCard heading="Couldn't load your projects">
        <span className="login-error">{loadError}</span>
        <button type="button" className="btn btn-primary" onClick={load}>
          Try again
        </button>
      </AuthCard>
    );
  }
  if (!status.loaded) {
    return (
      <div className="login-page">
        <span className="label">Loading projects…</span>
      </div>
    );
  }

  return (
    <>
      {children}
      {status.error && (
        <div className="sync-error" role="alert">
          <span>{status.error}</span>
          <span className="sync-error-close" onClick={sharedStore.clearError}>
            ×
          </span>
        </div>
      )}
    </>
  );
}
