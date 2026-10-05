import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./AnnotatedPlayer.css";

// Review proxies are always encoded at 24fps (see generateReviewProxy in
// lib/ffmpeg.js), so frame numbers are derived from that, not probed.
export const PROXY_FPS = 24;

export const ANNOTATION_COLORS = [
  { name: "Red", value: "#ff3b3b" },
  { name: "Yellow", value: "#ffd400" },
  { name: "Green", value: "#2ee86b" },
  { name: "Cyan", value: "#22d3ee" },
  { name: "White", value: "#ffffff" },
];

// Stroke width as a fraction of the frame's width, so a mark looks the same
// at any player size (and later, full screen).
const STROKE_WIDTH = 0.004;
// Points closer than this (in 0–1 frame space) to the previous one are
// dropped — keeps saved strokes small without visibly changing them.
const MIN_POINT_GAP = 0.002;
// Full-screen zoom ceiling (×). The proxy is 1280px wide, so past this it's
// only magnifying proxy pixels.
const MAX_ZOOM = 8;

const round4 = (n) => Math.round(n * 10000) / 10000;

export function formatFrame(frame) {
  return String(frame + 1).padStart(4, "0");
}

function drawStroke(ctx, stroke, w, h) {
  const pts = stroke.points;
  if (!pts.length) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = Math.max(2, STROKE_WIDTH * w);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * w, pts[0][1] * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
  ctx.stroke();
}

/**
 * Proxy player with per-frame freehand annotations.
 *
 * `annotations` is the list for the version being shown:
 *   [{ id, frame, strokes: [{ color, points: [[x, y], …] }], note }]
 * with x/y in 0–1 frame space. Pass `onChange` to make it editable; leave it
 * out for a read-only view (the artist side).
 *
 * The page's own pieces follow the player into full screen:
 * - `notes`: a node, or `(fullscreen) => node` so the page can render a
 *   compact version. Under the player normally; the bottom row in full screen.
 * - `actions`: buttons (save / approve…). Last under the player normally;
 *   bottom of the right-hand rail in full screen.
 *
 * `startFrame` opens the proxy on that frame instead of the first one, and
 * `onFrameSettle(frame)` reports the frame whenever playback is stopped on
 * it — together they let a page bring someone back to where they were.
 *
 * Higher-quality sources (all optional):
 * - `hqSrc`: the 4K HQ proxy. Plays by default when there is one (a toggle
 *   switches back to the normal proxy), and always when zoomed in.
 * - `uhqRenders` + `loadUhqFrame(render, frame) => Promise<url>`: full-res
 *   6K/8K stills (supervisor only), laid over the video on their frames.
 *   A single-frame/range render shows while zoomed and is dropped by Reset
 *   view; a full-range one stays on until hidden. `onDeleteUhq(render)`
 *   adds a delete button to each.
 */
