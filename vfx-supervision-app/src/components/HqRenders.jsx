import { useEffect, useState } from "react";
import { padScene } from "../lib/folderPath.js";
import { copyFileInto, formatVersion, getTaskUploadFolder } from "../lib/fsAccess.js";
import { generateFullResFrames, generateHQSequenceProxy, generateHQVideoProxy, HQ_MAX_WIDTH } from "../lib/ffmpeg.js";
import { findTaskSource, hqProxyName, uhqFolderName, uhqFrameName, uhqLabel } from "../lib/hqProxy.js";
import { useEnterKey } from "../lib/useEnterKey.js";
import "./HqRenders.css";

const pad4 = (frame) => String(frame + 1).padStart(4, "0");

/**
 * Supervisor-only HQ (4K) and 6K/8K review renders for one submission.
 * Nothing is generated without an Accept; uploads never make these.
 *
 * Returns the pieces a page places itself:
 *   buttons   — "Generate HQ" / "6K/8K…"
 *   dialog    — the confirm / progress / error pop-up (render it inside the
 *               player's actions so it also shows in full screen)
 *   uhqRenders, loadUhqFrame, requestDeleteUhq — for <AnnotatedPlayer>
 */
export function useHqRenders({ shot, task, rootHandle, reviewDir, folderConnected, currentFrame, frameCount, patchTask }) {
  const [job, setJob] = useState(null);
  const version = task?.version ?? null;
  const hqFile = task?.hqProxies?.[version] ?? null;
  const uhqRenders = (task?.uhqRenders ?? [])
    .filter((r) => r.version === version)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((r) => ({ ...r, label: uhqLabel(r) }));

  const ready = Boolean(task?.reviewFile && reviewDir && folderConnected && version != null);
  const running = job?.status === "running";

  const locateSource = async () => {
    const renderDir = await getTaskUploadFolder(rootHandle, {
      scene: padScene(shot.scene),
      shotCode: shot.shotCode,
      taskType: task.type,
    });
    if (!renderDir) throw new Error(`No render folder is set up for "${task.type}".`);
    return findTaskSource(renderDir, task);
  };

  const open = async (kind) => {
    setJob({ kind, status: "finding" });
    try {
      const source = await locateSource();
      const sourceFrames = source.kind === "seq" ? source.frames.length : frameCount || null;
      const last = Math.max(0, (sourceFrames ?? 1) - 1);
      const from = Math.min(currentFrame, last);
      setJob({
        kind,
        status: "confirm",
        source,
        sourceFrames,
        mode: "single",
        from: from + 1,
        to: Math.min(from + 12, last) + 1,
      });
    } catch (err) {
      setJob({ kind, status: "error", error: err?.message || String(err) });
    }
  };

  const progress = (stage, fraction) =>
    setJob((j) => (j ? { ...j, stage, fraction: fraction ?? j.fraction ?? null } : j));

  const runHq = async (j) => {
    const blob =
      j.source.kind === "vid"
        ? await generateHQVideoProxy(j.source.file, { onProgress: progress })
        : await generateHQSequenceProxy(j.source.frames, { onProgress: progress });
    const name = hqProxyName(shot.shotCode, version, j.source.kind);
    progress("Saving HQ proxy…", null);
    await copyFileInto(reviewDir, name, blob);
    patchTask((t) => ({ ...t, hqProxies: { ...(t.hqProxies ?? {}), [version]: name } }));
  };

  const uhqRange = (j) => {
    const lastIndex = Math.max(0, (j.sourceFrames ?? frameCount ?? 1) - 1);
    if (j.mode === "full") return { start: 0, end: lastIndex, full: true };
    const from = Math.max(0, Math.min(lastIndex, Number(j.from) - 1));
    if (j.mode === "single") return { start: from, end: from, full: false };
    const to = Math.max(0, Math.min(lastIndex, Number(j.to) - 1));
    return { start: Math.min(from, to), end: Math.max(from, to), full: false };
  };

  const runUhq = async (j) => {
    const range = uhqRange(j);
    const folder = uhqFolderName(shot.shotCode, version, j.source.kind, range);
    const dir = await reviewDir.getDirectoryHandle(folder, { create: true });
    try {
      await generateFullResFrames(j.source, {
        ...range,
        onProgress: progress,
        onFrame: (i, blob) => copyFileInto(dir, uhqFrameName(shot.shotCode, version, i), blob),
      });
    } catch (err) {
      // Don't leave a half-written render on disk.
      await reviewDir.removeEntry(folder, { recursive: true }).catch(() => {});
      throw err;
    }
    patchTask((t) => ({
      ...t,
      uhqRenders: [
        ...(t.uhqRenders ?? []).filter((r) => r.folder !== folder),
        { id: crypto.randomUUID(), version, folder, ...range, createdAt: new Date().toISOString() },
      ],
    }));
  };

  const accept = async () => {
    if (!job || job.status !== "confirm") return;
    const j = job;
    if (j.kind === "delete") {
      try {
        await reviewDir.removeEntry(j.render.folder, { recursive: true }).catch((err) => {
          if (err?.name !== "NotFoundError") throw err;
        });
        patchTask((t) => ({ ...t, uhqRenders: (t.uhqRenders ?? []).filter((r) => r.id !== j.render.id) }));
        setJob(null);
      } catch (err) {
        setJob({ ...j, status: "error", error: err?.message || String(err) });
      }
      return;
    }
    setJob({ ...j, status: "running", stage: "Starting…", fraction: null, startedAt: Date.now() });
    try {
      if (j.kind === "hq") await runHq(j);
      else await runUhq(j);
      setJob(null);
    } catch (err) {
      console.error("Review render failed:", err);
      setJob({ ...j, status: "error", error: err?.message || String(err) });
    }
  };

  const cancel = () => {
    if (!running) setJob(null);
  };

  const requestDeleteUhq = (render) => setJob({ kind: "delete", status: "confirm", render });

  const loadUhqFrame = async (render, frame) => {
    const dir = await reviewDir.getDirectoryHandle(render.folder);
    const file = await (await dir.getFileHandle(uhqFrameName(shot.shotCode, render.version, frame))).getFile();
    return URL.createObjectURL(file);
  };

  const buttons = (
    <div className="hq-buttons">
      <button
        className="aplayer-btn"
        disabled={!ready || Boolean(job)}
        onClick={() => open("hq")}
        title={hqFile ? `Current HQ: ${hqFile}` : "Make a 4K HQ proxy from the submitted render"}
      >
        {hqFile ? "Regenerate HQ" : "Generate HQ"}
      </button>
      <button
        className="aplayer-btn"
        disabled={!ready || Boolean(job)}
        onClick={() => open("uhq")}
        title="Full-resolution stills for close inspection"
      >
        6K/8K…
      </button>
    </div>
  );

  const dialog = job && (
    <RenderDialog
      job={job}
      setJob={setJob}
      onAccept={accept}
      onCancel={cancel}
      hqFile={hqFile}
      range={job.kind === "uhq" && job.status === "confirm" ? uhqRange(job) : null}
      shotLabel={`${shot?.shotCode} ${version != null ? formatVersion(version) : ""}`}
    />
  );

  return { buttons, dialog, uhqRenders, loadUhqFrame, requestDeleteUhq };
}

