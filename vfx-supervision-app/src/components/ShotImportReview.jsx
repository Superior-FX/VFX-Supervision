import { useEffect, useMemo, useState } from "react";
import { padScene } from "../lib/folderPath.js";
import {
  IMPORT_FIELDS,
  buildRows,
  cellText,
  checkRows,
  fillMissingCodes,
  findHeaderRow,
  guessMapping,
  normalizeTimecode,
  pickSheet,
} from "../lib/shotImport.js";
import "./ShotImportReview.css";

const FILTERS = ["All", "Issues", "No scene", "Excluded"];

function formatCost(n) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Step 2 of "Import spreadsheet": check what each column means, give
// scene-less shots a scene, fix flagged rows, then import. Changing the
// sheet, header row or column mapping re-reads the file and drops edits.
export default function ShotImportReview({ fileName, sheets, showCode, busy, error, onBack, onImport }) {
  const [sheetIndex, setSheetIndex] = useState(() => pickSheet(sheets));
  const sheet = sheets[sheetIndex];
  const [headerIndex, setHeaderIndex] = useState(() => findHeaderRow(sheet.rows));
  const headers = useMemo(() => (sheet.rows[headerIndex] ?? []).map(cellText), [sheet, headerIndex]);
  const [mapping, setMapping] = useState(() => guessMapping(headers));
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [lastClicked, setLastClicked] = useState(null);
  const [bulkScene, setBulkScene] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    setRows(fillMissingCodes(buildRows(sheet.rows, headerIndex, mapping), showCode));
    setSelected(new Set());
  }, [sheet, headerIndex, mapping, showCode]);

  const changeSheet = (i) => {
    const rowsOfSheet = sheets[i].rows;
    const h = findHeaderRow(rowsOfSheet);
    setSheetIndex(i);
    setHeaderIndex(h);
    setMapping(guessMapping((rowsOfSheet[h] ?? []).map(cellText)));
  };

  const changeHeaderRow = (value) => {
    const h = Math.max(0, Math.min(sheet.rows.length - 1, Number(value) - 1 || 0));
    setHeaderIndex(h);
    setMapping(guessMapping((sheet.rows[h] ?? []).map(cellText)));
  };

  const checks = useMemo(() => checkRows(rows), [rows]);
  const hasMapped = (field) => mapping.includes(field);

  const update = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const visible = rows.filter((r) => {
    if (filter === "Issues") return checks[r.key]?.issues.length > 0;
    if (filter === "No scene") return r.include && !r.scene.trim();
    if (filter === "Excluded") return !r.include;
    return true;
  });

  // Shift-click selects every visible row between this one and the last.
  const toggleSelect = (key, shiftKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const on = !prev.has(key);
      if (shiftKey && lastClicked) {
        const keys = visible.map((r) => r.key);
        const [a, b] = [keys.indexOf(lastClicked), keys.indexOf(key)].sort((x, y) => x - y);
        if (a !== -1) keys.slice(a, b + 1).forEach((k) => (on ? next.add(k) : next.delete(k)));
      } else if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    setLastClicked(key);
  };

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.key));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((r) => (allVisibleSelected ? next.delete(r.key) : next.add(r.key)));
      return next;
    });

  const applyBulkScene = () => {
    if (!bulkScene.trim()) return;
    setRows((prev) => prev.map((r) => (selected.has(r.key) ? { ...r, scene: bulkScene.trim() } : r)));
    setSelected(new Set());
    setBulkScene("");
  };

  const setSelectedIncluded = (include) => {
    setRows((prev) => prev.map((r) => (selected.has(r.key) ? { ...r, include } : r)));
    setSelected(new Set());
  };

  const fixCount = rows.filter((r) => checks[r.key]?.fix).length;
  const applyAllFixes = () =>
    setRows((prev) => prev.map((r) => (checks[r.key]?.fix ? { ...r, shotCode: checks[r.key].fix } : r)));

  const included = rows.filter((r) => r.include);
  const sceneSet = new Set(included.map((r) => padScene(r.scene) || "000"));
  const noScene = included.filter((r) => !r.scene.trim()).length;
  const blocking = rows.filter((r) => checks[r.key]?.blocking).length;
  const totalCost = included.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const canImport = included.length > 0 && blocking === 0 && !busy;

  return (
    <div className="card shot-import">
      <div className="shot-import-head">
        <div className="shot-import-title">
          <span className="label">Import shots</span>
          <span className="shot-import-file mono">{fileName}</span>
        </div>
        <div className="shot-import-source">
          {sheets.length > 1 && (
            <label className="shot-import-inline">
              <span className="label">Sheet</span>
              <select
                className="report-edit-input mono"
                value={sheetIndex}
                onChange={(e) => changeSheet(Number(e.target.value))}
              >
                {sheets.map((s, i) => (
                  <option value={i} key={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="shot-import-inline">
            <span className="label">Header row</span>
            <input
              className="report-edit-input mono shot-import-header-row"
              type="number"
              min={1}
              value={headerIndex + 1}
              onChange={(e) => changeHeaderRow(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="shot-import-section">
        <span className="label">Columns</span>
        <span className="shot-import-hint">
          Matched automatically — change any that are wrong. Changing a column re-reads the file and resets edits
          below.
        </span>
        <div className="shot-import-mapping">
          {headers.map((h, i) =>
            h || mapping[i] ? (
              <label className={`shot-import-map${mapping[i] ? " is-mapped" : ""}`} key={i}>
                <span className="shot-import-map-header" title={h}>
                  {h || `Column ${i + 1}`}
                </span>
                <select
                  className="report-edit-input"
                  value={mapping[i] ?? ""}
                  onChange={(e) => setMapping((prev) => prev.map((f, j) => (j === i ? e.target.value : f)))}
                >
                  {IMPORT_FIELDS.map((f) => (
                    <option value={f.value} key={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null
          )}
        </div>
        {!hasMapped("shotCode") && !hasMapped("description") && (
          <span className="home-new-project-error">Map at least a Shot code or VFX description column.</span>
        )}
      </div>

      <div className="shot-import-toolbar">
        <div className="shot-import-filters">
          {FILTERS.map((f) => (
            <span
              key={f}
              className={`shot-import-filter${filter === f ? " is-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </span>
          ))}
        </div>
        {selected.size > 0 ? (
          <div className="shot-import-bulk">
            <span className="label">{selected.size} selected</span>
            <input
              className="report-edit-input mono shot-import-bulk-scene"
              placeholder="Scene"
              value={bulkScene}
              onChange={(e) => setBulkScene(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  applyBulkScene();
                }
              }}
            />
            <span className={`btn btn-secondary${bulkScene.trim() ? "" : " btn-disabled"}`} onClick={applyBulkScene}>
              Set scene
            </span>
            <span className="btn btn-secondary" onClick={() => setSelectedIncluded(false)}>
              Exclude
            </span>
            <span className="btn btn-secondary" onClick={() => setSelectedIncluded(true)}>
              Include
            </span>
          </div>
        ) : (
          <span className="shot-import-hint">Tick rows (shift-click for a range) to set their scene in one go.</span>
        )}
        {fixCount > 0 && (
          <span className="btn btn-secondary" onClick={applyAllFixes}>
            Fix {fixCount} inconsistent code{fixCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="shot-import-table-wrap">
        <table className="shot-import-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
              </th>
              <th title="Import this row">Use</th>
              <th>Row</th>
              <th>Scene</th>
              <th>Shot code</th>
              <th>VFX description</th>
              {hasMapped("notes") && <th>Internal notes</th>}
              {(hasMapped("tcRange") || hasMapped("tcIn")) && <th>TC in</th>}
              {(hasMapped("tcRange") || hasMapped("tcOut")) && <th>TC out</th>}
              {hasMapped("cost") && <th>Bid</th>}
              {hasMapped("dueDate") && <th>Due</th>}
              <th>Check</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const check = checks[r.key] ?? { issues: [], blocking: false };
              return (
                <tr
                  key={r.key}
                  className={`${r.include ? "" : "is-excluded"}${selected.has(r.key) ? " is-selected" : ""}`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.key)}
                      onChange={() => {}}
                      onClick={(e) => toggleSelect(r.key, e.shiftKey)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => update(r.key, { include: e.target.checked })}
                    />
                  </td>
                  <td className="mono shot-import-rownum">{r.sourceRow}</td>
                  <td>
                    <input
                      className="report-edit-input mono shot-import-scene"
                      placeholder="000"
                      value={r.scene}
                      onChange={(e) => update(r.key, { scene: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={`report-edit-input mono shot-import-code${check.blocking ? " is-invalid" : ""}`}
                      value={r.shotCode}
                      onChange={(e) => update(r.key, { shotCode: e.target.value, generatedCode: false })}
                    />
                  </td>
                  <td>
                    <textarea
                      className="report-edit-input shot-import-desc"
                      rows={2}
                      value={r.description}
                      onChange={(e) => update(r.key, { description: e.target.value })}
                    />
                  </td>
                  {hasMapped("notes") && (
                    <td>
                      <textarea
                        className="report-edit-input shot-import-desc"
                        rows={2}
                        value={r.notes}
                        onChange={(e) => update(r.key, { notes: e.target.value })}
                      />
                    </td>
                  )}
                  {(hasMapped("tcRange") || hasMapped("tcIn")) && (
                    <td>
                      <input
                        className="report-edit-input mono shot-import-tc"
                        value={r.tcIn}
                        onChange={(e) => update(r.key, { tcIn: e.target.value })}
                        onBlur={(e) => {
                          const tc = normalizeTimecode(e.target.value);
                          if (tc.valid) update(r.key, { tcIn: tc.value });
                        }}
                      />
                    </td>
                  )}
                  {(hasMapped("tcRange") || hasMapped("tcOut")) && (
                    <td>
                      <input
                        className="report-edit-input mono shot-import-tc"
                        value={r.tcOut}
                        onChange={(e) => update(r.key, { tcOut: e.target.value })}
                        onBlur={(e) => {
                          const tc = normalizeTimecode(e.target.value);
                          if (tc.valid) update(r.key, { tcOut: tc.value });
                        }}
                      />
                    </td>
                  )}
                  {hasMapped("cost") && (
                    <td>
                      <input
                        className="report-edit-input mono shot-import-cost"
                        type="number"
                        value={r.cost ?? ""}
                        onChange={(e) => update(r.key, { cost: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </td>
                  )}
                  {hasMapped("dueDate") && (
                    <td>
                      <input
                        className="report-edit-input mono shot-import-due"
                        type="date"
                        value={r.dueDate}
                        onChange={(e) => update(r.key, { dueDate: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="shot-import-issues">
                    {check.issues.map((issue) => (
                      <span key={issue} className={`shot-import-issue${check.blocking ? " is-blocking" : ""}`}>
                        {issue}
                      </span>
                    ))}
                    {check.fix && (
                      <span className="shot-import-fix" onClick={() => update(r.key, { shotCode: check.fix })}>
                        Use {check.fix}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <div className="shot-import-empty">No rows here.</div>}
      </div>

      <div className="shot-import-footer">
        <div className="shot-import-summary">
          <span className="pill mono">
            {included.length} shot{included.length === 1 ? "" : "s"}
          </span>
          <span className="pill mono">
            {sceneSet.size} scene{sceneSet.size === 1 ? "" : "s"}
          </span>
          {rows.length > included.length && <span className="pill mono">{rows.length - included.length} excluded</span>}
          {noScene > 0 && (
            <span className="pill pill-warning mono" title="These import into scene 000 — renumber it in Post Reports">
              {noScene} without a scene → SC000
            </span>
          )}
          {hasMapped("cost") && <span className="pill mono">Bid total {formatCost(totalCost)}</span>}
          {blocking > 0 && (
            <span className="pill pill-danger mono">
              {blocking} row{blocking === 1 ? "" : "s"} to fix
            </span>
          )}
        </div>
        <span className="shot-import-hint">
          Creates the scenes and shots in Post Reports. Scene/shot folders and tasks are still added there by hand.
        </span>
        {error && <span className="home-new-project-error">{error}</span>}
        <div className="home-new-project-actions">
          <span className={`btn btn-primary${canImport ? "" : " btn-disabled"}`} onClick={canImport ? () => onImport(rows) : undefined}>
            {busy ? "Creating…" : `Create Project + Import ${included.length} Shot${included.length === 1 ? "" : "s"}`}
          </span>
          <span className="btn btn-secondary" onClick={onBack}>
            Back
          </span>
        </div>
      </div>
    </div>
  );
}
