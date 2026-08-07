import { useNavigate } from "react-router-dom";
import { computeImportance } from "../lib/importance.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./ShotBoard.css";

const COLUMNS = [
  { id: "bidding", label: "Bidding" },
  { id: "progress", label: "In progress" },
  { id: "review", label: "Sup review" },
  { id: "final", label: "Final" },
];

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function assigneeSummary(shot) {
  const names = [...new Set(shot.tasks.map((t) => t.assignee?.trim()).filter(Boolean))];
  if (names.length === 0) return "Unassigned";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export default function ShotBoard() {
  const navigate = useNavigate();
  const [shots] = useLocalStorageState("vfx-supe-post-reports", []);

  return (
    <div className="board">
      <div className="board-header">
        <span className="board-title">SHOT BOARD — {shots.length} SHOTS</span>
        <div className="board-filters">
          <span className="pill">Filter</span>
          <span className="pill">Vendor</span>
          <span className="pill">By seq</span>
        </div>
      </div>

      <div className="board-columns">
        {COLUMNS.map((col) => {
          const colShots = shots.filter((s) => (s.boardStatus ?? "bidding") === col.id);
          return (
            <div className="board-column" key={col.id}>
              <span className="label board-column-label">
                {col.label} ({colShots.length})
              </span>
              <div className="board-cards">
                {colShots.length === 0 && <span className="board-column-empty">No shots</span>}
                {colShots.map((shot) => {
                  const importance = computeImportance(shot);
                  return (
                    <div
                      key={shot.id}
                      className={`card board-card${importance.colorKey ? ` importance-${importance.colorKey}` : ""}`}
                      onClick={() => navigate(`/shot/${shot.shotCode}`)}
                    >
                      <div className="board-card-top">
                        {shot.thumbnail ? (
                          <img className="board-card-thumb" src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} />
                        ) : (
                          <div className="board-card-thumb-placeholder">
                            <ImageIcon />
                          </div>
                        )}
                        <span className="board-card-code">{shot.shotCode}</span>
                      </div>
                      <span className="board-card-meta">{assigneeSummary(shot)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
