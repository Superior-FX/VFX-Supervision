import { useAuth } from "../lib/auth.jsx";
import Login, { AuthCard, SetNewPassword, WaitingForAccess } from "../pages/Login.jsx";

// Nothing in the app renders until someone with a role is signed in.
export default function AuthGate({ children }) {
  const { configured, session, profile, recovering } = useAuth();

  if (!configured) {
    return (
      <AuthCard heading="Sign-in isn't set up">
        <span className="login-body">
          This copy of the app has no Supabase keys. Add <strong>.env.local</strong> to the vfx-supervision-app
          folder with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.
        </span>
      </AuthCard>
    );
  }
  if (session === undefined) return <Loading />;
  if (recovering && session) return <SetNewPassword />;
  if (!session) return <Login />;
  if (profile === undefined) return <Loading />;
  if (!profile || profile.roles.length === 0) return <WaitingForAccess />;
  return children;
}

function Loading() {
  return (
    <div className="login-page">
      <span className="label">Loading…</span>
    </div>
  );
}
