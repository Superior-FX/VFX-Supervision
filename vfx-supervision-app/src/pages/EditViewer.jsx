import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import FolderStatusBanner from "../components/FolderStatusBanner.jsx";
import { taskStatusInfo } from "../data/taskStatus.js";
import { padScene } from "../lib/folderPath.js";
import { formatVersion, getPlateFolders, getTaskReviewFolder, readFileFrom } from "../lib/fsAccess.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByShotCode } from "../lib/sortShots.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import { useProjectFolder } from "../lib/useProjectFolder.js";
import "./EditViewer.css";

// A little editor: every shot's current submission strung together in shot
// code order, to watch the cut for continuity. Two <video> elements take
// turns — one plays while the other already holds the next shot — so the
// cut from shot to shot doesn't flash black while a file loads.

const FPS = 24; // review proxies are always encoded at 24fps

// Which submission stands in for a shot: its Compositing task if that has
// a proxy (that's the finished picture), otherwise whichever task was
// submitted most recently.
function pickTask(shot) {
  const submitted = shot.tasks.filter((t) => t.reviewFile);
  if (!submitted.length) return null;
  const comp = submitted.find((t) => t.type === "Compositing");
  if (comp) return comp;
  const lastSubmitted = (t) => {
    const h = t.versionHistory ?? [];
    return h[h.length - 1]?.submittedAt ?? t.submittedAt ?? "";
  };
  return [...submitted].sort((a, b) => lastSubmitted(b).localeCompare(lastSubmitted(a)))[0];
}

