import { useAuth } from "./auth.jsx";

// What each role may do. Admin isn't listed — it passes every check,
// including any permission added later. The database enforces the same
// rules (supabase/migrations); this only decides what the UI shows.
const PERMISSIONS = {
  // Everything outside the Artist Portal: Dashboard, Post Reports, Review, Shot Board.
  studio: ["VFX Supervisor", "Comp Supervisor", "Producer"],
  // Create/delete projects, add tasks, assign artists, edit the roster, backups.
  manage_projects: ["VFX Supervisor", "Comp Supervisor", "Producer"],
  // Team page: invite people, set roles (never Admin), link to artists.
  manage_users: ["VFX Supervisor", "Comp Supervisor", "Producer"],
  // Final / Revise in Review & Dailies. Producers can't.
  review_decide: ["VFX Supervisor", "Comp Supervisor"],
  footage_notes: ["VFX Supervisor", "Comp Supervisor", "Producer"],
  // Shot bid costs (from an imported VFX list). UI-only: the cost still
  // travels with the shot record, so anyone with database access can read it.
  view_costs: ["Producer"],
};

// Shown in the sidebar pill when someone holds several roles.
const ROLE_ORDER = ["Admin", "VFX Supervisor", "Comp Supervisor", "Producer", "Artist"];

export function rolesCan(roles, permission) {
  if (roles.includes("Admin")) return true;
  return (PERMISSIONS[permission] ?? []).some((r) => roles.includes(r));
}

// What this person's Final does: a VFX Supervisor (or Admin) finals the
// task; a Comp Supervisor's Final only marks it comp_approved, flagging it
// for VFX Supervisor sign-off. null = no Final at all.
export function finalStatusFor(roles) {
  if (roles.includes("Admin") || roles.includes("VFX Supervisor")) return "final";
  if (roles.includes("Comp Supervisor")) return "comp_approved";
  return null;
}

export function primaryRole(roles) {
  return ROLE_ORDER.find((r) => roles.includes(r)) ?? "";
}

// { profile, roles, can(permission), isAdmin, isArtistOnly, primaryRole,
//   finalStatus, canFinal(status) }
export function useRole() {
  const { profile } = useAuth();
  const roles = profile?.roles ?? [];
  return {
    profile,
    roles,
    can: (permission) => rolesCan(roles, permission),
    isAdmin: roles.includes("Admin"),
    isArtistOnly: roles.length > 0 && !rolesCan(roles, "studio"),
    primaryRole: primaryRole(roles),
    finalStatus: finalStatusFor(roles),
    // Whether this person's Final would move a task in this status forward
    // (a Comp Supervisor can't re-approve something already comp_approved).
    canFinal: (status) => {
      const next = finalStatusFor(roles);
      return Boolean(next) && next !== status;
    },
  };
}
