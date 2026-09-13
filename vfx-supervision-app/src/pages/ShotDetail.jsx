import { useState } from "react";
import { useParams } from "react-router-dom";
import { buildFolderPath } from "../lib/folderPath.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
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
  const project = useActiveProject();
  const [shots] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [copied, setCopied] = useState(false);

  const shot = shots.find((s) => s.shotCode === shotId);
  const code = shot?.shotCode ?? shotId ?? "SH_042_020";
  const isInHouse = true;

  const folderPath = shot
    ? buildFolderPath({ show: project?.showCode, scene: shot.scene, shotCode: shot.shotCode })
    : null;

  const copyPath = () => {
    if (!folderPath) return;
    navigator.clipboard.writeText(folderPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="detail">
      <div className="detail-header">
        <span className="detail-code">{code}</span>
        <span className="pill">v004 pending</span>
      </div>

      <div className="card detail-field detail-folder-path-field">
        <span className="label">Folder path</span>
        <br />
        {folderPath ? (
          <span className="detail-folder-path" onClick={copyPath} title="Click to copy">
            {folderPath}
            <span className="detail-folder-path-copy">{copied ? "Copied" : "Copy"}</span>
          </span>
        ) : (
          <span className="detail-field-value muted">
            Set sequence and scene on this shot (Post Reports) to see the folder path.
          </span>
        )}
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
