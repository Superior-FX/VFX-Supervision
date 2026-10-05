import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "../../logo/SuperiorFX_logo_003.jpg";
import { useActiveProject } from "../lib/projects.js";
import { CURRENT_ROLE } from "../lib/role.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Layout.css";

const NAV_GROUPS = [
  {
    label: null,
    items: [{ to: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Pre-Production",
    // Locked: parked while the post / artist sections are being built.
    locked: true,
    items: [
      { to: "/breakdown", label: "Script Breakdown" },
      { to: "/script-reports", label: "Script Reports" },
    ],
  },
  {
    label: "Production",
    locked: true,
    items: [
      { to: "/capture", label: "On-Set Capture" },
      { to: "/capture-reports", label: "Capture Reports" },
    ],
  },
  {
    label: "Post-Production",
    items: [
      { to: "/post-reports", label: "Post Reports" },
      { to: "/review", label: "Review & Dailies" },
      { to: "/board", label: "Shot Board" },
    ],
  },
  {
    label: "Artist Portal",
    items: [
      // Shot Tracking (/artist-assignments) is off the menu for now — its
      // page and route are kept, to be folded into the Dashboard later.
      { to: "/artist-report", label: "Artist Report" },
      { to: "/upload", label: "Upload Shot" },
      { to: "/artist-review", label: "Shot Viewer" },
    ],
  },
  {
    label: "Reference",
    items: [{ to: "/help", label: "Help & Reference" }],
  },
];

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeProject = useActiveProject();
  // Which sidebar groups are expanded, by label. Remembered across visits;
  // the very first time, only the group holding the current page is open.
  const firstVisitGroup = NAV_GROUPS.find((g) => g.label && g.items.some((item) => pathname.startsWith(item.to)));
  const [openGroups, setOpenGroups] = useLocalStorageState(
    "vfx-supe-nav-open",
    firstVisitGroup ? { [firstVisitGroup.label]: true } : {}
  );
  const role = CURRENT_ROLE;
  const isArtist = role === "Artist";

  if (!activeProject) {
    return <Navigate to="/" replace />;
  }

  const visibleGroups = isArtist ? NAV_GROUPS.filter((g) => g.label === "Artist Portal") : NAV_GROUPS;

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <img className="shell-brand-mark" src={logo} alt="Superior-FX" />
          <span className="shell-brand-name">Superior-FX</span>
        </div>

        <div className="shell-project-block">
          <span className="shell-back-link" onClick={() => navigate("/")}>
            ← Projects
          </span>
          <div className="shell-project-pill" title={activeProject.name}>
            <span className="pill mono">{activeProject.showCode}</span>
            <span className="shell-project-name">{activeProject.name}</span>
          </div>
        </div>

        <nav className="shell-nav">
          <NavLink to="/" end className={({ isActive }) => `shell-nav-link${isActive ? " active" : ""}`}>
            Home
          </NavLink>
          {visibleGroups.map((group, i) => {
            const collapsible = Boolean(group.label);
            const isOpen = !collapsible || (!group.locked && Boolean(openGroups[group.label]));
            const holdsCurrentPage = group.items.some((item) => pathname.startsWith(item.to));
            return (
            <div className={`shell-nav-group${isOpen ? " is-open" : ""}`} key={group.label ?? `ungrouped-${i}`}>
              {collapsible && (
                <button
                  type="button"
                  className={`shell-nav-group-label${!isOpen && holdsCurrentPage ? " holds-current" : ""}${
                    group.locked ? " is-locked" : ""
                  }`}
                  aria-expanded={isOpen}
                  disabled={group.locked}
                  title={group.locked ? "Locked for now" : undefined}
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))}
                >
                  <span>{group.label}</span>
                  <span className="shell-nav-chevron">{group.locked ? "🔒" : isOpen ? "▾" : "▸"}</span>
                </button>
              )}
              {isOpen && group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `shell-nav-link${isActive ? " active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            );
          })}
        </nav>

        <div className="shell-footer">
          <span className="pill pill-accent shell-role-pill">{role}</span>
        </div>
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