// "1:05" style.
function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Estimated time left from how long it has taken to get this far. Needs a
// little progress first, or the guess swings wildly.
function timeLeftLabel(job, now) {
  const elapsed = now - job.startedAt;
  const f = job.fraction;
  if (f == null || f < 0.04 || elapsed < 4000) return "Estimating time left…";
  if (f >= 1) return "Finishing up…";
  const remaining = (elapsed * (1 - f)) / f;
  if (remaining < 10_000) return "A few seconds left";
  return `About ${formatDuration(remaining)} left`;
}

function RenderDialog({ job, setJob, onAccept, onCancel, hqFile, range, shotLabel }) {
  // Re-render once a second while running so the elapsed/estimate tick.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (job.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [job.status]);

  useEnterKey(() => {
    if (job.status === "confirm") onAccept();
    else if (job.status === "error") onCancel();
  });

  const title =
    job.kind === "hq" ? "Generate HQ proxy" : job.kind === "uhq" ? "Render 6K/8K frames" : "Delete 6K/8K render";

  const frameCount = range ? range.end - range.start + 1 : 0;

  return (
    <div className="hq-backdrop" onClick={onCancel}>
      <div className="hq-dialog card" onClick={(e) => e.stopPropagation()}>
        <div className="hq-dialog-title">
          {title} <span className="mono hq-dialog-shot">{shotLabel}</span>
        </div>

        {job.status === "finding" && <p className="hq-dialog-text">Looking for the submitted render…</p>}

        {job.status === "confirm" && job.kind === "delete" && (
          <p className="hq-dialog-text">
            Delete the {job.render.label.toLowerCase()} 6K/8K render (<span className="mono">{job.render.folder}</span>)
            from disk? You can render it again later.
          </p>
        )}

        {job.status === "confirm" && job.kind !== "delete" && (
          <>
            <p className="hq-dialog-text">
              From: <span className="mono">{job.source.label}</span>
            </p>

            {job.kind === "hq" && (
              <>
                <p className="hq-dialog-text">
                  Makes a high-quality proxy at full resolution, capped at 4K UHD ({HQ_MAX_WIDTH}px wide).
                  {hqFile && " It replaces the current HQ for this version."} The normal proxy stays on disk.
                </p>
                <p className="hq-dialog-warning">
                  HQ playback is heavier than the normal proxy and may stutter or step slowly on less powerful
                  machines. Anyone can switch back to the normal proxy in the player. Encoding runs in the browser
                  and can take several minutes for a long shot.
                </p>
              </>
            )}

            {job.kind === "uhq" && (
              <>
                <div className="hq-modes">
                  {[
                    ["single", "Single frame"],
                    ["range", "Frame range"],
                    ["full", "Full range"],
                  ].map(([value, label]) => (
                    <label key={value} className={`hq-mode${job.mode === value ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name="uhq-mode"
                        checked={job.mode === value}
                        onChange={() => setJob({ ...job, mode: value })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {job.mode !== "full" && (
                  <div className="hq-range">
                    <label>
                      {job.mode === "single" ? "Frame" : "From"}
                      <input
                        type="number"
                        min={1}
                        max={job.sourceFrames ?? undefined}
                        value={job.from}
                        onChange={(e) => setJob({ ...job, from: e.target.value })}
                      />
                    </label>
                    {job.mode === "range" && (
                      <label>
                        To
                        <input
                          type="number"
                          min={1}
                          max={job.sourceFrames ?? undefined}
                          value={job.to}
                          onChange={(e) => setJob({ ...job, to: e.target.value })}
                        />
                      </label>
                    )}
                    {job.sourceFrames && <span className="hq-range-of mono">of {pad4(job.sourceFrames - 1)}</span>}
                  </div>
                )}
                <p className="hq-dialog-text">
                  {frameCount} frame{frameCount === 1 ? "" : "s"}
                  {range && !range.full && ` (F ${pad4(range.start)}${range.end !== range.start ? `–${pad4(range.end)}` : ""})`}
                  , saved as full-resolution JPEGs in this task's review folder — roughly{" "}
                  {Math.max(1, Math.round(frameCount * 3))}–{Math.max(1, Math.round(frameCount * 10))} MB.
                </p>
                <p className="hq-dialog-warning">
                  6K/8K is heavy: rendering can take a while, and playing more than a few frames back as motion may
                  not be smooth. A single frame or short range is the lightest option.
                </p>
              </>
            )}
          </>
        )}

        {job.status === "running" && (
          <div className="hq-progress">
            <span className="hq-dialog-text">{job.stage}</span>
            <div className={`hq-progress-bar${job.fraction == null ? " is-indeterminate" : ""}`}>
              <div style={{ width: `${Math.round((job.fraction ?? 0) * 100)}%` }} />
            </div>
            <div className="hq-eta">
              <span className="mono">{timeLeftLabel(job, now)}</span>
              <span className="mono hq-eta-elapsed">Elapsed {formatDuration(now - job.startedAt)}</span>
            </div>
            <span className="hq-dialog-hint">Keep this tab open until it finishes.</span>
          </div>
        )}

        {job.status === "error" && <p className="hq-dialog-error">{job.error}</p>}

        <div className="hq-dialog-actions">
          {job.status === "confirm" && (
            <>
              <button className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button className={`btn ${job.kind === "delete" ? "btn-danger" : "btn-primary"}`} onClick={onAccept}>
                {job.kind === "delete" ? "Delete" : "Accept"}
              </button>
            </>
          )}
          {(job.status === "error" || job.status === "finding") && (
            <button className="btn btn-secondary" onClick={onCancel}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
