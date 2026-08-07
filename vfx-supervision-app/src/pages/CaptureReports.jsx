import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./CaptureReports.css";

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CaptureReports() {
  const [reports] = useLocalStorageState("vfx-supe-capture-reports", []);
  const sorted = [...reports].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return (
    <div className="capture-reports">
      <div className="capture-reports-header">
        <span className="capture-reports-title">CAPTURE REPORTS</span>
        <span className="pill">{reports.length} shots submitted</span>
      </div>

      {sorted.length === 0 ? (
        <div className="card capture-reports-empty">
          No shots submitted yet — submit a capture from On-Set Capture to see it here.
        </div>
      ) : (
        <div className="card report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th></th>
                <th>Shot</th>
                <th>Description</th>
                <th>Lens</th>
                <th>Camera</th>
                <th>Checklist</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const done = row.checklist?.filter((c) => c.checked).length ?? 0;
                const total = row.checklist?.length ?? 0;
                return (
                  <tr key={row.id}>
                    <td className="report-thumb-cell">
                      {row.thumbnail ? (
                        <img className="report-thumb" src={row.thumbnail} alt={`${row.shotCode} thumbnail`} />
                      ) : (
                        <div className="report-thumb-placeholder">
                          <ImageIcon />
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="report-shot-code">{row.shotCode}</span>
                    </td>
                    <td className="report-description">{row.description || "—"}</td>
                    <td className="report-mono">{row.lens}</td>
                    <td className="report-mono">{row.camera}</td>
                    <td>
                      <span className={`report-checklist-count${done === total && total > 0 ? " complete" : ""}`}>
                        {done}/{total}
                      </span>
                    </td>
                    <td className="report-timestamp">{formatTime(row.submittedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
