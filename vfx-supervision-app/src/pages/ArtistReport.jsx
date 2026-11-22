import { useNavigate } from "react-router-dom";
import { aggregateTaskStatus, taskStatusInfo, withStatus } from "../data/taskStatus.js";
import { useCurrentArtist } from "../lib/currentArtist.js";
import { computeImportance } from "../lib/importance.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByShotCode } from "../lib/sortShots.js";
import { hasAssignee } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./ArtistReport.css";

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export default function ArtistReport() {
  const navigate = useNavigate();
  const project = useActiveProject();
  const [postReports, setPostReports] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);

  const currentArtist = useCurrentArtist(artists);

  // One card per shot, in shot-code order (same as Shot Tracking): the
  // shot with its overall status and importance color, and every task this
  // artist has on it listed underneath, ready to View / Start / Resume.
  const shotsWithMyTasks = currentArtist
    ? postReports.filter((shot) => shot.tasks.some((t) => hasAssignee(t, currentArtist.name)))
    : [];

  const shotGroups = sortByShotCode(shotsWithMyTasks).map((shot) => ({
    shot,
    myTasks: shot.tasks.filter((t) => hasAssignee(t, currentArtist.name)),
  }));

  const totalAssignments = shotGroups.reduce((sum, g) => sum + g.myTasks.length, 0);

  const setTaskStatus = (shotId, taskId, status) => {
    setPostReports((prev) =>
      prev.map((s) =>
        s.id === shotId ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? withStatus(t, status) : t)) } : s
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
          Your account isn't linked to an artist yet — ask a supervisor to link you on the Team page.
        </div>
      )}

      {currentArtist && shotGroups.length === 0 ? (
        <div className="card artist-report-empty">No shots assigned to you yet.</div>
      ) : (
        currentArtist && (
          <div className="artist-report-grid">
            {shotGroups.map(({ shot, myTasks }) => {
              const status = aggregateTaskStatus(myTasks);
              const importance = computeImportance(shot);
              return (
                <div
                  key={shot.id}
                  className={`card artist-report-card${importance.colorKey ? ` importance-${importance.colorKey}` : ""}`}
                >
                  {shot.thumbnail ? (
                    <img className="artist-report-thumb" src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} />
                  ) : (
                    <div className="artist-report-thumb artist-report-thumb-placeholder">
                      <ImageIcon />
                    </div>
                  )}

                  <div className="artist-report-card-head">
                    <span className="artist-report-code">{shot.shotCode}</span>
                    <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
                  </div>
                  <div className="artist-report-card-meta">
                    <span className="label">Due</span>
                    <span className="mono">{shot.dueDate || "—"}</span>
                  </div>
                  {shot.internalDescription && <p className="artist-report-desc">{shot.internalDescription}</p>}

                  <div className="artist-report-tasks">
                    {myTasks.map((task) => {
                      const taskStatus = taskStatusInfo(task.status);
                      return (
                        <div className="artist-report-task" key={task.id}>
                          <div className="artist-report-task-line">
                            <span className="artist-report-task-type">{task.type}</span>
                            <span className={`pill${taskStatus.tone ? ` pill-${taskStatus.tone}` : ""}`}>
                              {taskStatus.label}
                            </span>
                          </div>
                          <div className="artist-report-task-line">
                            <span className={`pill${task.source === "inhouse" ? " pill-accent" : ""}`}>
                              {task.source === "vendor" ? "Outsourced" : "In-house"}
                            </span>
                            <span className="artist-report-task-actions">
                              {task.status === "wip" && (
                                <span className="artist-report-action-hint">Submit in Upload Shot</span>
                              )}
                              <span
                                className="btn btn-secondary artist-report-action-btn"
                                onClick={() => navigate(`/artist-review?task=${task.id}`)}
                              >
                                VIEW
                              </span>
                              {task.status === "assigned" && (
                                <span
                                  className="btn btn-primary artist-report-action-btn artist-report-start"
                                  onClick={() => setTaskStatus(shot.id, task.id, "wip")}
                                >
                                  Start
                                </span>
                              )}
                              {task.status === "needs_revision" && (
                                <span
                                  className="btn btn-danger artist-report-action-btn artist-report-start"
                                  onClick={() => setTaskStatus(shot.id, task.id, "wip")}
                                >
                                  Resume
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
