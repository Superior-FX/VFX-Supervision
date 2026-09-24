import { useEffect, useState } from "react";
import { resolveCurrentArtist } from "../lib/currentArtist.js";
import { generateReviewProxy } from "../lib/ffmpeg.js";
import { buildTaskUploadPath, padScene } from "../lib/folderPath.js";
import {
  copyFileInto,
  ensurePermission,
  getTaskReviewFolder,
  getTaskUploadFolder,
  isFsAccessSupported,
  loadRootHandle,
  pickSequenceFolder,
  pickVideoFile,
  readFolderFiles,
} from "../lib/fsAccess.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { groupSequenceFiles } from "../lib/sequenceGrouping.js";
import { sortByDueComplexityName } from "../lib/sortShots.js";
import { hasAssignee } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Upload.css";

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15 2v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function formatBytes(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function Upload() {
  const project = useActiveProject();
  const [postReports, setPostReports] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [selectedShotId, setSelectedShotId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // { id, name, kind: "video" | "sequence" | "file", size?, count? }
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [rootHandle, setRootHandle] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [uploadError, setUploadError] = useState("");
  // Filename of the review proxy generated for this submission's video, if
  // any — sequence-only submissions never get one, and Review & Dailies
  // just shows "no proxy" for those tasks.
  const [reviewFileName, setReviewFileName] = useState(null);
  const supported = isFsAccessSupported();

  const currentArtist = resolveCurrentArtist(artists);
  const myTask = (t) => hasAssignee(t, currentArtist?.name);

  useEffect(() => {
    if (!project) return;
    loadRootHandle(project.id)
      .then(setRootHandle)
      .catch(() => {});
  }, [project]);

  // Same "what's actually actionable right now" scoping as before: only
  // shots where this artist has a task in wip show up at all.
  const myShots = currentArtist
    ? sortByDueComplexityName(postReports.filter((s) => s.tasks.some((t) => myTask(t) && t.status === "wip")))
    : [];

  const selectedShot = myShots.find((s) => s.id === selectedShotId);
  const myWipTasksOnShot = selectedShot ? selectedShot.tasks.filter((t) => myTask(t) && t.status === "wip") : [];
  const selectedTask = myWipTasksOnShot.find((t) => t.id === selectedTaskId);

  // Where this task's uploads actually land — shown so it's always
  // visually obvious, per task, before anything is picked.
  const uploadPath = selectedShot
    ? buildTaskUploadPath({
        show: project?.showCode,
        scene: selectedShot.scene,
        shotCode: selectedShot.shotCode,
        taskType: selectedTask?.type,
      })
    : null;

  const resetAll = () => {
    setSelectedShotId("");
    setSelectedTaskId("");
    setSelectedFiles([]);
    setNote("");
    setUploadError("");
    setReviewFileName(null);
  };

  // Choosing a shot or task invalidates whatever was picked downstream of
  // it — never leave an old task/file selection attached to a new shot.
  const chooseShot = (id) => {
    setSelectedShotId(id);
    setSelectedTaskId("");
    setSelectedFiles([]);
    setUploadError("");
    setReviewFileName(null);
  };

  const chooseTask = (id) => {
    setSelectedTaskId(id);
    setSelectedFiles([]);
    setUploadError("");
    setReviewFileName(null);
  };

  const resolveDestination = async () => {
    const ok = await ensurePermission(rootHandle);
    if (!ok) throw new Error("Project folder access was denied.");
    const dir = await getTaskUploadFolder(rootHandle, {
      scene: padScene(selectedShot.scene),
      shotCode: selectedShot.shotCode,
      taskType: selectedTask.type,
    });
    if (!dir) throw new Error(`No folder is set up for "${selectedTask.type}" yet.`);
    return dir;
  };

  const uploadVideo = async () => {
    setUploadError("");
    try {
      // Resolve the destination before opening the picker so it can hint
      // the dialog to open there (startIn) — makes it visually obvious
      // which task/shot folder this upload is actually headed for.
      const destDir = await resolveDestination();
      const file = await pickVideoFile(destDir);
      setUploading(true);
      setUploadStage("Uploading…");
      await copyFileInto(destDir, file.name, file);
      setSelectedFiles((prev) => [...prev, { id: crypto.randomUUID(), name: file.name, kind: "video", size: file.size }]);

      // Best-effort: a review proxy makes Review & Dailies usable, but its
      // failure (e.g. an exotic codec ffmpeg.wasm can't decode) shouldn't
      // block the actual submitted file from having been uploaded above.
      try {
        const proxyBlob = await generateReviewProxy(file, { onProgress: setUploadStage });
        const reviewDir = await getTaskReviewFolder(rootHandle, {
          scene: padScene(selectedShot.scene),
          shotCode: selectedShot.shotCode,
          taskType: selectedTask.type,
        });
        if (reviewDir) {
          const proxyName = `${file.name.replace(/\.[^.]+$/, "")}_proxy.mp4`;
          await copyFileInto(reviewDir, proxyName, proxyBlob);
          setReviewFileName(proxyName);
        }
      } catch (proxyErr) {
        console.error("Review proxy generation failed:", proxyErr);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Video upload failed:", err);
        setUploadError(err?.message || "Couldn't upload that file.");
      }
    } finally {
      setUploading(false);
      setUploadStage("");
    }
  };

  const uploadSequence = async () => {
    setUploadError("");
    try {
      const destDir = await resolveDestination();
      const folderHandle = await pickSequenceFolder(destDir);
      // The picker now opens AT the destination (so it's obvious where an
      // upload is headed) — but that means it's also easy to pick the
      // destination itself (or somewhere already-uploaded-into) as the
      // "source", which would read back files this app already wrote and
      // copy them right over themselves, looking like a duplicate import.
      if (await folderHandle.isSameEntry(destDir)) {
        setUploadError("That's the render folder itself — pick the folder where your rendered frames actually live.");
        return;
      }
      setUploading(true);
      const files = await readFolderFiles(folderHandle);
      if (files.length === 0) {
        setUploadError("That folder is empty.");
        return;
      }
      const groups = groupSequenceFiles(files);
      for (const group of groups) {
        for (const file of group.files) {
          await copyFileInto(destDir, file.name, file);
        }
      }
      setSelectedFiles((prev) => [
        ...prev,
        ...groups.map((g) => ({ id: crypto.randomUUID(), name: g.name, kind: g.kind, count: g.files.length })),
      ]);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Sequence upload failed:", err);
        setUploadError(err?.message || "Couldn't upload that folder.");
      }
    } finally {
      setUploading(false);
    }
  };

  const removeSelectedFile = (id) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const canSubmit = Boolean(selectedTask) && selectedFiles.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    setPostReports((prev) =>
      prev.map((s) =>
        s.id === selectedShot.id
          ? {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id === selectedTask.id
                  ? {
                      ...t,
                      status: "pending",
                      versionNote: note.trim() || undefined,
                      // Keep the previous proxy if this submission was
                      // sequence-only (no new video, so nothing to replace it).
                      reviewFile: reviewFileName ?? t.reviewFile,
                    }
                  : t
              ),
            }
          : s
      )
    );
    setConfirmation(`${selectedShot.shotCode} — ${selectedTask.type} submitted — now pending supervisor review`);
    setTimeout(() => setConfirmation(null), 4000);
    resetAll();
  };

  return (
    <div className="upload">
      <div className="upload-header">
        <span className="upload-title">UPLOAD SHOT</span>
        {currentArtist && <span className="pill pill-accent">{currentArtist.name}</span>}
      </div>
      {confirmation && <div className="upload-confirmation">{confirmation}</div>}

      {!currentArtist && (
        <div className="card upload-no-artist-hint">
          No artist profile found for you yet — ask an Admin to add you in Post Reports → Artists.
        </div>
      )}

      {currentArtist && (
        <>
          <span className="label">Attach to</span>
          <select className="attach-select" value={selectedShotId} onChange={(e) => chooseShot(e.target.value)}>
            <option value="">Select a shot…</option>
            {myShots.map((s) => (
              <option value={s.id} key={s.id}>
                {s.shotCode}
              </option>
            ))}
          </select>
          {myShots.length === 0 && (
            <span className="label upload-no-shots-hint">
              No shots in progress for {currentArtist.name} — click Start in Artist Report first.
            </span>
          )}

          {selectedShot && (
            <>
              <span className="label">Submitting for</span>
              <select className="attach-select" value={selectedTaskId} onChange={(e) => chooseTask(e.target.value)}>
                <option value="">Select a task…</option>
                {myWipTasksOnShot.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.type}
                  </option>
                ))}
              </select>
            </>
          )}

          {selectedTask && (
            <>
              <span className="label">Upload</span>
              {uploadPath && <span className="upload-destination-path mono">{uploadPath}</span>}
              {!supported ? (
                <span className="label upload-hint">Automatic uploads need Chrome or Edge.</span>
              ) : !rootHandle ? (
                <span className="label upload-hint">
                  No project folder set — ask an Admin to grant one in Post Reports.
                </span>
              ) : !selectedShot.foldersCreatedAt ? (
                <span className="label upload-hint">
                  This shot's folders haven't been created yet — ask your supervisor to create them in Post Reports.
                </span>
              ) : (
                <div className="upload-buttons">
                  <span className={`btn btn-secondary${uploading ? " btn-disabled" : ""}`} onClick={uploading ? undefined : uploadVideo}>
                    Upload Video…
                  </span>
                  <span
                    className={`btn btn-secondary${uploading ? " btn-disabled" : ""}`}
                    onClick={uploading ? undefined : uploadSequence}
                  >
                    Upload Image Sequence…
                  </span>
                </div>
              )}
              {uploading && <span className="label">{uploadStage || "Uploading…"}</span>}
              {uploadError && <span className="upload-error">{uploadError}</span>}

              <span className="label">Selected files</span>
              <div className="file-list">
                {selectedFiles.length === 0 && (
                  <span className="label upload-no-files-hint">No files imported yet.</span>
                )}
                {selectedFiles.map((f) => (
                  <div className="card file-row" key={f.id}>
                    <div className="file-icon">
                      <FileIcon />
                    </div>
                    <span className="file-name">{f.name}</span>
                    {f.kind === "sequence" && <span className="pill file-size">{f.count} frames</span>}
                    {f.kind === "video" && <span className="pill file-size">{formatBytes(f.size)}</span>}
                    <span className="file-remove" onClick={() => removeSelectedFile(f.id)} title="Remove">
                      ×
                    </span>
                  </div>
                ))}
              </div>

              <span className="label">Version note</span>
              <div className="upload-note">
                <textarea
                  placeholder="What changed in this version…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="upload-actions">
                <div className="btn btn-secondary" onClick={resetAll}>
                  Cancel
                </div>
                <div className={`btn btn-primary${canSubmit ? "" : " btn-disabled"}`} onClick={canSubmit ? submit : undefined}>
                  Submit
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
