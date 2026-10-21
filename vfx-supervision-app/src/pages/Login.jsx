import { useState } from "react";
import logo from "../../logo/SuperiorFX_logo_003.jpg";
import { useAuth } from "../lib/auth.jsx";
import { supabase } from "../lib/supabase.js";
import "./Login.css";

// Shown by AuthGate whenever nobody is signed in, whatever the URL.
// mode: signin | signup | forgot
export default function Login() {
  const [mode, setMode] = useState("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
    setUnconfirmed(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setUnconfirmed(false);
    const cleanEmail = email.trim().toLowerCase();
    const redirectTo = window.location.origin;
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (err) {
          if (/not confirmed/i.test(err.message)) setUnconfirmed(true);
          throw err;
        }
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
        if (password !== confirmPassword) throw new Error("The passwords don't match.");
        const first = firstName.trim();
        const last = lastName.trim();
        const { data, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            // `name` is what the sign-up trigger copies onto the profile.
            data: { name: `${first} ${last}`.trim(), first_name: first, last_name: last },
            emailRedirectTo: redirectTo,
          },
        });
        if (err) throw err;
        if (!data.session) {
          setNotice(`Check ${cleanEmail} for a confirmation link, then come back and sign in.`);
          setMode("signin");
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
        if (err) throw err;
        setNotice(`If ${cleanEmail} has an account, a password-reset link is on its way.`);
      }
    } catch (err) {
      setError(err.message || "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setUnconfirmed(false);
    if (err) setError(err.message);
    else setNotice("Confirmation email sent again.");
  };

  const heading = { signin: "Sign in", signup: "Create your account", forgot: "Reset your password" }[mode];
  const button = { signin: "Sign in", signup: "Create account", forgot: "Send reset link" }[mode];

  return (
    <AuthCard heading={heading}>
      <form className="login-form" onSubmit={submit}>
        {mode === "signup" && (
          <div className="login-name-row">
            <div className="login-field">
              <label>First name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
                autoFocus
              />
            </div>
            <div className="login-field">
              <label>Last name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>
        )}
        <div className="login-field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@superior-fx.com"
            autoComplete="email"
            required
            autoFocus={mode !== "signup"}
          />
        </div>
        {mode !== "forgot" && (
          <div className="login-field">
            <label>Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
        )}
        {mode === "signup" && (
          <div className="login-field">
            <label>Confirm password</label>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            {confirmPassword && confirmPassword !== password && (
              <span className="login-field-hint">Passwords don't match yet.</span>
            )}
          </div>
        )}

        {error && <span className="login-error">{error}</span>}
        {unconfirmed && (
          <span className="login-link" onClick={resend}>
            Resend confirmation email
          </span>
        )}
        {notice && <span className="login-notice">{notice}</span>}

        <button type="submit" className={`btn btn-primary${busy ? " btn-disabled" : ""}`} disabled={busy}>
          {busy ? "…" : button}
        </button>
      </form>

      <div className="login-switch">
        {mode === "signin" && (
          <>
            <span className="login-link" onClick={() => switchMode("forgot")}>
              Forgot password?
            </span>
            <span className="login-link" onClick={() => switchMode("signup")}>
              New here? Create an account
            </span>
          </>
        )}
        {mode !== "signin" && (
          <span className="login-link" onClick={() => switchMode("signin")}>
            ← Back to sign in
          </span>
        )}
      </div>
    </AuthCard>
  );
}

// After following a password-reset email link.
export function SetNewPassword() {
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(err.message);
    else finishRecovery();
  };

  return (
    <AuthCard heading="Choose a new password">
      <form className="login-form" onSubmit={submit}>
        <div className="login-field">
          <label>New password</label>
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
        </div>
        <div className="login-field">
          <label>Confirm new password</label>
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          {confirmPassword && confirmPassword !== password && (
            <span className="login-field-hint">Passwords don't match yet.</span>
          )}
        </div>
        {error && <span className="login-error">{error}</span>}
        <button type="submit" className={`btn btn-primary${busy ? " btn-disabled" : ""}`} disabled={busy}>
          {busy ? "…" : "Save password"}
        </button>
      </form>
    </AuthCard>
  );
}

// Signed in, but nobody has given this account a role yet.
export function WaitingForAccess() {
  const { profile, user, profileError, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  return (
    <AuthCard heading="Waiting for access">
      <span className="login-body">
        You're signed in as <strong>{profile?.email ?? user?.email}</strong>, but your account hasn't been given a
        role yet. Ask Will or a supervisor to grant you access on the Team page, then check again.
      </span>
      {profileError && <span className="login-error">{profileError}</span>}
      <button type="button" className="btn btn-primary" onClick={check} disabled={checking}>
        {checking ? "Checking…" : "Check again"}
      </button>
      <div className="login-switch">
        <span className="login-link" onClick={signOut}>
          Sign out
        </span>
      </div>
    </AuthCard>
  );
}

// Password box with an eye button to show/hide what's been typed.
function PasswordInput({ value, onChange, autoComplete, autoFocus }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="login-password">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
      />
      <button
        type="button"
        className="login-eye"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" strokeLinecap="round" />}
        </svg>
      </button>
    </div>
  );
}

export function AuthCard({ heading, children }) {
  return (
    <div className="login-page">
      <div className="card login-panel">
        <div className="login-brand">
          <img className="login-brand-mark" src={logo} alt="Superior-FX" />
          <span className="login-brand-name">Superior-FX</span>
        </div>
        <div className="login-heading">{heading}</div>
        {children}
      </div>
    </div>
  );
}