export default function AnnotatedPlayer({
  src,
  hqSrc = null,
  uhqRenders = [],
  loadUhqFrame,
  onDeleteUhq,
  annotations = [],
  onChange,
  notes,
  actions,
  startFrame = 0,
  onFrameSettle,
  onFrameCount,
}) {
  const editable = typeof onChange === "function";
  const rootRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const liveStroke = useRef(null);
  const [frame, setFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [aspect, setAspect] = useState(16 / 9);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [color, setColor] = useState(ANNOTATION_COLORS[0].value);
  const [noteDraft, setNoteDraft] = useState("");
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  // The box the picture has to fit in. Only used in full screen, where the
  // picture is sized to fill as much of it as the aspect ratio allows.
  const viewportRef = useRef(null);
  // Full-screen zoom/pan of the picture (video + annotation layer move
  // together, so marks stay on the right pixels). scale 1 = fit.
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const panDrag = useRef(null);
  const [panning, setPanning] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  // Normal proxy picked over the HQ at fit size (zoomed always uses the HQ).
  const [preferProxy, setPreferProxy] = useState(false);
  const [activeUhqId, setActiveUhqId] = useState(null);
  const [uhqImage, setUhqImage] = useState(null); // { key, url } for the frame on screen
  const uhqCache = useRef(new Map()); // `${renderId}:${frame}` -> object URL
  // Set while the video element changes source mid-review (proxy <-> HQ):
  // where to land once the new file is loaded, and whether to keep playing.
  const swapRef = useRef(null);

  const sorted = [...annotations].sort((a, b) => a.frame - b.frame);
  const current = annotations.find((a) => a.frame === frame) ?? null;

  const frameFromTime = (t) => Math.max(0, Math.floor(t * PROXY_FPS + 1e-4));

  const seekToFrame = useCallback(
    (f) => {
      const video = videoRef.current;
      if (!video) return;
      const last = Math.max(0, totalFrames - 1);
      const clamped = Math.min(Math.max(0, f), last);
      video.pause();
      // Aim at the middle of the frame so floor() lands on it reliably.
      video.currentTime = (clamped + 0.5) / PROXY_FPS;
      setFrame(clamped);
    },
    [totalFrames]
  );

  // Loop / speed carry over from one proxy to the next; a new src resets
  // the element's own rate, so this re-applies after every load too.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = loop;
    video.playbackRate = rate;
  }, [loop, rate, src, hqSrc, preferProxy, totalFrames]);

  // Report where playback came to rest (not every frame while it plays).
  useEffect(() => {
    if (!playing && totalFrames) onFrameSettle?.(frame);
  }, [frame, playing, totalFrames]);

  // New proxy: back to the start.
  useEffect(() => {
    setFrame(0);
    setPlaying(false);
    setTotalFrames(0);
    setView({ scale: 1, x: 0, y: 0 });
    setPreferProxy(false);
    setActiveUhqId(null);
  }, [src]);

  // While playing, follow the video every animation frame; timeupdate alone
  // only fires ~4×/sec, which makes the frame counter and marks lag.
  useEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => {
      const video = videoRef.current;
      if (video) setFrame(frameFromTime(video.currentTime));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Keep the canvas backing store matched to its on-screen size.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(([entry]) => {
      const dpr = window.devicePixelRatio || 1;
      setCanvasSize({
        w: Math.round(entry.contentRect.width * dpr),
        h: Math.round(entry.contentRect.height * dpr),
      });
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const ro = new ResizeObserver(([entry]) => {
      setViewport({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    for (const s of current?.strokes ?? []) drawStroke(ctx, s, w, h);
    if (liveStroke.current) drawStroke(ctx, liveStroke.current, w, h);
  }, [current]);

  useEffect(() => {
    redraw();
  }, [redraw, canvasSize]);

  // The note box mirrors the frame being looked at.
  useEffect(() => {
    setNoteDraft(current?.note ?? "");
  }, [current?.id]);

  useEffect(() => {
    const onFsChange = () => {
      const isFs = document.fullscreenElement === rootRef.current;
      setFullscreen(isFs);
      // Zoom is a full-screen-only tool; leaving full screen puts it back.
      if (!isFs) setView({ scale: 1, x: 0, y: 0 });
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen().catch((err) => console.error("Couldn't enter full screen:", err));
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  // Space / arrows / brackets, unless the user is typing somewhere.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || e.target?.isContentEditable) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekToFrame(frame - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekToFrame(frame + 1);
      } else if (e.key === "[") {
        jumpToAnnotation(-1);
      } else if (e.key === "]") {
        jumpToAnnotation(1);
      } else if (e.key === "0" && fullscreen) {
        resetView();
      } else if (e.key === "f" || e.key === "F") {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const jumpToAnnotation = (dir) => {
    const target =
      dir < 0 ? [...sorted].reverse().find((a) => a.frame < frame) : sorted.find((a) => a.frame > frame);
    if (target) seekToFrame(target.frame);
  };

  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [
      round4(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))),
      round4(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))),
    ];
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    // A click on a playing clip just stops it on the frame you want to mark.
    if (playing) {
      videoRef.current?.pause();
      return;
    }
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    liveStroke.current = { color, points: [pointFromEvent(e)] };
    redraw();
  };

  const onPointerMove = (e) => {
    const stroke = liveStroke.current;
    if (!stroke) return;
    const p = pointFromEvent(e);
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_POINT_GAP) return;
    stroke.points.push(p);
    redraw();
  };

  const onPointerUp = () => {
    const stroke = liveStroke.current;
    if (!stroke) return;
    liveStroke.current = null;
    if (current) {
      onChange(annotations.map((a) => (a.id === current.id ? { ...a, strokes: [...a.strokes, stroke] } : a)));
    } else {
      onChange([...annotations, { id: crypto.randomUUID(), frame, strokes: [stroke], note: "" }]);
    }
  };

  const undoStroke = () => {
    if (!current) return;
    const strokes = current.strokes.slice(0, -1);
    // An empty frame with no note isn't worth keeping as a marker.
    if (!strokes.length && !current.note) onChange(annotations.filter((a) => a.id !== current.id));
    else onChange(annotations.map((a) => (a.id === current.id ? { ...a, strokes } : a)));
  };

  const removeAnnotation = (id) => onChange(annotations.filter((a) => a.id !== id));

  const commitNote = () => {
    if (!current) return;
    const note = noteDraft.trim();
    if (note === (current.note ?? "")) return;
    onChange(annotations.map((a) => (a.id === current.id ? { ...a, note } : a)));
  };

  const last = Math.max(0, totalFrames - 1);

  // Mouse-wheel zoom, anchored on the cursor so the detail under it stays
  // put. Native listener because React's wheel handler is passive and
  // can't stop the browser's own scroll/zoom.
  useEffect(() => {
    const box = viewportRef.current;
    if (!box || !fullscreen) return;
    const onWheel = (e) => {
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const { scale, x, y } = viewRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(1, scale * Math.exp(-e.deltaY * 0.0015)));
      if (next === scale) return;
      if (next === 1) {
        setView({ scale: 1, x: 0, y: 0 });
        return;
      }
      const rect = stage.getBoundingClientRect(); // already includes the current zoom/pan
      const localX = (e.clientX - rect.left) / scale;
      const localY = (e.clientY - rect.top) / scale;
      setView({
        scale: next,
        x: x + (e.clientX - localX * next) - rect.left,
        y: y + (e.clientY - localY * next) - rect.top,
      });
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [fullscreen]);

  // Middle-button drag pans.
  const onViewportPointerDown = (e) => {
    if (!fullscreen || e.button !== 1) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panDrag.current = { px: e.clientX, py: e.clientY, x: viewRef.current.x, y: viewRef.current.y };
    setPanning(true);
  };
  const onViewportPointerMove = (e) => {
    const drag = panDrag.current;
    if (!drag) return;
    setView((v) => ({ ...v, x: drag.x + (e.clientX - drag.px), y: drag.y + (e.clientY - drag.py) }));
  };
  const endPan = () => {
    panDrag.current = null;
    setPanning(false);
  };
  const isZoomed = view.scale !== 1 || view.x !== 0 || view.y !== 0;
  const activeUhq = uhqRenders.find((r) => r.id === activeUhqId) ?? null;
  // Back to fit — and off a single-frame/range 6K/8K render, back onto the
  // 4K HQ. A full-range render stays on.
  const resetView = () => {
    setView({ scale: 1, x: 0, y: 0 });
    if (activeUhq && !activeUhq.full) setActiveUhqId(null);
  };

  // Which file the <video> plays. Switching keeps the frame (and playback).
  const useHq = Boolean(hqSrc) && (isZoomed || !preferProxy);
  const effectiveSrc = useHq ? hqSrc : src;
  const sourceLabel = activeUhq && (isZoomed || activeUhq.full) ? "6K/8K" : useHq ? "HQ 4K" : "Proxy";
  const lastSources = useRef({ src, effectiveSrc });
  if (lastSources.current.effectiveSrc !== effectiveSrc) {
    // Same submission, different file (proxy <-> HQ): remember where we are
    // for the reload. A different submission starts fresh instead.
    if (lastSources.current.src === src && videoRef.current && totalFrames) {
      swapRef.current = { frame, playing };
    } else {
      swapRef.current = null;
    }
    lastSources.current = { src, effectiveSrc };
  }

  // A render just made (new id) switches on and jumps to its first frame.
  const knownUhqIds = useRef(new Set(uhqRenders.map((r) => r.id)));
  useEffect(() => {
    const fresh = uhqRenders.find((r) => !knownUhqIds.current.has(r.id));
    knownUhqIds.current = new Set(uhqRenders.map((r) => r.id));
    if (fresh) {
      setActiveUhqId(fresh.id);
      seekToFrame(fresh.start);
    } else if (activeUhqId && !uhqRenders.some((r) => r.id === activeUhqId)) {
      setActiveUhqId(null); // deleted
    }
  }, [uhqRenders.map((r) => r.id).join(",")]);

  const uhqInRange = activeUhq && frame >= activeUhq.start && frame <= activeUhq.end;
  const showUhq = Boolean(uhqInRange && (isZoomed || activeUhq.full) && loadUhqFrame);

  // Load the full-res still for the frame on screen (and a few ahead while
  // playing). Cached object URLs; the oldest are dropped past ~24.
  useEffect(() => {
    if (!showUhq) return;
    let cancelled = false;
    const render = activeUhq;
    const fetchFrame = async (f) => {
      const key = `${render.id}:${f}`;
      if (uhqCache.current.has(key)) return uhqCache.current.get(key);
      const url = await loadUhqFrame(render, f);
      uhqCache.current.set(key, url);
      if (uhqCache.current.size > 24) {
        const [oldKey, oldUrl] = uhqCache.current.entries().next().value;
        uhqCache.current.delete(oldKey);
        URL.revokeObjectURL(oldUrl);
      }
      return url;
    };
    (async () => {
      try {
        const url = await fetchFrame(frame);
        if (!cancelled) setUhqImage({ key: `${render.id}:${frame}`, url });
        if (playing) {
          for (let f = frame + 1; f <= Math.min(render.end, frame + 3); f++) await fetchFrame(f);
        }
      } catch (err) {
        console.error("Couldn't load 6K/8K frame:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showUhq, activeUhq?.id, frame]);

  // Drop cached stills when the submission changes or on unmount.
  useEffect(() => {
    const cache = uhqCache.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, [src]);

  const stageWidth = fullscreen
    ? `${Math.floor(Math.min(viewport.w, viewport.h * aspect))}px`
    : `min(100%, calc(60vh * ${aspect}))`;

  // Lives in the transport bar: pushed right normally, right after the frame
  // counter in full screen.
  const tools = editable && (
    <div className="aplayer-tools">
      {ANNOTATION_COLORS.map((c) => (
        <button
          key={c.value}
          className={`aplayer-swatch${color === c.value ? " is-active" : ""}`}
          style={{ background: c.value }}
          title={c.name}
          onClick={() => setColor(c.value)}
        />
      ))}
      <button className="aplayer-btn" onClick={undoStroke} disabled={!current?.strokes.length} title="Undo last stroke on this frame">
        Undo
      </button>
    </div>
  );

  const frameNote = current && (editable || current.note) && (
    <div className="aplayer-note">
      <span className="label">Note on frame {formatFrame(frame)}</span>
      {editable ? (
        <textarea
          placeholder="What needs to change on this frame…"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={commitNote}
        />
      ) : (
        <div className="aplayer-note-readonly">{current.note}</div>
      )}
    </div>
  );

  const frameList = (
    <div className="aplayer-list-rows">
      {sorted.map((a) => (
        <div
          key={a.id}
          className={`aplayer-list-row${a.frame === frame ? " is-current" : ""}`}
          onClick={() => seekToFrame(a.frame)}
          title={a.note || undefined}
        >
          <span className="mono aplayer-list-frame">F {formatFrame(a.frame)}</span>
          <span className="aplayer-list-dots">
            {[...new Set(a.strokes.map((s) => s.color))].map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
          <span className="aplayer-list-note">{a.note || <em>No note</em>}</span>
          {editable && (
            <button
              className="aplayer-list-remove"
              title="Remove this frame's annotation"
              onClick={(e) => {
                e.stopPropagation();
                removeAnnotation(a.id);
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );

  // Full-screen right rail only when it has something in it (read-only with
  // no marks has neither a frame list nor actions) — otherwise the picture
  // gets that width back.
  const showRail = sorted.length > 0 || Boolean(actions) || uhqRenders.length > 0;

  const uhqList = uhqRenders.length > 0 && (
    <div className="aplayer-uhq-list">
      <span className="label">6K/8K renders</span>
      {uhqRenders.map((r) => (
        <div key={r.id} className={`aplayer-list-row${r.id === activeUhqId ? " is-current" : ""}`}>
          <span className="mono aplayer-list-frame aplayer-list-note">{r.label}</span>
          <button
            className="aplayer-btn aplayer-uhq-toggle"
            onClick={() => {
              if (r.id === activeUhqId) setActiveUhqId(null);
              else {
                setActiveUhqId(r.id);
                if (frame < r.start || frame > r.end) seekToFrame(r.start);
              }
            }}
          >
            {r.id === activeUhqId ? "Hide" : "View"}
          </button>
          {onDeleteUhq && (
            <button className="aplayer-list-remove" title="Delete this 6K/8K render from disk" onClick={() => onDeleteUhq(r)}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );

  const notesContent = typeof notes === "function" ? notes(fullscreen) : notes;

  return (
    <div className={`aplayer${fullscreen ? " is-fullscreen" : ""}${showRail ? "" : " no-rail"}`} ref={rootRef}>
      <div className="aplayer-main">
      <div
        className={`aplayer-viewport${panning ? " is-panning" : ""}`}
        ref={viewportRef}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        // Stops Windows' middle-click autoscroll from kicking in.
        onMouseDown={(e) => e.button === 1 && e.preventDefault()}
      >
      <div
        className="aplayer-stage"
        ref={stageRef}
        style={{
          aspectRatio: aspect,
          width: stageWidth,
          transform: fullscreen && isZoomed ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})` : undefined,
        }}
      >
        <video
          ref={videoRef}
          src={effectiveSrc}
          className="aplayer-video"
          preload="auto"
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
            const total = Math.max(1, Math.round(v.duration * PROXY_FPS));
            setTotalFrames(total);
            onFrameCount?.(total);
            const swap = swapRef.current;
            swapRef.current = null;
            const resumeAt = Math.min(Math.max(0, swap ? swap.frame : startFrame), total - 1);
            if (resumeAt > 0) {
              v.currentTime = (resumeAt + 0.5) / PROXY_FPS;
              setFrame(resumeAt);
            }
            if (swap?.playing) v.play().catch(() => {});
          }}
          onPlay={() => setPlaying(true)}
          onPause={(e) => {
            // A source swap pauses the element on its way out — that's not
            // the reviewer stopping, and its time has already reset to 0.
            if (swapRef.current) return;
            setPlaying(false);
            setFrame(frameFromTime(e.currentTarget.currentTime));
          }}
          onSeeked={(e) => {
            if (!playing && !swapRef.current) setFrame(frameFromTime(e.currentTarget.currentTime));
          }}
          onEnded={() => setPlaying(false)}
        />
        {showUhq && uhqImage?.key === `${activeUhq.id}:${frame}` && (
          <img className="aplayer-uhq" src={uhqImage.url} alt="" draggable={false} />
        )}
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className={`aplayer-canvas${editable && !playing ? " is-drawable" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      </div>

      <div className="aplayer-scrub">
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={Math.min(frame, last)}
          onChange={(e) => seekToFrame(Number(e.target.value))}
        />
        <div className="aplayer-markers">
          {sorted.map((a) => (
            <span
              key={a.id}
              className={`aplayer-marker${a.frame === frame ? " is-current" : ""}`}
              style={{ left: `${last ? (a.frame / last) * 100 : 0}%` }}
              title={`Frame ${formatFrame(a.frame)}${a.note ? ` — ${a.note}` : ""}`}
              onClick={() => seekToFrame(a.frame)}
            />
          ))}
        </div>
      </div>

      <div className="aplayer-controls">
        <button className="aplayer-btn" onClick={() => jumpToAnnotation(-1)} title="Previous annotated frame ( [ )">
          ⇤
        </button>
        <button className="aplayer-btn" onClick={() => seekToFrame(frame - 1)} title="Back one frame (←)">
          ◀
        </button>
        <button className="aplayer-btn aplayer-play" onClick={togglePlay} title="Play / pause (space)">
          {playing ? "❚❚" : "▶"}
        </button>
        <button className="aplayer-btn" onClick={() => seekToFrame(frame + 1)} title="Forward one frame (→)">
          ▶
        </button>
        <button className="aplayer-btn" onClick={() => jumpToAnnotation(1)} title="Next annotated frame ( ] )">
          ⇥
        </button>
        <select
          className="aplayer-select"
          value={loop ? "loop" : "once"}
          onChange={(e) => {
            setLoop(e.target.value === "loop");
            e.target.blur(); // hand space/arrows back to the player
          }}
          title="Loop or play once"
        >
          <option value="once">Play once</option>
          <option value="loop">Loop</option>
        </select>
        <select
          className="aplayer-select"
          value={rate}
          onChange={(e) => {
            setRate(Number(e.target.value));
            e.target.blur();
          }}
          title="Playback speed"
        >
          <option value={1}>1×</option>
          <option value={0.5}>½×</option>
          <option value={0.25}>¼×</option>
        </select>
        <span className="aplayer-frame mono">
          {formatFrame(frame)} / {formatFrame(last)}
        </span>

        {hqSrc && (
          <button
            className={`aplayer-btn aplayer-source${useHq ? " is-hq" : ""}`}
            onClick={() => setPreferProxy((p) => !p)}
            disabled={isZoomed}
            title={
              isZoomed
                ? "Zoomed in — always uses the HQ"
                : useHq
                  ? "Playing the 4K HQ — click for the normal proxy"
                  : "Playing the normal proxy — click for the 4K HQ"
            }
          >
            {sourceLabel}
          </button>
        )}
        {!hqSrc && activeUhq && <span className="aplayer-source-label mono">{sourceLabel}</span>}
        {tools}
        {fullscreen && (
          <>
            <span className="aplayer-zoom mono aplayer-push-right" title="Scroll to zoom, middle-drag to pan">
              {Math.round(view.scale * 100)}%
            </span>
            <button className="aplayer-btn" onClick={resetView} disabled={!isZoomed} title="Reset zoom and pan (0)">
              Reset view
            </button>
          </>
        )}
        <button
          className={`aplayer-btn${editable || fullscreen ? "" : " aplayer-push-right"}`}
          onClick={toggleFullscreen}
          title={fullscreen ? "Exit full screen (F / Esc)" : "Full screen (F)"}
        >
          {fullscreen ? "Exit full screen" : "⛶ Full screen"}
        </button>
      </div>

      {editable && !playing && !fullscreen && (
        <div className="aplayer-hint">
          {current
            ? `Frame ${formatFrame(frame)} is marked — draw more, or add a note below.`
            : "Paused — draw on the frame to mark it."}
        </div>
      )}
      </div>


      {fullscreen && showRail && (
        <div className="aplayer-rail">
          {sorted.length > 0 && (
            <>
              <span className="label">Frames ({sorted.length})</span>
              {frameList}
            </>
          )}
          {uhqList}
          {actions && <div className="aplayer-rail-actions">{actions}</div>}
        </div>
      )}

      {fullscreen ? (
        // A plain render (read-only, unmarked, no notes) gets no bottom row.
        (editable || sorted.length > 0 || notesContent) && <div className="aplayer-bottom">
          {frameNote ?? (
            <div className="aplayer-note aplayer-note-empty">
              {editable ? "Draw on this frame to add a note to it." : "No note on this frame."}
            </div>
          )}
          {notesContent}
        </div>
      ) : (
        <div className="aplayer-side">
          {frameNote}
          {sorted.length > 0 && (
            <div className="aplayer-list">
              <span className="label">Annotated frames ({sorted.length})</span>
              {frameList}
            </div>
          )}
          {uhqList}
          {notesContent}
          {actions}
        </div>
      )}
    </div>
  );
}
