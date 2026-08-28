import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./ArtistAssignments.css";

export default function ArtistAssignments() {
  const navigate = useNavigate();
  const [postReports] = useLocalStorageState("vfx-supe-post-reports", []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [currentArtistId] = useLocalStorageState("vfx-supe-current-artist-id", "");
  const [onlyMine, setOnlyMine] = useState(false);

  const currentArtist = artists.find((a) => a.id === currentArtistId);

  const rows = postReports.flatMap((shot) => shot.tasks.map((task) => ({ shot, task })));

  const filteredRows =
    onlyMine && currentArtist
      ? rows.filter(({ task }) => task.assignee?.trim().toLowerCase() === currentArtist.name.trim().toLowerCase())
      : rows;

  return (
    <div className="artist-assignments">
      <div className="artist-assignments-header">
        <span className="artist-assignments-title">SHOT TRACKING</span>
        <div className="artist-assignments-header-actions">
          {currentArtist && (
            <span
              className={`pill artist-assignments-mine${onlyMine ? " pill-accent" : ""}`}
              onClick={() => setOnlyMine((v) => !v)}
            >
              {onlyMine ? `My tasks (${currentArtist.name})` : "My tasks"}
            </span>
          )}
          <span className="pill">{filteredRows.length} assignments</span>
        </div>
      </div>

      {!currentArtist && (
        <div className="card artist-assignments-hint">
          You're not linked to an artist profile — ask an Admin to add you in Post Reports → Artists, then
          re-select your name on the login screen to unlock "My tasks".
        </div>
      )}

      {filteredRows.length === 0 ? (
        <div className="card artist-assignments-empty">
          {onlyMine ? "No assignments for you yet." : "No assignments yet."}
        </div>
      ) : (
        <div className="card report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Shot</th>
                <th>Task</th>
                <th>Source</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ shot, task }) => (
                <tr
                  key={`${shot.id}-${task.id}`}
                  className="artist-assignments-row"
                  onClick={() => navigate(`/shot/${shot.shotCode}`)}
                >
                  <td>
                    <span className="report-shot-code">{shot.shotCode}</span>
                  </td>
                  <td>
                    <span className="report-static-text">{task.type}</span>
                  </td>
                  <td>
                    <span className={`pill${task.source === "inhouse" ? " pill-accent" : ""}`}>
                      {task.source === "vendor" ? "Outsourced" : "In-house"}
                    </span>
                  </td>
                  <td>
                    <span className="report-mono">{task.assignee || "Unassigned"}</span>
                  </td>
                  <td>
                    {task.status === "in_progress" ? (
                      <span className="pill pill-warning">In Progress</span>
                    ) : shot.dispatched ? (
                      <span className="pill pill-success">Dispatched</span>
                    ) : (
                      <span className="pill">Pending</span>
                    )}
                  </td>
                  <td className="report-timestamp">{shot.dueDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
