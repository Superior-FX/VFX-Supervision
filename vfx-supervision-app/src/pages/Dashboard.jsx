import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { computeImportance } from "../lib/importance.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Dashboard.css";

const BOARD_COLUMNS = [
  { id: "bidding", label: "Bidding" },
  { id: "progress", label: "In progress" },
  { id: "review", label: "Sup review" },
  { id: "final", label: "Final" },
];

function ThumbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 10l4-2.5v9L17 14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [scriptReports] = useLocalStorageState("vfx-supe-script-reports", []);
  const [captureReports] = useLocalStorageState("vfx-supe-capture-reports", []);
  const [postReports] = useLocalStorageState("vfx-supe-post-reports", []);

  const unassignedTaskCount = useMemo(
    () =>
      postReports.reduce(
        (sum, shot) => sum + shot.tasks.filter((t) => !t.assignee?.trim()).length,
        0
      ),
    [postReports]
  );

  const boardCounts = useMemo(
    () =>
      BOARD_COLUMNS.map((col) => ({
        ...col,
        count: postReports.filter((s) => (s.boardStatus ?? "bidding") === col.id).length,
      })),
    [postReports]
  );

  const stats = [
    { label: "VFX scenes tagged", value: scriptReports.length },
    { label: "Shots captured", value: captureReports.length },
    { label: "Shots in post", value: postReports.length },
    { label: "Unassigned tasks", value: unassignedTaskCount },
  ];

  const attention = useMemo(() => {
    return postReports
      .filter((shot) => (shot.boardStatus ?? "bidding") !== "final")
      .map((shot) => {
        const importance = computeImportance(shot);
        const unassigned = shot.tasks.filter((t) => !t.assignee?.trim()).length;
        const overdue = isOverdue(shot.dueDate);
        const reasons = [];
        if (importance.tier === "high") reasons.push({ label: "High importance", tone: "danger" });
        else if (importance.tier === "medium") reasons.push({ label: "Watch", tone: "warning" });
        if (overdue) reasons.push({ label: `Overdue ${shot.dueDate}`, tone: "danger" });
        if (unassigned > 0) reasons.push({ label: `${unassigned} unassigned`, tone: "warning" });
        return { shot, reasons, severity: (overdue ? 2 : 0) + (importance.tier === "high" ? 2 : importance.tier === "medium" ? 1 : 0) + unassigned };
      })
      .filter((row) => row.reasons.length > 0)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 6);
  }, [postReports]);

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
        {stats.map((stat) => (
          <div className="card stat-card" key={stat.label}>
            <span className="label">{stat.label}</span>
            <span className="stat-value">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="card board-pulse">
        <span className="label">Shot board</span>
        <div className="board-pulse-row">
          {boardCounts.map((col) => (
            <span className="pill board-pulse-pill" key={col.id}>
              {col.label} {col.count}
            </span>
          ))}
        </div>
      </div>

      <div className="section-label-row">
        <span className="label">Needs attention</span>
      </div>

      <div className="card shot-list">
        {attention.length === 0 && <span className="attention-empty">Nothing needs attention right now.</span>}
        {attention.map(({ shot, reasons }) => (
          <div className="shot-row" key={shot.id} onClick={() => navigate(`/shot/${shot.shotCode}`)}>
            {shot.thumbnail ? (
              <img className="shot-thumb-img" src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} />
            ) : (
              <div className="shot-thumb">
                <ThumbIcon />
              </div>
            )}
            <span className="shot-code">{shot.shotCode}</span>
            <div className="shot-row-reasons">
              {reasons.map((r) => (
                <span className={`pill pill-${r.tone}`} key={r.label}>
                  {r.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-actions">
        <div className="btn btn-primary" onClick={() => navigate("/capture")}>
          + Capture
        </div>
        <div className="btn btn-secondary" onClick={() => navigate("/post-reports")}>
          Post reports
        </div>
        <div className="btn btn-secondary" onClick={() => navigate("/board")}>
          Shot board
        </div>
      </div>
    </div>
  );
}
