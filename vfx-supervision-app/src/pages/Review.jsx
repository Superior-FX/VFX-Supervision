import { useState } from "react";
import "./Review.css";

const TOOLS = ["✎ Draw", "Text", "Frame ⇄ range"];
const FRAMES = 4;

function FrameIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 9h18M9 4v14" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function Review() {
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [activeFrame, setActiveFrame] = useState(1);

  return (
    <div className="review">
      <div className="review-header">
        <span className="review-title">DAILIES — SEQ 042</span>
        <span className="pill">6 shots queued</span>
      </div>

      <div className="card review-frame">
        <FrameIcon />
        <span style={{ marginLeft: 10 }}>Frame with draw-over annotation</span>
      </div>

      <div className="review-toolbar">
        {TOOLS.map((tool) => (
          <span
            key={tool}
            className={`pill review-tool${activeTool === tool ? " active" : ""}`}
            onClick={() => setActiveTool(tool)}
          >
            {tool}
          </span>
        ))}
        <span className="review-scrub-hint">Scrub timeline below</span>
      </div>

      <div className="card review-scrubber">
        <div className="review-scrubber-fill" />
      </div>

      <div className="filmstrip">
        {Array.from({ length: FRAMES }).map((_, i) => (
          <div
            key={i}
            className={`filmstrip-frame${activeFrame === i ? " active" : ""}`}
            onClick={() => setActiveFrame(i)}
          />
        ))}
      </div>

      <div className="review-actions">
        <div className="btn btn-secondary">Save note</div>
        <div className="btn btn-primary">Next shot ▶</div>
      </div>
    </div>
  );
}
