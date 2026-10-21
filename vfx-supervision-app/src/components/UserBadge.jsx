import { useAuth } from "../lib/auth.jsx";
import { useRole } from "../lib/role.js";
import "./UserBadge.css";

// Who's signed in + Sign out. Sits at the bottom of the sidebars.
export default function UserBadge() {
  const { signOut } = useAuth();
  const { profile, roles, primaryRole } = useRole();
  if (!profile) return null;
  return (
    <div className="user-badge">
      <div className="user-badge-who">
        <span className="user-badge-name" title={profile.email}>
          {profile.name || profile.email}
        </span>
        <span className="pill pill-accent user-badge-role" title={roles.join(", ")}>
          {primaryRole}
          {roles.length > 1 ? ` +${roles.length - 1}` : ""}
        </span>
      </div>
      <span className="user-badge-signout" onClick={signOut}>
        Sign out
      </span>
    </div>
  );
}
