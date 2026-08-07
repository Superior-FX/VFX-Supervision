import { useNavigate } from "react-router-dom";
import "./ShotBoard.css";

const COLUMNS = [
  {
    id: "bidding",
    label: "Bidding (18)",
    shots: [
      { code: "SH_010_005", vendor: "Anvil FX" },
      { code: "SH_010_012" },
    ],
  },
  {
    id: "progress",
    label: "In progress (64)",
    shots: [
      { code: "SH_020_030", version: "v003" },
      { code: "SH_020_040" },
      { code: "SH_020_050" },
    ],
  },
  {
    id: "review",
    label: "Sup review (12)",
    shots: [{ code: "SH_042_020", highlight: true }],
  },
  {
    id: "final",
    label: "Final (48)",
    shots: [{ code: "SH_005_010" }],
  },
];

export default function ShotBoard() {
  const navigate = useNavigate();

  return (
    <div className="board">
      <div className="board-header">
        <span className="board-title">SHOT BOARD — 142 SHOTS</span>
        <div className="board-filters">
          <span className="pill">Filter</span>
          <span className="pill">Vendor</span>
          <span className="pill">By seq</span>
        </div>
      </div>

      <div className="board-columns">
        {COLUMNS.map((col) => (
          <div className="board-column" key={col.id}>
            <span className="label board-column-label">{col.label}</span>
            <div className="board-cards">
              {col.shots.map((shot) => (
                <div
                  key={shot.code}
                  className={`card board-card${shot.highlight ? " highlight" : ""}`}
                  onClick={() => navigate(`/shot/${shot.code}`)}
                >
                  <span className="board-card-code">{shot.code}</span>
                  {(shot.vendor || shot.version) && (
                    <div className="board-card-pills">
                      {shot.vendor && <span className="board-card-meta">Vendor: {shot.vendor}</span>}
                      {shot.version && <span className="pill">{shot.version}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