function timecode(seconds) {
  const total = Math.max(0, Math.floor(seconds * FPS + 1e-6));
  const ff = total % FPS;
  const s = Math.floor(total / FPS);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`;
}

// A shot that hasn't loaded after this long (e.g. Google Drive still
// streaming it down) is left out instead of holding up the whole cut.
const CLIP_TIMEOUT_MS = 45_000;

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function durationOf(url) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

// Transport buttons never take focus, so Space only toggles play once.
const noFocus = (e) => e.preventDefault();

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

function LoadingBar({ progress }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="edit-loading">
      <span>
        Loading shots… {progress.done} of {progress.total}
      </span>
      <div className="edit-loading-bar">
        <div className="edit-loading-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function EditViewer() {
  const project = useActiveProject();
  const [shots] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const folder = useProjectFolder(project);
  const [sceneFilter, setSceneFilter] = useState("");
  const [usePlates, setUsePlates] = useLocalStorageState(scopedKey("vfx-supe-edit-plates", project?.id), false);

  // One entry per shot in the cut, in shot code order.
  const entries = useMemo(() => {
    const list = [];
    if (!project) return list;
    for (const shot of sortByShotCode(shots)) {
      if (!shot.shotCode || (sceneFilter && shot.scene !== sceneFilter)) continue;
      const task = pickTask(shot);
      if (task) list.push({ key: `${shot.id}:${task.id}:${task.reviewFile}`, shot, task, kind: "task" });
      else if (usePlates && shot.plate?.proxy) list.push({ key: `${shot.id}:plate:${shot.plate.proxy}`, shot, task: null, kind: "plate" });
    }
    return list;
  }, [project, shots, sceneFilter, usePlates]);
  const sceneOptions = useMemo(() => [...new Set(shots.map((s) => s.scene).filter(Boolean))].sort(), [shots]);
  const entriesKey = entries.map((e) => e.key).join("|");

  // Load every clip's file and length. Clips that aren't on this computer
  // (e.g. still syncing from Google Drive) are listed but left out of the cut.
  const [loaded, setLoaded] = useState({ key: "", clips: [], missing: [] });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  useEffect(() => {
    if (folder.status !== "connected" || !entries.length) {
      setLoaded({ key: entriesKey, clips: [], missing: [] });
      return;
    }
    let cancelled = false;
    const urls = [];
    setLoading(true);
    setProgress({ done: 0, total: entries.length });
    const tick = () => !cancelled && setProgress((p) => ({ ...p, done: p.done + 1 }));
    (async () => {
      const results = await Promise.all(
        entries.map(async (entry) => {
          try {
            return await withTimeout(loadEntry(entry), CLIP_TIMEOUT_MS);
          } catch (err) {
            return {
              ...entry,
              error:
                err?.name === "NotFoundError"
                  ? "Not on this computer yet"
                  : err?.name === "TimeoutError"
                    ? "Took too long to load (still syncing?)"
                    : "Couldn't load",
            };
          } finally {
            tick();
          }
        })
      );
      if (cancelled) return;
      setLoaded({ key: entriesKey, clips: results.filter((r) => r.url), missing: results.filter((r) => !r.url) });
      setLoading(false);
    })();

    async function loadEntry(entry) {
      const scene = padScene(entry.shot.scene);
      const shotCode = entry.shot.shotCode;
      let file;
      if (entry.kind === "plate") {
        const { reviewDir } = await getPlateFolders(folder.rootHandle, { scene, shotCode }, { create: false });
        file = await readFileFrom(reviewDir, entry.shot.plate.proxy);
      } else {
        const dir = await getTaskReviewFolder(folder.rootHandle, { scene, shotCode, taskType: entry.task.type }, { create: false });
        if (!dir) throw new Error("no review folder");
        file = await readFileFrom(dir, entry.task.reviewFile);
            }
            const url = URL.createObjectURL(file);
            urls.push(url);
            const duration = await durationOf(url);
            if (!duration) throw new Error("couldn't read the video's length");
            return { ...entry, url, duration };
    }
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [entriesKey, folder.status, folder.rootHandle]);

  const clips = loaded.clips;
  const offsets = useMemo(() => {
    const out = [];
    let t = 0;
    for (const c of clips) {
      out.push(t);
      t += c.duration;
    }
    return out;
  }, [clips]);
  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);

  // ---- Playback ----
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const videoRefs = [useRef(null), useRef(null)];
  const seekTarget = useRef(0);
  const shellRef = useRef(null);
  const listRef = useRef(null);
  const scrubbing = useRef(false);

  useEffect(() => {
    setIdx(0);
    setLocalTime(0);
    setPlaying(false);
    seekTarget.current = 0;
  }, [loaded.key]);

  const activeVideo = () => videoRefs[idx % 2].current;

  // Slot idx%2 shows the current clip; the other slot preloads the next one.
  const slotClip = (slot) => (idx % 2 === slot ? idx : idx + 1);

  // Whenever the current clip changes, put it at its start point and keep
  // playing if we were.
  useEffect(() => {
    const active = videoRefs[idx % 2].current;
    const other = videoRefs[(idx + 1) % 2].current;
    if (!active || !clips[idx]) return;
    other?.pause();
    if (other) other.currentTime = 0;
    active.currentTime = seekTarget.current;
    setLocalTime(seekTarget.current);
    seekTarget.current = 0;
    if (playing) active.play().catch(() => setPlaying(false));
  }, [idx, clips]);

  useEffect(() => {
    const active = activeVideo();
    if (!active) return;
    if (playing) active.play().catch(() => setPlaying(false));
    else active.pause();
  }, [playing]);

  // Smooth playhead while playing.
  useEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => {
      const v = activeVideo();
      if (v) setLocalTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, idx]);

  const seekTo = useCallback(
    (clipIndex, time = 0) => {
      if (!clips.length) return;
      const ci = Math.max(0, Math.min(clips.length - 1, clipIndex));
      const t = Math.max(0, Math.min(clips[ci].duration - 1 / FPS, time));
      if (ci === idx) {
        const v = videoRefs[idx % 2].current;
        if (v) v.currentTime = t;
        setLocalTime(t);
      } else {
        seekTarget.current = t;
        setIdx(ci);
      }
    },
    [clips, idx]
  );

  const seekGlobal = (t) => {
    if (!clips.length) return;
    let ci = clips.length - 1;
    for (let i = 0; i < clips.length; i++) {
      if (t < offsets[i] + clips[i].duration) {
        ci = i;
        break;
      }
    }
    seekTo(ci, t - offsets[ci]);
  };

  const onEnded = (clipIndex) => {
    if (clipIndex !== idx) return;
    if (idx < clips.length - 1) {
      seekTarget.current = 0;
      setIdx(idx + 1);
    } else {
      setPlaying(false);
    }
  };

  const currentLocal = () => activeVideo()?.currentTime ?? localTime;
  const nextShot = () => seekTo(idx + 1, 0);
  // Like an editor's "previous edit": back to the start of this shot, or to
  // the previous shot if already at the start.
  const prevShot = () => (currentLocal() > 0.5 ? seekTo(idx, 0) : seekTo(idx - 1, 0));
  const stepFrames = (n) => {
    setPlaying(false);
    const t = currentLocal() + n / FPS;
    if (t >= clips[idx].duration - 1e-3 && idx < clips.length - 1) seekTo(idx + 1, 0);
    else if (t < 0 && idx > 0) seekTo(idx - 1, clips[idx - 1].duration - 1 / FPS);
    else seekTo(idx, t);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else shellRef.current?.requestFullscreen?.();
  };

  // Hotkeys.
  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    if (!clips.length || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const handled = {
      " ": () => setPlaying((p) => !p),
      k: () => setPlaying(false),
      ArrowDown: nextShot,
      PageDown: nextShot,
      ArrowUp: prevShot,
      PageUp: prevShot,
      ArrowRight: () => stepFrames(e.shiftKey ? FPS : 1),
      ArrowLeft: () => stepFrames(e.shiftKey ? -FPS : -1),
      Home: () => seekTo(0, 0),
      End: () => seekTo(clips.length - 1, 0),
      f: toggleFullscreen,
    }[e.key];
    if (handled) {
      e.preventDefault();
      handled();
    }
  };
  useEffect(() => {
    const h = (e) => keyHandler.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Keep the current shot visible in the shot list.
  useEffect(() => {
    listRef.current?.querySelector(".edit-shot-row.active")?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  // Timeline click/drag to scrub.
  const trackRef = useRef(null);
  const scrubAt = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seekGlobal(frac * totalDuration);
  };

  const current = clips[idx];
  const globalTime = (offsets[idx] ?? 0) + localTime;
  const showBanner = entries.length > 0;

  // The folder check normally takes a moment; if it doesn't, say so rather
  // than sitting on "Loading…".
  const [folderSlow, setFolderSlow] = useState(false);
  useEffect(() => {
    setFolderSlow(false);
    if (folder.status !== "loading") return;
    const id = setTimeout(() => setFolderSlow(true), 5000);
    return () => clearTimeout(id);
  }, [folder.status]);

  if (!project) {
    return (
      <div className="edit-viewer">
        <div className="edit-header">
          <span className="edit-title">EDIT VIEWER</span>
        </div>
        <div className="card edit-empty">
          No project is open in this window. Pick one on the <Link to="/">Home</Link> page, then come back.
        </div>
      </div>
    );
  }

  return (
    <div className="edit-viewer">
      <div className="edit-header">
        <span className="edit-title">EDIT VIEWER</span>
        <div className="edit-header-actions">
          <select className="edit-select" value={sceneFilter} onChange={(e) => setSceneFilter(e.target.value)}>
            <option value="">All scenes</option>
            {sceneOptions.map((sc) => (
              <option key={sc} value={sc}>
                SC{sc}
              </option>
            ))}
          </select>
          <label className="edit-toggle" title="Shots with nothing submitted yet play their plate instead">
            <input type="checkbox" checked={usePlates} onChange={(e) => setUsePlates(e.target.checked)} />
            Fill gaps with plates
          </label>
          <span className={`pill${loading ? " pill-accent" : ""}`}>
            {loading
              ? `Loading ${progress.done} of ${progress.total}…`
              : `${clips.length} shot${clips.length === 1 ? "" : "s"} · ${timecode(totalDuration)}`}
          </span>
        </div>
      </div>

      <FolderStatusBanner
        folder={folder}
        show={showBanner}
        showCode={project?.showCode}
        impact="the submitted shots can't be loaded into the edit"
      />

      {entries.length === 0 ? (
        <div className="card edit-empty">
          No submitted shots yet{sceneFilter ? ` in SC${sceneFilter}` : ""}. Once artists submit from Upload Shot, their
          latest versions show up here in shot order.
        </div>
      ) : (
        <div className="edit-body">
          <div className="edit-main">
            <div className="edit-player" ref={shellRef}>
              <div className="edit-screen" onClick={() => clips.length && setPlaying((p) => !p)}>
                {[0, 1].map((slot) => {
                  const ci = slotClip(slot);
                  const clip = clips[ci];
                  return (
                    <video
                      key={slot}
                      ref={videoRefs[slot]}
                      src={clip?.url}
                      className={ci === idx ? "edit-video active" : "edit-video"}
                      preload="auto"
                      playsInline
                      onEnded={() => onEnded(ci)}
                    />
                  );
                })}
                {!clips.length && (
                  <div className="edit-screen-message" onClick={(e) => e.stopPropagation()}>
                    {folder.status === "connected" ? (
                      loading ? (
                        <LoadingBar progress={progress} />
                      ) : (
                        "None of these shots are on this computer yet."
                      )
                    ) : folder.status === "needs-permission" ? (
                      <>
                        <span>Chrome needs your OK to read the project folder again.</span>
                        <button className="btn btn-primary" onClick={() => folder.grantAccess().catch(() => {})}>
                          Allow Access
                        </button>
                      </>
                    ) : folder.status === "missing" ? (
                      <>
                        <span>This browser isn't connected to the {project?.showCode || "project"} folder yet.</span>
                        <button className="btn btn-primary" onClick={() => folder.reconnect().catch(() => {})}>
                          Reconnect Folder…
                        </button>
                      </>
                    ) : folder.status === "unsupported" ? (
                      "Playing shots from the project folder needs Chrome or Edge."
                    ) : (
                      folderSlow
                        ? "Still checking this browser for the project folder… If this doesn't clear, reload the page (Ctrl+R)."
                        : "Checking the project folder…"
                    )}
                  </div>
                )}
                {current && (
                  <div className="edit-burnin">
                    <span className="mono">{current.shot.shotCode}</span>
                    <span>
                      {current.kind === "plate" ? "Plate" : `${current.task.type} ${formatVersion(current.task.version)}`}
                    </span>
                  </div>
                )}
              </div>

              <div className="edit-transport">
                <button onMouseDown={noFocus} className="edit-btn" onClick={prevShot} disabled={!clips.length} title="Previous shot (↑)">
                  ⏮
                </button>
                <button onMouseDown={noFocus} className="edit-btn" onClick={() => stepFrames(-1)} disabled={!clips.length} title="Back one frame (←)">
                  ◀︎
                </button>
                <button onMouseDown={noFocus} className="edit-btn edit-btn-play" onClick={() => setPlaying((p) => !p)} disabled={!clips.length} title="Play / pause (Space)">
                  {playing ? "❚❚" : "▶"}
                </button>
                <button onMouseDown={noFocus} className="edit-btn" onClick={() => stepFrames(1)} disabled={!clips.length} title="Forward one frame (→)">
                  ▶︎
                </button>
                <button onMouseDown={noFocus} className="edit-btn" onClick={nextShot} disabled={!clips.length} title="Next shot (↓)">
                  ⏭
                </button>
                <span className="edit-tc mono">
                  {timecode(globalTime)} <span className="edit-tc-dim">/ {timecode(totalDuration)}</span>
                </span>
                {current && (
                  <span className="edit-tc mono edit-tc-dim">
                    Shot {idx + 1}/{clips.length} · frame {Math.floor(localTime * FPS) + 1}
                  </span>
                )}
                <button onMouseDown={noFocus} className="edit-btn edit-btn-right" onClick={toggleFullscreen} title="Full screen (F)">
                  ⛶
                </button>
              </div>

              <div
                className="edit-track"
                ref={trackRef}
                onPointerDown={(e) => {
                  if (!clips.length) return;
                  scrubbing.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  scrubAt(e.clientX);
                }}
                onPointerMove={(e) => scrubbing.current && scrubAt(e.clientX)}
                onPointerUp={() => (scrubbing.current = false)}
              >
                {clips.map((clip, i) => {
                  const status = clip.task ? taskStatusInfo(clip.task.status) : null;
                  return (
                    <div
                      key={clip.key}
                      className={`edit-clip${i === idx ? " active" : ""}${clip.kind === "plate" ? " is-plate" : ""}`}
                      style={{ flexGrow: clip.duration }}
                      title={`${clip.shot.shotCode} · ${clip.kind === "plate" ? "Plate" : `${clip.task.type} ${formatVersion(clip.task.version)} · ${status.label}`}`}
                    >
                      {clip.shot.thumbnail && <img src={clip.shot.thumbnail} alt="" draggable={false} />}
                      <span className="edit-clip-label mono">{clip.shot.shotCode}</span>
                      <span className={`edit-clip-status${status?.tone ? ` tone-${status.tone}` : ""}`} />
                    </div>
                  );
                })}
                {totalDuration > 0 && <div className="edit-playhead" style={{ left: `${(globalTime / totalDuration) * 100}%` }} />}
              </div>
            </div>

            <div className="edit-keys">
              <span><kbd>Space</kbd> play / pause</span>
              <span><kbd>↑</kbd> <kbd>↓</kbd> previous / next shot</span>
              <span><kbd>←</kbd> <kbd>→</kbd> one frame</span>
              <span><kbd>Shift</kbd>+<kbd>←</kbd> <kbd>→</kbd> one second</span>
              <span><kbd>Home</kbd> <kbd>End</kbd> first / last shot</span>
              <span><kbd>F</kbd> full screen</span>
            </div>
          </div>

          <div className="card edit-shots" ref={listRef}>
            <span className="label edit-shots-title">Shots in the cut</span>
            {clips.map((clip, i) => {
              const status = clip.task ? taskStatusInfo(clip.task.status) : null;
              return (
                <div
                  key={clip.key}
                  className={`edit-shot-row${i === idx ? " active" : ""}`}
                  onClick={() => seekTo(i, 0)}
                >
                  {clip.shot.thumbnail ? (
                    <img className="edit-shot-thumb" src={clip.shot.thumbnail} alt="" />
                  ) : (
                    <div className="edit-shot-thumb" />
                  )}
                  <div className="edit-shot-info">
                    <span className="mono edit-shot-code">{clip.shot.shotCode}</span>
                    <span className="edit-shot-sub">
                      {clip.kind === "plate" ? "Plate" : `${clip.task.type} ${formatVersion(clip.task.version)}`} ·{" "}
                      {timecode(clip.duration)}
                    </span>
                  </div>
                  {status ? (
                    <span className={`pill${status.tone ? ` pill-${status.tone}` : ""} edit-shot-pill`}>{status.label}</span>
                  ) : (
                    <span className="pill edit-shot-pill">Plate</span>
                  )}
                </div>
              );
            })}
            {loaded.missing.length > 0 && (
              <>
                <span className="label edit-shots-title">Left out</span>
                {loaded.missing.map((m) => (
                  <div key={m.key} className="edit-shot-row is-missing">
                    <div className="edit-shot-info">
                      <span className="mono edit-shot-code">{m.shot.shotCode}</span>
                      <span className="edit-shot-sub">{m.error}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
