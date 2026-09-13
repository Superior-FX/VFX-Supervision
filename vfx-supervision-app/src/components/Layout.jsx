import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import logo from "../../logo/SuperiorFX_logo_003.jpg";
import { useActiveProject } from "../lib/projects.js";
import { CURRENT_ROLE } from "../lib/role.js";
import "./Layout.css";

const NAV_GROUPS = [
  {
    label: null,
    items: [{ to: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Pre-Production",
    items: [
      { to: "/breakdown", label: "Script Breakdown" },
      { to: "/script-reports", label: "Script Reports" },
    ],
  },
  {
    label: "Production",
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
      { to: "/artist-assignments", label: "Shot Tracking" },
      { to: "/upload", label: "Upload Shot" },
      { to: "/artist-report", label: "Artist Report" },
    ],
  },
  {
    label: "Reference",
    items: [{ to: "/help", label: "Help & Reference" }],
  },
];

export default function Layout() {
  const navigate = useNavigate();
  const activeProject = useActiveProject();
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
          {visibleGroups.map((group, i) => (
            <div className="shell-nav-group" key={group.label ?? `ungrouped-${i}`}>
              {group.label && <span className="shell-nav-group-label">{group.label}</span>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `shell-nav-link${isActive ? " active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
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
