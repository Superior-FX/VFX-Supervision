import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase.js";

// Signed-in session + the matching row from public.profiles.
//   session: undefined while loading, null when signed out.
//   profile: undefined while loading, null if signed out or the row is
//   missing; profile.roles empty = waiting for access.
//   recovering: true after following a password-reset link, until a new
//   password is set.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(supabaseConfigured ? undefined : null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // Only set state in here — calling other supabase methods inside this
    // callback can deadlock the client.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfileError("");
    setProfile(data);
  }, [userId]);

  useEffect(() => {
    setProfile(userId ? undefined : null);
    refreshProfile();
  }, [userId, refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setProfile(null);
  }, []);

  const value = {
    configured: supabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    refreshProfile,
    recovering,
    finishRecovery: () => setRecovering(false),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
