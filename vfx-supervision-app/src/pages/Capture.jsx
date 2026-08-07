import { useRef, useState } from "react";
import { generateThumbnail } from "../lib/ffmpeg.js";
import { upsertById, useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Capture.css";

const INITIAL_CHECKLIST = [
  { id: "lens", label: "Lens data logged", checked: false },
  { id: "hdri", label: "HDRI captured (3 exposures)", checked: true },
  { id: "chart", label: "Grey/color chart shot", checked: false },
  { id: "green", label: "Greenscreen even lit?", checked: false },
];

const LENS_LINE = "FL 35mm · T2.8 · dist 4.2m";
const CAMERA_LINE = "ISO 800 · WB 5600K";

function CameraIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M17 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 11a7 7 0 0014 0M12 18v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 12l6.5-6.5a3 3 0 114.24 4.24L10 18.5a5 5 0 11-7.07-7.07L11.5 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Capture() {
  const [shotCode, setShotCode] = useState("SH_042_020");
  const [description, setDescription] = useState("");
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbStatus, setThumbStatus] = useState(null); // null | "working" | "error"
  const [confirmation, setConfirmation] = useState(null);
  const fileInputRef = useRef(null);

  const [reports, setReports] = useLocalStorageState("vfx-supe-capture-reports", []);

  const toggle = (id) =>
    setChecklist((items) => items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbStatus("Reading file…");
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Thumbnail generation timed out")), 30000)
      );
      const dataUrl = await Promise.race([generateThumbnail(file, { onProgress: setThumbStatus }), timeout]);
      setThumbnail(dataUrl);
      setThumbStatus(null);
    } catch (err) {
      console.error("Thumbnail generation failed:", err);
      setThumbStatus("error");
    }
  };

  const resetForm = () => {
    setShotCode("");
    setDescription("");
    setChecklist(INITIAL_CHECKLIST.map((item) => ({ ...item, checked: false })));
    setThumbnail(null);
    setThumbStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = () => {
    if (!shotCode.trim()) return;
    const row = {
      id: shotCode.trim(),
      shotCode: shotCode.trim(),
      description,
      lens: LENS_LINE,
      camera: CAMERA_LINE,
      checklist,
      thumbnail,
      submittedAt: new Date().toISOString(),
    };
    setReports(upsertById(reports, row));
    setConfirmation(`${row.shotCode} submitted to Capture Reports`);
    setTimeout(() => setConfirmation(null), 3000);
    resetForm();
  };

  return (
    <div className="capture">
      <div className="capture-header">
        <input
          className="capture-shot-input mono"
          value={shotCode}
          onChange={(e) => setShotCode(e.target.value)}
          placeholder="Shot code, e.g. SH_042_030"
        />
        <span className="pill">tablet</span>
      </div>

      <div className="card viewfinder">
        {thumbStatus && thumbStatus !== "error" && <span>{thumbStatus}</span>}
        {!thumbStatus && thumbnail && <img className="viewfinder-thumb" src={thumbnail} alt="Capture thumbnail" />}
        {!thumbStatus && !thumbnail && (
          <>
            <CameraIcon />
            <span>Live preview</span>
          </>
        )}
        {thumbStatus === "error" && <span>Couldn't generate thumbnail — try another file</span>}
      </div>

      <div className="capture-actions">
        <div className="btn btn-primary">◉ Shoot HDRI</div>
        <div className="btn btn-secondary">Chrome ball</div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <div className="btn btn-secondary attach-btn" onClick={() => fileInputRef.current?.click()}>
        <AttachIcon /> Attach capture (video/photo) — generates thumbnail via ffmpeg
      </div>

      <span className="label">Checklist</span>
      <div className="checklist">
        {checklist.map((item) => (
          <div className="card checklist-item" key={item.id} onClick={() => toggle(item.id)}>
            <div className={`checklist-box${item.checked ? " checked" : ""}`}>
              {item.checked && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12l5 5L20 6" stroke="#0e0f13" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="checklist-label">{item.label}</span>
          </div>
        ))}
      </div>

      <span className="label">Lens / camera (auto-pull)</span>
      <div className="card lens-readout">
        <span>{LENS_LINE}</span>
        <span>{CAMERA_LINE}</span>
      </div>

      <div className="note-field">
        <span className="label">Description</span>
        <div className="note-textarea">
          <textarea
            placeholder="Describe this shot for the capture report…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="note-mic">
            <MicIcon />
          </div>
        </div>
      </div>

      <div className="capture-submit-row">
        <div className="btn btn-primary" onClick={submit}>
          Submit to Capture Reports
        </div>
        {confirmation && <span className="capture-confirmation">{confirmation}</span>}
      </div>
    </div>
  );
}
