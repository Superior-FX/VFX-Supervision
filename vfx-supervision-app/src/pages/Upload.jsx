import { useState } from "react";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Upload.css";

const FILES = [
  { name: "SH_042_020_v004.mov", size: "220MB" },
  { name: "SH_042_020_v004.exr.zip", size: "1.1GB" },
];

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4M12 4l-5 5M12 4l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export default function Upload() {
  const [postReports, setPostReports] = useLocalStorageState("vfx-supe-post-reports", []);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const selectedShot = postReports.find((s) => s.id === selectedId);

  const submit = () => {
    if (!selectedShot) return;
    setPostReports((prev) =>
      prev.map((s) =>
        s.id === selectedShot.id
          ? { ...s, boardStatus: "progress", tasks: s.tasks.map((t) => ({ ...t, status: "in_progress" })) }
          : s
      )
    );
    setConfirmation(`${selectedShot.shotCode} submitted — moved to In Progress on the Shot Board`);
    setTimeout(() => setConfirmation(null), 4000);
    setSelectedId("");
    setNote("");
  };

  return (
    <div className="upload">
      <div className="upload-header">
        <span className="upload-title">UPLOAD SHOT</span>
        {selectedShot && <span className="pill">to {selectedShot.shotCode}</span>}
      </div>
      {confirmation && <div className="upload-confirmation">{confirmation}</div>}

      <div className="dropzone">
        <div className="dropzone-icon">
          <UploadIcon />
        </div>
        <span className="dropzone-text">Drag file here or browse</span>
        <span className="dropzone-hint">.mov .mp4 .exr .dpx — up to 4K</span>
      </div>

      <span className="label">Selected files</span>
      <div className="file-list">
        {FILES.map((file) => (
          <div className="card file-row" key={file.name}>
            <div className="file-icon">
              <FileIcon />
            </div>
            <span className="file-name">{file.name}</span>
            <span className="pill file-size">{file.size}</span>
          </div>
        ))}
      </div>

      <span className="label">Attach to</span>
      <select className="attach-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">Select a shot…</option>
        {postReports.map((s) => (
          <option value={s.id} key={s.id}>
            {s.shotCode}
          </option>
        ))}
      </select>

      <span className="label">Version note</span>
      <div className="upload-note">
        <textarea
          placeholder="What changed in this version…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="upload-actions">
        <div className="btn btn-secondary">Cancel</div>
        <div className="btn btn-secondary">Upload</div>
        <div
          className={`btn btn-primary${selectedShot ? "" : " btn-disabled"}`}
          onClick={selectedShot ? submit : undefined}
        >
          Submit
        </div>
      </div>
    </div>
  );
}
