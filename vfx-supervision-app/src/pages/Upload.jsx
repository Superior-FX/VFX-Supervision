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
  return (
    <div className="upload">
      <div className="upload-header">
        <span className="upload-title">UPLOAD SHOT</span>
        <span className="pill">to SH_042_020</span>
      </div>

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
      <div className="card attach-field">
        <span>SH_042_020 — v004</span>
      </div>

      <span className="label">Version note</span>
      <div className="upload-note">
        <textarea placeholder="What changed in this version…" />
      </div>

      <div className="upload-actions">
        <div className="btn btn-secondary">Cancel</div>
        <div className="btn btn-primary">Upload</div>
      </div>
    </div>
  );
}
