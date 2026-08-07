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
  const [postReports] = useLocalStorageState("vfx-supe-post-reports", []);

  const rows = postReports.flatMap((shot) =>
    shot.tasks
      .filter((task) => task.status)
      .map((task) => ({ shot, task }))
  );

  return (
    <div className="artist-report">
      <div className="artist-report-header">
        <span className="artist-report-title">ARTIST REPORT</span>
        <span className="pill">{rows.length} submissions</span>
      </div>

      {rows.length === 0 ? (
        <div className="card artist-report-empty">
          No submissions yet — submitting a shot in Upload Shot logs it here.
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
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ shot, task }) => (
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
                    <span className="report-mono">{task.assignee || "—"}</span>
                  </td>
                  <td>
                    <span className="pill pill-warning">In Progress</span>
                  </td>
                  <td className="report-timestamp">{formatTime(shot.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
