import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FootageNotes from "../../components/FootageNotes.jsx";
import { padScene } from "../../lib/folderPath.js";
import { formatBytes, matchShot, sourcesFromFiles, sourcesFromFolder } from "../../lib/footageMatch.js";
import { ensurePermission, FOOTAGE_FOLDER_PICKER_ID, FOOTAGE_PICKER_ID } from "../../lib/fsAccess.js";
import { ingestPlate } from "../../lib/plateImport.js";
import { sortByShotCode } from "../../lib/sortShots.js";
import "./FootageIngest.css";

const SKIP = "";

// Post Reports → Ingest. Pick footage (video files, or a folder of videos
// and/or image sequences); each source is matched to a shot by name, then
// ingested one at a time — copied into the shot's 00_plates/, proxied into
// 03_review/plate/, and the proxy's mid-frame becomes the shot thumbnail.
// Same pipeline as the per-shot "Import plate" buttons (ingestPlate).
//
// Stays mounted while other Post Reports tabs are showing (see `hidden`),
// so a long ingest keeps its queue and progress across tab switches.
export default function FootageIngest({ hidden, shots, folder, patchShot, ensureShotFolders }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]); // [{ source, shotId, status, stage, fraction, message, thumbnail }]
  const [running, setRunning] = useState(false);
  const [pickError, setPickError] = useState("");

  const sortedShots = useMemo(() => sortByShotCode(shots.filter((s) => s.shotCode?.trim())), [shots]);
  const shotsById = useMemo(() => Object.fromEntries(shots.map((s) => [s.id, s])), [shots]);
  const connected = folder.status === "connected";

  // Closing the tab mid-ingest would cut a copy/proxy off halfway.
  useEffect(() => {
    if (!running) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const addSources = (sources) => {
    if (sources.length === 0) {
      setPickError("No videos or numbered image sequences found there.");
      return;
    }
    setPickError("");
    setQueue((prev) => [
      ...prev,
      ...sources.map((source) => {
        const { shot, ambiguous } = matchShot(source.matchNames, sortedShots);
        return {
          source,
          shotId: shot?.id ?? SKIP,
          ambiguous: ambiguous.map((s) => s.shotCode),
          status: "queued",
          stage: "",
          fraction: null,
          message: "",
        };
      }),
    ]);
  };

  const pickFiles = async () => {
    try {
      const handles = await window.showOpenFilePicker({
        id: FOOTAGE_PICKER_ID,
        multiple: true,
        types: [{ description: "Video", accept: { "video/*": [".mov", ".mp4", ".mxf", ".avi", ".m4v"] } }],
      });
      addSources(sourcesFromFiles(await Promise.all(handles.map((h) => h.getFile()))));
    } catch (err) {
      if (err?.name !== "AbortError") setPickError(`Couldn't read those files: ${err?.message || err}`);
    }
  };

  const pickFolder = async () => {
    try {
      const dir = await window.showDirectoryPicker({ id: FOOTAGE_FOLDER_PICKER_ID, mode: "read" });
      setPickError("Scanning folder…");
      addSources(await sourcesFromFolder(dir));
    } catch (err) {
      setPickError(err?.name === "AbortError" ? "" : `Couldn't read that folder: ${err?.message || err}`);
    }
  };

  const updateRow = (id, patch) =>
    setQueue((prev) => prev.map((r) => (r.source.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id) => setQueue((prev) => prev.filter((r) => r.source.id !== id));

  // Several sources aimed at one shot: each would replace the last as the
  // shot's plate (all of them still get copied into 00_plates/).
  const targetCounts = useMemo(() => {
    const counts = {};
    for (const r of queue) if (r.shotId && r.status !== "done") counts[r.shotId] = (counts[r.shotId] ?? 0) + 1;
    return counts;
  }, [queue]);

  const ready = queue.filter((r) => r.shotId && (r.status === "queued" || r.status === "error"));

  const runIngest = async () => {
    if (running || ready.length === 0 || !connected) return;
    setRunning(true);
    try {
      if (!(await ensurePermission(folder.rootHandle))) {
        setPickError("Couldn't get access to the project folder.");
        return;
      }
      // One at a time: proxying runs in ffmpeg.wasm, which can't take two
      // big jobs at once without running out of memory.
      for (const row of ready) {
        const id = row.source.id;
        const shot = shotsById[row.shotId];
        if (!shot) {
          updateRow(id, { status: "error", message: "That shot no longer exists." });
          continue;
        }
        if (!padScene(shot.scene)) {
          updateRow(id, { status: "error", message: `${shot.shotCode} isn't in a scene yet, so it has no folder.` });
          continue;
        }
        updateRow(id, { status: "running", stage: "Preparing shot folder…", fraction: null, message: "" });
        try {
          await ensureShotFolders(shot);
          const result = await ingestPlate(folder.rootHandle, {
            scene: padScene(shot.scene),
            shotCode: shot.shotCode,
            source: row.source,
            onProgress: (stage, fraction) => updateRow(id, { stage, fraction }),
          });
          patchShot(shot.id, { plate: result.plate, ...(result.thumbnail ? { thumbnail: result.thumbnail } : {}) });
          updateRow(id, {
            status: result.warning ? "warning" : "done",
            message: result.warning,
            thumbnail: result.thumbnail,
            stage: "",
            fraction: null,
          });
        } catch (err) {
          console.error(`Ingest of ${row.source.name} failed:`, err);
          updateRow(id, { status: "error", message: err?.message || String(err), stage: "", fraction: null });
        }
      }
    } finally {
      setRunning(false);
    }
  };

  const clearFinished = () => setQueue((prev) => prev.filter((r) => r.status !== "done" && r.status !== "warning"));

  const ingested = useMemo(
    () =>
      shots
        .filter((s) => s.plate)
        .sort((a, b) => (b.plate.importedAt ?? "").localeCompare(a.plate.importedAt ?? "")),
    [shots]
  );

  const openViewer = (shot) => navigate(`/shot/${encodeURIComponent(shot.shotCode)}?view=plate`);

  return (
    <div className="ingest" hidden={hidden}>
      <div className="card ingest-intake">
        <div className="ingest-intake-top">
          <div className="ingest-intake-text">
            <span className="label">Ingest footage</span>
            <span className="ingest-hint">
              File and folder names are matched to shot codes (e.g. <span className="mono">GOTP_SC002_010_plate.mov</span>{" "}
              → <span className="mono">002_010</span>). Each match is copied into the shot's{" "}
              <span className="mono">00_plates/</span>, gets a review proxy, and becomes the shot's thumbnail.
            </span>
          </div>
          <div className="ingest-intake-actions">
            <span className={`btn btn-secondary${running ? " btn-disabled" : ""}`} onClick={running ? undefined : pickFiles}>
              Add Video Files…
            </span>
            <span className={`btn btn-secondary${running ? " btn-disabled" : ""}`} onClick={running ? undefined : pickFolder}>
              Add Folder…
            </span>
          </div>
        </div>
        {pickError && <span className="ingest-pick-error">{pickError}</span>}
        {!connected && (
          <span className="ingest-pick-error">
            Connect the project folder (banner above, or Choose Destination Folder on the Shots tab) to ingest.
          </span>
        )}

        {queue.length > 0 && (
          <>
            <div className="ingest-queue">
              {queue.map((row) => {
                const { source } = row;
                const shot = shotsById[row.shotId];
                const locked = running || row.status === "running" || row.status === "done" || row.status === "warning";
                return (
                  <div className={`ingest-row ingest-row-${row.status}`} key={source.id}>
                    <div className="ingest-row-thumb">
                      {row.thumbnail ? (
                        <img src={row.thumbnail} alt="" onClick={() => shot && openViewer(shot)} title="Open in shot viewer" />
                      ) : (
                        <span className="mono">{source.kind === "video" ? "VID" : "SEQ"}</span>
                      )}
                    </div>
                    <div className="ingest-row-source">
                      <span className="ingest-row-name mono" title={source.matchNames.join(" / ")}>
                        {source.name}
                      </span>
                      <span className="ingest-row-detail">
                        {source.kind === "sequence" ? `${source.frames} frames · ` : ""}
                        {formatBytes(source.size)}
                      </span>
                    </div>
                    <span className="ingest-row-arrow">→</span>
                    <div className="ingest-row-target">
                      <select
                        className="report-edit-input mono ingest-shot-select"
                        value={row.shotId}
                        disabled={locked}
                        onChange={(e) => updateRow(source.id, { shotId: e.target.value, ambiguous: [] })}
                      >
                        <option value={SKIP}>— skip —</option>
                        {sortedShots.map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.shotCode}
                          </option>
                        ))}
                      </select>
                      <span className="ingest-row-flags">
                        {!row.shotId && row.ambiguous.length > 0 && (
                          <span className="pill pill-warning">Matches {row.ambiguous.join(", ")} — pick one</span>
                        )}
                        {!row.shotId && row.ambiguous.length === 0 && row.status === "queued" && (
                          <span className="pill">No shot matched</span>
                        )}
                        {shot && row.status === "queued" && shot.plate && (
                          <span className="pill pill-warning" title={`Current plate: ${shot.plate.name}`}>
                            Replaces current plate
                          </span>
                        )}
                        {shot && row.status === "queued" && !shot.foldersCreatedAt && (
                          <span className="pill">Creates shot folders</span>
                        )}
                        {shot && targetCounts[shot.id] > 1 && row.status === "queued" && (
                          <span className="pill pill-warning">{targetCounts[shot.id]} files → this shot</span>
                        )}
                      </span>
                    </div>
                    <div className="ingest-row-status">
                      {row.status === "running" && (
                        <span className="ingest-progress">
                          {row.stage}
                          {row.fraction != null ? ` ${Math.round(row.fraction * 100)}%` : ""}
                        </span>
                      )}
                      {row.status === "done" && <span className="pill pill-success">Ingested</span>}
                      {row.status === "warning" && <span className="pill pill-warning">Ingested, no proxy</span>}
                      {row.status === "error" && <span className="pill pill-danger">Failed</span>}
                      {row.message && <span className="ingest-row-message">{row.message}</span>}
                    </div>
                    {!locked && (
                      <span className="ingest-row-remove" onClick={() => removeRow(source.id)} title="Remove from list">
                        ×
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="ingest-queue-actions">
              {running && <span className="ingest-hint">Keep this page open until the ingest finishes.</span>}
              {queue.some((r) => r.status === "done" || r.status === "warning") && !running && (
                <span className="btn btn-secondary" onClick={clearFinished}>
                  Clear Finished
                </span>
              )}
              <span
                className={`btn btn-primary${!running && ready.length && connected ? "" : " btn-disabled"}`}
                onClick={runIngest}
              >
                {running ? "Ingesting…" : `Ingest ${ready.length} file${ready.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="ingest-library">
        <div className="ingest-library-header">
          <span className="label">Ingested footage</span>
          <span className="pill mono">{ingested.length}</span>
        </div>
        {ingested.length === 0 ? (
          <div className="card post-reports-empty">No footage ingested yet.</div>
        ) : (
          <div className="ingest-grid">
            {ingested.map((shot) => (
              <div className="card ingest-card" key={shot.id}>
                <div
                  className="ingest-card-thumb"
                  onClick={() => openViewer(shot)}
                  title="Open in shot viewer"
                >
                  {shot.thumbnail ? <img src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} /> : <span>No proxy</span>}
                  <span className="ingest-card-play">▶</span>
                </div>
                <div className="ingest-card-body">
                  <div className="ingest-card-title">
                    <span className="report-shot-code">{shot.shotCode}</span>
                    <span className="ingest-card-date mono">
                      {shot.plate.importedAt
                        ? new Date(shot.plate.importedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : ""}
                    </span>
                  </div>
                  <span className="ingest-card-plate mono" title={shot.plate.name}>
                    {shot.plate.name}
                    {shot.plate.kind === "seq" && shot.plate.frames ? ` · ${shot.plate.frames} fr` : ""}
                  </span>
                  <FootageNotes
                    compact
                    notes={shot.footageNotes ?? []}
                    onChange={(footageNotes) => patchShot(shot.id, { footageNotes })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
