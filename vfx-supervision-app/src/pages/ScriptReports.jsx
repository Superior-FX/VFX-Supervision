import { COMPLEXITY_LEVELS, effectColorKey } from "../data/vfxEffects.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./ScriptBreakdown.css";
import "./ScriptReports.css";

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScriptReports() {
  const [reports] = useLocalStorageState("vfx-supe-script-reports", []);
  const sorted = [...reports].sort((a, b) => a.number - b.number);

  return (
    <div className="script-reports">
      <div className="script-reports-header">
        <span className="script-reports-title">SCRIPT REPORTS</span>
        <span className="pill">{reports.length} VFX scenes submitted</span>
      </div>

      {sorted.length === 0 ? (
        <div className="card script-reports-empty">
          No scenes submitted yet — tag scenes with VFX in Script Breakdown, then Submit Breakdown to see them here.
        </div>
      ) : (
        <div className="card report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Scene</th>
                <th>Heading</th>
                <th>Effects</th>
                <th>Complexity</th>
                <th>Budget</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((scene) => (
                <tr key={scene.id}>
                  <td>
                    <span className="report-shot-code">SC {scene.number}</span>
                  </td>
                  <td>
                    <span className="script-report-heading">{scene.heading}</span>
                  </td>
                  <td>
                    <div className="report-badges-cell">
                      <span className={`effect-badge tone-${effectColorKey(scene.primaryEffect)}`}>
                        {scene.primaryEffect}
                      </span>
                      {scene.additionalEffects.map((effect) => (
                        <span className={`effect-badge tone-${effectColorKey(effect)}`} key={effect}>
                          {effect}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="report-mono">{COMPLEXITY_LEVELS[scene.complexity - 1]}</td>
                  <td className="script-report-budget">
                    {scene.budgeted ? `$${scene.budgetLow.toLocaleString()}–$${scene.budgetHigh.toLocaleString()}` : "—"}
                  </td>
                  <td className="report-timestamp">{formatTime(scene.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
