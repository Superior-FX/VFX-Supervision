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
 */
export default function AnnotatedPlayer({ src, annotations = [], onChange, notes, actions }) {
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
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

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
  }, [loop, rate, src, totalFrames]);

  // New proxy: back to the start.
  useEffect(() => {
    setFrame(0);
    setPlaying(false);
    setTotalFrames(0);
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
    const onFsChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
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

  const notesContent = typeof notes === "function" ? notes(fullscreen) : notes;

  return (
    <div className={`aplayer${fullscreen ? " is-fullscreen" : ""}`} ref={rootRef}>
      <div className="aplayer-main">
      <div className="aplayer-viewport" ref={viewportRef}>
      <div className="aplayer-stage" ref={stageRef} style={{ aspectRatio: aspect, width: stageWidth }}>
        <video
          ref={videoRef}
          src={src}
          className="aplayer-video"
          preload="auto"
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
            setTotalFrames(Math.max(1, Math.round(v.duration * PROXY_FPS)));
          }}
          onPlay={() => setPlaying(true)}
          onPause={(e) => {
            setPlaying(false);
            setFrame(frameFromTime(e.currentTarget.currentTime));
          }}
          onSeeked={(e) => {
            if (!playing) setFrame(frameFromTime(e.currentTarget.currentTime));
          }}
          onEnded={() => setPlaying(false)}
        />
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

        {tools}
        <button
          className={`aplayer-btn${editable && !fullscreen ? "" : " aplayer-push-right"}`}
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


      {fullscreen && (
        <div className="aplayer-rail">
          {sorted.length > 0 && (
            <>
              <span className="label">Frames ({sorted.length})</span>
              {frameList}
            </>
          )}
          {actions && <div className="aplayer-rail-actions">{actions}</div>}
        </div>
      )}

      {fullscreen ? (
        <div className="aplayer-bottom">
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
          {notesContent}
          {actions}
        </div>
      )}
    </div>
  );
}
