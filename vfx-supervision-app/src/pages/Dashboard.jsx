import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

const STATS = [
  { label: "Shots today", value: 14 },
  { label: "Pending review", value: 7 },
  { label: "Greenscreen setups", value: 3 },
  { label: "Overdue vendor", value: 2 },
];

const SHOTS = [
  { code: "SH_042_010", status: "HDRI ✓", tone: "success" },
  { code: "SH_042_020", status: "pending", tone: "warning" },
  { code: "SH_042_030", status: "flagged", tone: "danger" },
];

function ThumbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 10l4-2.5v9L17 14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <span className="dashboard-title">PROJECT NIGHTFALL — DAY 34/60</span>
        <div className="dashboard-header-pills">
          <span className="pill">SHOOT DAY</span>
          <span className="pill">STAGE 4</span>
        </div>
      </div>

      <div className="stat-grid">
        {STATS.map((stat) => (
          <div className="card stat-card" key={stat.label}>
            <span className="label">{stat.label}</span>
            <span className="stat-value">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="section-label-row">
        <span className="label">Call sheet — scene 42, ext. rooftop</span>
      </div>

      <div className="card shot-list">
        {SHOTS.map((shot) => (
          <div className="shot-row" key={shot.code} onClick={() => navigate(`/shot/${shot.code}`)}>
            <div className="shot-thumb">
              <ThumbIcon />
            </div>
            <span className="shot-code">{shot.code}</span>
            <span className={`pill pill-${shot.tone}`}>{shot.status}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-actions">
        <div className="btn btn-primary" onClick={() => navigate("/capture")}>
          + Capture
        </div>
        <div className="btn btn-secondary" onClick={() => navigate("/board")}>
          Shot board
        </div>
      </div>
    </div>
  );
}
