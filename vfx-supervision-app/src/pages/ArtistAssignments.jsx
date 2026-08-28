import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { taskStatusInfo } from "../data/taskStatus.js";
import { CURRENT_ARTIST_NAME, resolveCurrentArtist } from "../lib/currentArtist.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./ArtistAssignments.css";

function assigneeSummary(tasks) {
  const names = [...new Set(tasks.map((t) => t.assignee?.trim()).filter(Boolean))];
  if (names.length === 0) return "Unassigned";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

// Most "urgent"/active status across a shot's tasks, in priority order.
function shotStatus(shot) {
  const statuses = shot.tasks.map((t) => t.status || "assigned");
  if (statuses.includes("needs_revision")) return taskStatusInfo("needs_revision");
  if (statuses.includes("wip")) return taskStatusInfo("wip");
  if (statuses.includes("pending")) return taskStatusInfo("pending");
  if (statuses.length > 0 && statuses.every((s) => s === "final")) return taskStatusInfo("final");
  return taskStatusInfo("assigned");
}

export default function ArtistAssignments() {
  const navigate = useNavigate();
  const [postReports] = useLocalStorageState("vfx-supe-post-reports", []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [onlyMine, setOnlyMine] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const currentArtist = resolveCurrentArtist(artists);

  const shotsWithTasks = postReports.filter((s) => s.tasks.length > 0);

  const filteredShots =
    onlyMine && currentArtist
      ? shotsWithTasks.filter((s) =>
          s.tasks.some((t) => t.assignee?.trim().toLowerCase() === currentArtist.name.trim().toLowerCase())
        )
      : shotsWithTasks;

  const totalAssignments = filteredShots.reduce((sum, s) => sum + s.tasks.length, 0);

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
          <span className="pill">
            {filteredShots.length} shot{filteredShots.length === 1 ? "" : "s"} · {totalAssignments} assignment
            {totalAssignments === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {!currentArtist && (
        <div className="card artist-assignments-hint">
          No artist named "{CURRENT_ARTIST_NAME}" found in the directory — add them in Post Reports → Artists
          to unlock "My tasks".
        </div>
      )}

      {filteredShots.length === 0 ? (
        <div className="card artist-assignments-empty">
          {onlyMine ? "No assignments for you yet." : "No assignments yet."}
        </div>
      ) : (
        <div className="card report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th></th>
                <th>Shot</th>
                <th>Description</th>
                <th>Assignees</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {filteredShots.map((shot) => {
                const isExpanded = expandedId === shot.id;
                const status = shotStatus(shot);
                return (
                  <Fragment key={shot.id}>
                    <tr className="artist-assignments-row" onClick={() => setExpandedId(isExpanded ? null : shot.id)}>
                      <td className="artist-assignments-expand-cell">{isExpanded ? "▲" : "▼"}</td>
                      <td>
                        <span className="report-shot-code">{shot.shotCode}</span>
                      </td>
                      <td>
                        <span className="report-static-text">{shot.description || "—"}</span>
                      </td>
                      <td>
                        <span className="report-mono">{assigneeSummary(shot.tasks)}</span>
                      </td>
                      <td>
                        <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
                      </td>
                      <td className="report-timestamp">{shot.dueDate || "—"}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="report-expanded-row">
                        <td colSpan={6}>
                          <div className="artist-assignments-tasks">
                            {shot.tasks.map((task) => {
                              const taskStatus = taskStatusInfo(task.status);
                              return (
                                <div className="artist-assignments-task-row" key={task.id}>
                                  <span className="artist-assignments-task-type">{task.type}</span>
                                  <span className={`pill${task.source === "inhouse" ? " pill-accent" : ""}`}>
                                    {task.source === "vendor" ? "Outsourced" : "In-house"}
                                  </span>
                                  <span className="report-mono">{task.assignee || "Unassigned"}</span>
                                  <span className={`pill${taskStatus.tone ? ` pill-${taskStatus.tone}` : ""}`}>
                                    {taskStatus.label}
                                  </span>
                                </div>
                              );
                            })}
                            <span className="artist-assignments-view-shot" onClick={() => navigate(`/shot/${shot.shotCode}`)}>
                              View shot →
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
