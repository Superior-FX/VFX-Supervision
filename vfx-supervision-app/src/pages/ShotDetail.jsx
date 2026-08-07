import { useParams } from "react-router-dom";
import "./ShotDetail.css";

function PlayIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="currentColor" />
    </svg>
  );
}

export default function ShotDetail() {
  const { shotId } = useParams();
  const code = shotId ?? "SH_042_020";
  const isInHouse = true;

  return (
    <div className="detail">
      <div className="detail-header">
        <span className="detail-code">{code}</span>
        <span className="pill">v004 pending</span>
      </div>

      <div className="card playback">
        <PlayIcon />
        <span>Comp playback</span>
      </div>

      <div className="version-nav">
        <div className="version-nav-btn">◀</div>
        <span className="pill">v003</span>
        <span className="pill pill-accent">v004</span>
        <div className="version-nav-btn">▶</div>
      </div>

      <div className="source-row">
        <span className={`pill${isInHouse ? " pill-accent" : ""}`}>
          {isInHouse ? "In-house" : "Outsourced"}
        </span>
        <span className="source-hint">
          {isInHouse ? "handled by an internal artist" : "handled by an external vendor"}
        </span>
      </div>

      <div className="detail-grid">
        <div className="card detail-field">
          <span className="label">Artist</span>
          <br />
          <span className="detail-field-value">J. Alvarez — Comp</span>
        </div>
        <div className="card detail-field">
          <span className="label">Due</span>
          <br />
          <span className="detail-field-value">Aug 12</span>
        </div>
      </div>

      <div className="card detail-field">
        <span className="label">Vendor</span>
        <br />
        <span className="detail-field-value muted">
          {isInHouse ? "— not applicable, in-house shot" : "Anvil FX"}
        </span>
      </div>

      <span className="label">Sup notes</span>
      <div className="card notes-thread">
        <div className="note-line">
          <span className="note-author supe">SUPE</span>
          <span className="note-body">→ push the rim light 10% warmer</span>
        </div>
        <div className="note-line">
          <span className="note-author vendor">ANVIL</span>
          <span className="note-body muted">→ addressed in v004</span>
        </div>
      </div>

      <div className="detail-actions">
        <div className="btn btn-primary">Approve</div>
        <div className="btn btn-secondary">Request changes</div>
      </div>
    </div>
  );
}
