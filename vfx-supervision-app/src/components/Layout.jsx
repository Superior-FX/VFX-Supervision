import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Layout.css";

const ARTIST_ROUTES = ["/upload", "/artist-report"];

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
  const [role] = useLocalStorageState("vfx-supe-role", "On-set");
  const isArtist = role === "Artist";
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isArtist && !ARTIST_ROUTES.includes(location.pathname)) {
      navigate("/upload", { replace: true });
    }
  }, [isArtist, location.pathname, navigate]);

  const visibleGroups = isArtist ? NAV_GROUPS.filter((g) => g.label === "Artist Portal") : NAV_GROUPS;

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <div className="shell-brand-mark" />
          <span className="shell-brand-name">VFX SUPE</span>
        </div>

        <nav className="shell-nav">
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
          <span className="shell-switch-role" onClick={() => navigate("/login")}>
            Switch role
          </span>
        </div>
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
