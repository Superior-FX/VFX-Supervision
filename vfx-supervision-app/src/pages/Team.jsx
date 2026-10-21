import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/auth.jsx";
import { useRole } from "../lib/role.js";
import { ROLES, supabase } from "../lib/supabase.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Team.css";

// Team & Access — who can sign in and what they can do. The database
// enforces the same rules (only Admins touch Admin), so anything the UI
// lets through that it shouldn't comes back as an error here.
export default function Team() {
  const { profile: me, refreshProfile } = useAuth();
  const { isAdmin, can } = useRole();
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [profiles, setProfiles] = useState([]);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [p, i] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("invites").select("*").order("created_at"),
    ]);
    const err = p.error ?? i.error;
    if (err) setError(err.message);
    setProfiles(p.data ?? []);
    setInvites(i.data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Runs a write, shows any error, reloads.
  const run = async (promise) => {
    setError("");
    const { error: err } = await promise;
    if (err) setError(err.message);
    await load();
    return !err;
  };

  const updateProfile = (id, patch) => run(supabase.from("profiles").update(patch).eq("id", id));

  if (!can("manage_users")) {
    return <div className="page-pad">You don't have access to this page.</div>;
  }

  const waiting = profiles.filter((p) => p.roles.length === 0);
  const team = profiles.filter((p) => p.roles.length > 0);

  // Non-admins can't touch Admin accounts; nobody edits their own roles here
  // (stops the last Admin locking themselves out).
  const lockedReason = (p) => {
    if (p.id === me.id) return "You can't change your own roles.";
    if (!isAdmin && p.roles.includes("Admin")) return "Only an Admin can edit an Admin.";
    return "";
  };

  return (
    <div className="team">
      <div className="team-header">
        <span className="label">Admin</span>
        <h1 className="team-title">Team &amp; Access</h1>
        <span className="team-sub">
          Invite people, choose what they can do, and link them to their artist in the roster.
        </span>
      </div>

      {error && <div className="card team-error">{error}</div>}

      <InviteForm
        artists={artists}
        isAdmin={isAdmin}
        existingEmails={profiles.map((p) => p.email)}
        onInvite={(invite) =>
          run(supabase.from("invites").insert({ ...invite, invited_by: me.id }))
        }
      />

      {waiting.length > 0 && (
        <section className="team-section">
          <span className="label">Waiting for access · {waiting.length}</span>
          <span className="team-hint">Signed up without an invite. Pick their roles and grant access.</span>
          {waiting.map((p) => (
            <WaitingRow
              key={p.id}
              person={p}
              artists={artists}
              isAdmin={isAdmin}
              onGrant={(roles, artistId) => updateProfile(p.id, { roles, artist_id: artistId || null })}
            />
          ))}
        </section>
      )}

      <section className="team-section">
        <span className="label">Team · {team.length}</span>
        {!loaded && <span className="team-hint">Loading…</span>}
        {team.map((p) => (
          <MemberRow
            key={p.id}
            person={p}
            isMe={p.id === me.id}
            artists={artists}
            isAdmin={isAdmin}
            lockedReason={lockedReason(p)}
            onRoles={(roles) => updateProfile(p.id, { roles })}
            onArtist={async (artistId) => {
              await updateProfile(p.id, { artist_id: artistId || null });
              if (p.id === me.id) refreshProfile();
            }}
            onRemove={() => updateProfile(p.id, { roles: [] })}
          />
        ))}
      </section>

      {invites.length > 0 && (
        <section className="team-section">
          <span className="label">Invited, not signed up yet · {invites.length}</span>
          {invites.map((inv) => (
            <div className="card team-row" key={inv.email}>
              <div className="team-who">
                <span className="team-name">{inv.name || inv.email}</span>
                <span className="team-email mono">{inv.email}</span>
              </div>
              <div className="team-pills">
                {inv.roles.map((r) => (
                  <span className="pill" key={r}>
                    {r}
                  </span>
                ))}
              </div>
              {(isAdmin || !inv.roles.includes("Admin")) && (
                <span
                  className="btn btn-secondary team-small-btn"
                  onClick={() => run(supabase.from("invites").delete().eq("email", inv.email))}
                >
                  Cancel invite
                </span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function RoleChecks({ value, onChange, isAdmin, disabled }) {
  const toggle = (role) =>
    onChange(value.includes(role) ? value.filter((r) => r !== role) : ROLES.filter((r) => r === role || value.includes(r)));
  return (
    <div className="team-roles">
      {ROLES.filter((r) => r !== "Admin" || isAdmin).map((r) => (
        <label className={`team-role${disabled ? " is-disabled" : ""}`} key={r}>
          <input type="checkbox" checked={value.includes(r)} disabled={disabled} onChange={() => toggle(r)} />
          {r}
        </label>
      ))}
    </div>
  );
}

function ArtistSelect({ artists, value, onChange, disabled }) {
  return (
    <select className="team-select" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not linked to an artist</option>
      {artists.map((a) => (
        <option value={a.id} key={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

function InviteForm({ artists, isAdmin, existingEmails, onInvite }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState([]);
  const [artistId, setArtistId] = useState("");
  const [message, setMessage] = useState("");

  const cleanEmail = email.trim().toLowerCase();
  const exists = existingEmails.includes(cleanEmail);
  const ready = cleanEmail.includes("@") && roles.length > 0 && !exists;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    const ok = await onInvite({ email: cleanEmail, name: name.trim(), roles, artist_id: artistId || null });
    if (ok) {
      setMessage(
        `Invited ${cleanEmail}. Ask them to open ${window.location.origin}, choose "Create an account" and sign up with that email.`
      );
      setEmail("");
      setName("");
      setRoles([]);
      setArtistId("");
    }
  };

  return (
    <form className="card team-invite" onSubmit={submit}>
      <span className="label">Invite someone</span>
      <div className="team-invite-fields">
        <input
          className="team-input"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input className="team-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <ArtistSelect artists={artists} value={artistId} onChange={setArtistId} />
      </div>
      <RoleChecks value={roles} onChange={setRoles} isAdmin={isAdmin} />
      {exists && <span className="team-hint">That email already has an account — edit them in the list below.</span>}
      <div className="team-invite-actions">
        <button type="submit" className={`btn btn-primary${ready ? "" : " btn-disabled"}`} disabled={!ready}>
          Add invite
        </button>
        {message && <span className="team-notice">{message}</span>}
      </div>
    </form>
  );
}

function WaitingRow({ person, artists, isAdmin, onGrant }) {
  const [roles, setRoles] = useState([]);
  const [artistId, setArtistId] = useState("");
  return (
    <div className="card team-row team-row-wrap">
      <div className="team-who">
        <span className="team-name">{person.name || person.email}</span>
        <span className="team-email mono">{person.email}</span>
      </div>
      <RoleChecks value={roles} onChange={setRoles} isAdmin={isAdmin} />
      <ArtistSelect artists={artists} value={artistId} onChange={setArtistId} />
      <span
        className={`btn btn-primary team-small-btn${roles.length ? "" : " btn-disabled"}`}
        onClick={roles.length ? () => onGrant(roles, artistId) : undefined}
      >
        Grant access
      </span>
    </div>
  );
}

function MemberRow({ person, isMe, artists, isAdmin, lockedReason, onRoles, onArtist, onRemove }) {
  const [confirming, setConfirming] = useState(false);
  const rolesLocked = Boolean(lockedReason);
  // Your own artist link is fine to change; someone else's Admin account isn't.
  const artistLocked = !isMe && rolesLocked;

  return (
    <div className="card team-row team-row-wrap">
      <div className="team-who">
        <span className="team-name">
          {person.name || person.email}
          {isMe && <span className="pill pill-accent team-you">You</span>}
        </span>
        <span className="team-email mono">{person.email}</span>
      </div>
      <div title={lockedReason || undefined}>
        <RoleChecks
          value={person.roles}
          isAdmin={isAdmin}
          disabled={rolesLocked}
          onChange={(roles) => {
            if (roles.length === 0) setConfirming(true);
            else onRoles(roles);
          }}
        />
      </div>
      <ArtistSelect artists={artists} value={person.artist_id} disabled={artistLocked} onChange={onArtist} />
      {!rolesLocked &&
        (confirming ? (
          <span className="team-confirm">
            Remove all access?
            <span className="btn btn-danger team-small-btn" onClick={onRemove}>
              Remove
            </span>
            <span className="btn btn-secondary team-small-btn" onClick={() => setConfirming(false)}>
              Cancel
            </span>
          </span>
        ) : (
          <span className="btn btn-secondary team-small-btn" onClick={() => setConfirming(true)}>
            Remove access
          </span>
        ))}
    </div>
  );
}
