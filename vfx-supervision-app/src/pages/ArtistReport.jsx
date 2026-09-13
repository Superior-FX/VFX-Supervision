import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { aggregateTaskStatus, taskStatusInfo } from "../data/taskStatus.js";
import { resolveCurrentArtist } from "../lib/currentArtist.js";
import { computeImportance } from "../lib/importance.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByDueComplexityName } from "../lib/sortShots.js";
import { hasAssignee } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./ArtistReport.css";

export default function ArtistReport() {
  const navigate = useNavigate();
  const project = useActiveProject();
  const [postReports, setPostReports] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [expandedId, setExpandedId] = useState(null);

  const currentArtist = resolveCurrentArtist(artists);

  // Grouped one row per shot (not per task) — same organization as Shot
  // Tracking: collapsed shows the shot with an aggregate status and
  // importance color, expand to see this artist's individual tasks on it.
  // Sorted soonest-due first, ties broken by complexity then shot code.
  const shotsWithMyTasks = currentArtist
    ? postReports.filter((shot) => shot.tasks.some((t) => hasAssignee(t, currentArtist.name)))
    : [];

  const shotGroups = sortByDueComplexityName(shotsWithMyTasks).map((shot) => ({
    shot,
    myTasks: shot.tasks.filter((t) => hasAssignee(t, currentArtist.name)),
  }));

  const totalAssignments = shotGroups.reduce((sum, g) => sum + g.myTasks.length, 0);

  const setTaskStatus = (shotId, taskId, status) => {
    setPostReports((prev) =>
      prev.map((s) =>
        s.id === shotId ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) } : s
      )
    );
  };

  return (
    <div className="artist-report">
      <div className="artist-report-header">
        <span className="artist-report-title">ARTIST REPORT</span>
        <div className="artist-report-header-actions">
          {currentArtist && <span className="pill pill-accent">{currentArtist.name}</span>}
          <span className="pill">
            {totalAssignments} assignment{totalAssignments === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {!currentArtist && (
        <div className="card artist-report-empty">
          No artist profile found for you yet — ask an Admin to add you in Post Reports → Artists.
        </div>
      )}

      {currentArtist && shotGroups.length === 0 ? (
        <div className="card artist-report-empty">No shots assigned to you yet.</div>
      ) : (
        currentArtist && (
          <div className="card report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Shot</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {shotGroups.map(({ shot, myTasks }) => {
                  const isExpanded = expandedId === shot.id;
                  const status = aggregateTaskStatus(myTasks);
                  const importance = computeImportance(shot);
                  return (
                    <Fragment key={shot.id}>
                      <tr
                        className={`artist-report-row${importance.colorKey ? ` importance-${importance.colorKey}` : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : shot.id)}
                      >
                        <td className="artist-report-expand-cell">{isExpanded ? "▲" : "▼"}</td>
                        <td>
                          <span className="report-shot-code">{shot.shotCode}</span>
                        </td>
                        <td>
                          <span className="report-static-text">{shot.internalDescription || "—"}</span>
                        </td>
                        <td>
                          <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
                        </td>
                        <td className="report-timestamp">{shot.dueDate || "—"}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="report-expanded-row">
                          <td colSpan={5}>
                            <div className="artist-report-tasks">
                              {myTasks.map((task) => {
                                const taskStatus = taskStatusInfo(task.status);
                                return (
                                  <div className="artist-report-task-row" key={task.id}>
                                    <span className="artist-report-task-type">{task.type}</span>
                                    <span className={`pill${task.source === "inhouse" ? " pill-accent" : ""}`}>
                                      {task.source === "vendor" ? "Outsourced" : "In-house"}
                                    </span>
                                    <span className={`pill${taskStatus.tone ? ` pill-${taskStatus.tone}` : ""}`}>
                                      {taskStatus.label}
                                    </span>
                                    {task.status === "assigned" && (
                                      <span
                                        className="btn btn-primary artist-report-action-btn"
                                        onClick={() => setTaskStatus(shot.id, task.id, "wip")}
                                      >
                                        Start
                                      </span>
                                    )}
                                    {task.status === "needs_revision" && (
                                      <span
                                        className="btn btn-danger artist-report-action-btn"
                                        onClick={() => setTaskStatus(shot.id, task.id, "wip")}
                                      >
                                        Resume
                                      </span>
                                    )}
                                    {task.status === "wip" && (
                                      <span className="artist-report-action-hint">Submit in Upload Shot</span>
                                    )}
                                  </div>
                                );
                              })}
                              <span
                                className="artist-report-view-shot"
                                onClick={() => navigate(`/shot/${shot.shotCode}`)}
                              >
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
        )
      )}
    </div>
  );
}
