import { taskStatusInfo } from "../data/taskStatus.js";
import { resolveCurrentArtist } from "../lib/currentArtist.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./ArtistReport.css";

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ArtistReport() {
  const [postReports, setPostReports] = useLocalStorageState("vfx-supe-post-reports", []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);

  const currentArtist = resolveCurrentArtist(artists);

  const rows = currentArtist
    ? postReports.flatMap((shot) =>
        shot.tasks
          .filter((task) => task.assignee?.trim().toLowerCase() === currentArtist.name.trim().toLowerCase())
          .map((task) => ({ shot, task }))
      )
    : [];

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
          <span className="pill">{rows.length} assignments</span>
        </div>
      </div>

      {!currentArtist && (
        <div className="card artist-report-empty">
          No artist profile found for you yet — ask an Admin to add you in Post Reports → Artists.
        </div>
      )}

      {currentArtist && rows.length === 0 ? (
        <div className="card artist-report-empty">No shots assigned to you yet.</div>
      ) : (
        currentArtist && (
          <div className="card report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Shot</th>
                  <th>Task</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ shot, task }) => {
                  const status = taskStatusInfo(task.status);
                  return (
                    <tr key={`${shot.id}-${task.id}`}>
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
                        <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
                      </td>
                      <td className="report-timestamp">{shot.dueDate || "—"}</td>
                      <td>
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
                      </td>
                    </tr>
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
