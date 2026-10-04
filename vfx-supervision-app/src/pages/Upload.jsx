import { useEffect, useState } from "react";
import { resolveCurrentArtist } from "../lib/currentArtist.js";
import { generateReviewProxy, generateSequenceReviewProxy, isProxyableFrame } from "../lib/ffmpeg.js";
import { buildTaskUploadPath, padScene } from "../lib/folderPath.js";
import {
  clearDirectory,
  copyFileInto,
  ensurePermission,
  formatVersion,
  getTaskReviewFolder,
  getTaskUploadFolder,
  getVersionFolder,
  isFsAccessSupported,
  latestVersionIn,
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

// Deleting something that's already gone (e.g. removed by hand in
// Explorer) isn't a failure.
function ignoreNotFound(err) {
  if (err?.name !== "NotFoundError") throw err;
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
  // { id, name, kind: "video" | "sequence" | "file", size?, count?, writtenNames }
  // — writtenNames is every file actually copied into the version folder
  // for this entry, so × can delete exactly those.
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [rootHandle, setRootHandle] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  // 0..1 for the current stage, or null when its length is unknown
  // (indeterminate bar, e.g. while ffmpeg itself is loading).
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  // The review proxy written for this submission, if any: { name, dir,
  // sourceId } — sourceId is the selectedFiles entry it was made from, so
  // removing that entry removes the proxy too.
  const [sessionProxy, setSessionProxy] = useState(null);
  const reviewFileName = sessionProxy?.name ?? null;
  // Versioning: each submission lands in render/vNNN/. "up" (the default)
  // starts a new version; "overwrite" replaces the latest one and needs an
  // explicit approval click first. Once the first file of a submission is
  // copied, sessionVersion locks every further upload into that same folder.
  const [diskLatestVersion, setDiskLatestVersion] = useState(null);
  const [versionMode, setVersionMode] = useState("up");
  const [overwriteApproved, setOverwriteApproved] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(null);
  // Handles for undoing this submission on disk: { renderDir, versionDir,
  // createdFresh } — createdFresh means this submission made the version
  // folder (version up), so discarding removes it; for an overwrite the
  // folder predates it and can only be emptied.
  const [sessionDirs, setSessionDirs] = useState(null);
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

  // Peek at render/ for existing version folders as soon as a task is
  // picked, if folder access is already granted (asking for it here would
  // need a click). Re-checked for real at upload time either way.
  useEffect(() => {
    setDiskLatestVersion(null);
    if (!selectedTask || !rootHandle || !selectedShot?.foldersCreatedAt) return;
    let cancelled = false;
    (async () => {
      if ((await rootHandle.queryPermission({ mode: "readwrite" })) !== "granted") return;
      const renderDir = await getTaskUploadFolder(rootHandle, {
        scene: padScene(selectedShot.scene),
        shotCode: selectedShot.shotCode,
        taskType: selectedTask.type,
      });
      if (renderDir && !cancelled) setDiskLatestVersion(await latestVersionIn(renderDir));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedTask?.id, rootHandle, selectedShot?.foldersCreatedAt]);

  const knownLatestVersion = Math.max(diskLatestVersion ?? 0, selectedTask?.version ?? 0);
  const plannedVersion = sessionVersion ?? (versionMode === "up" ? knownLatestVersion + 1 : knownLatestVersion);
  const awaitingOverwriteApproval = versionMode === "overwrite" && !overwriteApproved && sessionVersion == null;

  // Where this task's uploads actually land — shown so it's always
  // visually obvious, per task, before anything is picked.
  const uploadPath = selectedShot
    ? buildTaskUploadPath({
        show: project?.showCode,
        scene: selectedShot.scene,
        shotCode: selectedShot.shotCode,
        taskType: selectedTask?.type,
        version: selectedTask ? plannedVersion : undefined,
      })
    : null;

  const resetVersioning = () => {
    setVersionMode("up");
    setOverwriteApproved(false);
    setSessionVersion(null);
    setSessionDirs(null);
  };

  const chooseVersionMode = (mode) => {
    setVersionMode(mode);
    setOverwriteApproved(false);
  };

  const resetAll = () => {
    setSelectedShotId("");
    setSelectedTaskId("");
    setSelectedFiles([]);
    setNote("");
    setUploadError("");
    setSessionProxy(null);
    resetVersioning();
  };

  // Undoes everything this submission put on disk: a version folder it
  // created is removed outright; an overwritten one is emptied (its old
  // contents are already gone). The review proxy it wrote is deleted too.
  // Removed files are deleted, not moved anywhere — they're copies, and the
  // artist's originals are untouched.
  const discardUploadedFiles = async () => {
    if (!sessionDirs) return;
    const { renderDir, versionDir, createdFresh } = sessionDirs;
    if (createdFresh) {
      await renderDir.removeEntry(versionDir.name, { recursive: true }).catch(ignoreNotFound);
    } else {
      await clearDirectory(versionDir);
    }
    if (sessionProxy) await sessionProxy.dir.removeEntry(sessionProxy.name).catch(ignoreNotFound);
  };

  // Wraps a shot/task change or Cancel so files already uploaded for an
  // abandoned submission don't linger in render/ (where the next "version
  // up" would otherwise skip past them).
  const withDiscard = async (then) => {
    try {
      await discardUploadedFiles();
    } catch (err) {
      console.error("Couldn't remove uploaded files:", err);
      setUploadError(`Couldn't remove the files already uploaded: ${err?.message || err}`);
      return;
    }
    then();
  };

  const cancel = () => withDiscard(resetAll);

  // Choosing a shot or task invalidates whatever was picked downstream of
  // it — never leave an old task/file selection attached to a new shot.
  const chooseShot = (id) => {
    setSelectedShotId(id);
    setSelectedTaskId("");
    setSelectedFiles([]);
    setUploadError("");
    setSessionProxy(null);
    resetVersioning();
  };

  const chooseTask = (id) => {
    setSelectedTaskId(id);
    setSelectedFiles([]);
    setUploadError("");
    setSessionProxy(null);
    resetVersioning();
  };

  const reportProgress = (stage, fraction = null) => {
    setUploadStage(stage);
    setUploadProgress(fraction);
  };

  // Works out which version folder this upload goes into, without touching
  // anything on disk yet — the picker can still be cancelled, and neither
  // an empty new vNNN folder nor a wiped overwrite target should be left
  // behind if it is. pickerStart is where the file dialog opens.
  const resolveDestination = async () => {
    const ok = await ensurePermission(rootHandle);
    if (!ok) throw new Error("Project folder access was denied.");
    const renderDir = await getTaskUploadFolder(rootHandle, {
      scene: padScene(selectedShot.scene),
      shotCode: selectedShot.shotCode,
      taskType: selectedTask.type,
    });
    if (!renderDir) throw new Error(`No folder is set up for "${selectedTask.type}" yet.`);

    if (sessionVersion != null) {
      const dir = await getVersionFolder(renderDir, sessionVersion);
      return { renderDir, version: sessionVersion, clearFirst: false, pickerStart: dir };
    }
    const latest = Math.max(await latestVersionIn(renderDir), selectedTask.version ?? 0);
    setDiskLatestVersion(latest);
    if (versionMode === "overwrite") {
      if (latest === 0) throw new Error("There's no earlier version to overwrite yet.");
      if (!overwriteApproved) throw new Error(`Approve the overwrite of ${formatVersion(latest)} first.`);
      const dir = await getVersionFolder(renderDir, latest);
      return { renderDir, version: latest, clearFirst: true, pickerStart: dir };
    }
    return { renderDir, version: latest + 1, clearFirst: false, pickerStart: renderDir };
  };

  // Called once the artist has actually picked something: creates (or, for
  // an approved overwrite, empties) the version folder and locks the rest
  // of this submission into it.
  const openVersionFolder = async ({ renderDir, version, clearFirst }) => {
    const firstOfSession = sessionVersion == null;
    // A version-up folder normally doesn't exist yet; if a stale empty one
    // does, this submission still owns it and may remove it on discard.
    const createdFresh = firstOfSession && !clearFirst;
    const dir = await getVersionFolder(renderDir, version);
    if (clearFirst) await clearDirectory(dir);
    setSessionVersion(version);
    if (firstOfSession) setSessionDirs({ renderDir, versionDir: dir, createdFresh });
    return dir;
  };

  const proxyNameFor = (version) => `${selectedShot.shotCode}_${formatVersion(version)}_proxy.mp4`;

  const uploadVideo = async () => {
    setUploadError("");
    try {
      // Resolve the destination before opening the picker so it can hint
      // the dialog to open there (startIn) — makes it visually obvious
      // which task/shot folder this upload is actually headed for.
      const dest = await resolveDestination();
      const file = await pickVideoFile(dest.pickerStart);
      setUploading(true);
      const destDir = await openVersionFolder(dest);
      reportProgress("Copying video…", 0);
      await copyFileInto(destDir, file.name, file, {
        onProgress: (written, total) => reportProgress("Copying video…", written / total),
      });
      const entryId = crypto.randomUUID();
      setSelectedFiles((prev) => [
        ...prev,
        { id: entryId, name: file.name, kind: "video", size: file.size, writtenNames: [file.name] },
      ]);

      // Best-effort: a review proxy makes Review & Dailies usable, but its
      // failure (e.g. an exotic codec ffmpeg.wasm can't decode) shouldn't
      // block the actual submitted file from having been uploaded above.
      try {
        const proxyBlob = await generateReviewProxy(file, { onProgress: reportProgress });
        const reviewDir = await getTaskReviewFolder(rootHandle, {
          scene: padScene(selectedShot.scene),
          shotCode: selectedShot.shotCode,
          taskType: selectedTask.type,
        });
        if (reviewDir) {
          const proxyName = proxyNameFor(dest.version);
          await copyFileInto(reviewDir, proxyName, proxyBlob);
          setSessionProxy({ name: proxyName, dir: reviewDir, sourceId: entryId });
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
      reportProgress("");
    }
  };

  const uploadSequence = async () => {
    setUploadError("");
    try {
      const dest = await resolveDestination();
      const folderHandle = await pickSequenceFolder(dest.pickerStart);
      // The picker opens at the destination (so it's obvious where an
      // upload is headed) — which also makes it easy to pick render/ or one
      // of its version folders as the "source". That would copy files this
      // app already wrote over themselves, and for an overwrite it would
      // pick the very folder about to be emptied.
      if ((await dest.renderDir.resolve(folderHandle)) !== null) {
        setUploadError("That's inside the render folder — pick the folder where your rendered frames actually live.");
        return;
      }
      setUploading(true);
      const files = await readFolderFiles(folderHandle);
      if (files.length === 0) {
        setUploadError("That folder is empty.");
        return;
      }
      const destDir = await openVersionFolder(dest);
      const groups = groupSequenceFiles(files);
      const totalFiles = files.length;
      let copied = 0;
      reportProgress(`Copying frames… 0/${totalFiles}`, 0);
      for (const group of groups) {
        for (const file of group.files) {
          await copyFileInto(destDir, file.name, file);
          copied++;
          reportProgress(`Copying frames… ${copied}/${totalFiles}`, copied / totalFiles);
        }
      }
      const entries = groups.map((g) => ({
        id: crypto.randomUUID(),
        name: g.name,
        kind: g.kind,
        count: g.files.length,
        writtenNames: g.files.map((f) => f.name),
      }));
      setSelectedFiles((prev) => [...prev, ...entries]);

      // Best-effort, same as the video path: proxy the longest image
      // sequence in the folder (stray single files are ignored).
      const proxySource = groups
        .filter((g) => g.kind === "sequence" && isProxyableFrame(g.files[0]))
        .sort((a, b) => b.files.length - a.files.length)[0];
      if (proxySource) {
        try {
          const proxyBlob = await generateSequenceReviewProxy(proxySource.files, { onProgress: reportProgress });
          const reviewDir = await getTaskReviewFolder(rootHandle, {
            scene: padScene(selectedShot.scene),
            shotCode: selectedShot.shotCode,
            taskType: selectedTask.type,
          });
          if (reviewDir) {
            const proxyName = proxyNameFor(dest.version);
            await copyFileInto(reviewDir, proxyName, proxyBlob);
            setSessionProxy({ name: proxyName, dir: reviewDir, sourceId: entries[groups.indexOf(proxySource)].id });
          }
        } catch (proxyErr) {
          console.error("Sequence review proxy generation failed:", proxyErr);
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Sequence upload failed:", err);
        setUploadError(err?.message || "Couldn't upload that folder.");
      }
    } finally {
      setUploading(false);
      reportProgress("");
    }
  };

  // × deletes that entry's files from the version folder (a sequence's
  // every frame), plus the review proxy if it was made from them. Removing
  // the last entry discards the whole submission, unlocking the version
  // choice again.
  const removeSelectedFile = async (id) => {
    const entry = selectedFiles.find((f) => f.id === id);
    if (!entry || !sessionDirs) return;
    const remaining = selectedFiles.filter((f) => f.id !== id);
    setUploadError("");
    try {
      if (remaining.length === 0) {
        await discardUploadedFiles();
        setSelectedFiles([]);
        setSessionProxy(null);
        resetVersioning();
        return;
      }
      // A later upload with the same filename replaced the earlier copy on
      // disk — keep any file another entry still refers to.
      const stillUsed = new Set(remaining.flatMap((f) => f.writtenNames));
      for (const name of entry.writtenNames) {
        if (!stillUsed.has(name)) await sessionDirs.versionDir.removeEntry(name).catch(ignoreNotFound);
      }
      if (sessionProxy?.sourceId === id) {
        await sessionProxy.dir.removeEntry(sessionProxy.name).catch(ignoreNotFound);
        setSessionProxy(null);
      }
      setSelectedFiles(remaining);
    } catch (err) {
      console.error("Couldn't remove file:", err);
      setUploadError(`Couldn't remove ${entry.name}: ${err?.message || err}`);
    }
  };

  const canSubmit = Boolean(selectedTask) && selectedFiles.length > 0 && sessionVersion != null;

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
                      version: sessionVersion,
                      // One entry per version; an overwrite replaces its
                      // version's entry rather than adding a second one.
                      versionHistory: [
                        ...(t.versionHistory ?? []).filter((v) => v.version !== sessionVersion),
                        { version: sessionVersion, submittedAt: new Date().toISOString(), note: note.trim() || undefined },
                      ].sort((a, b) => a.version - b.version),
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
    setConfirmation(
      `${selectedShot.shotCode} — ${selectedTask.type} ${formatVersion(sessionVersion)} submitted — now pending supervisor review`
    );
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
          <select
            className="attach-select"
            value={selectedShotId}
            disabled={uploading}
            onChange={(e) => {
              const id = e.target.value;
              withDiscard(() => chooseShot(id));
            }}
          >
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
              <select
                className="attach-select"
                value={selectedTaskId}
                disabled={uploading}
                onChange={(e) => {
                  const id = e.target.value;
                  withDiscard(() => chooseTask(id));
                }}
              >
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
              <span className="label">Version</span>
              {sessionVersion != null ? (
                <span className="upload-version-locked">
                  Uploading into <span className="pill pill-accent mono">{formatVersion(sessionVersion)}</span>
                  {versionMode === "overwrite" && <span className="upload-version-overwrite-tag">overwrite</span>}
                </span>
              ) : (
                <>
                  <div className="upload-version-toggle">
                    <span
                      className={`btn ${versionMode === "up" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => chooseVersionMode("up")}
                    >
                      Version up → {formatVersion(knownLatestVersion + 1)}
                    </span>
                    <span
                      className={`btn ${versionMode === "overwrite" ? "btn-danger" : "btn-secondary"}${
                        knownLatestVersion === 0 ? " btn-disabled" : ""
                      }`}
                      onClick={knownLatestVersion === 0 ? undefined : () => chooseVersionMode("overwrite")}
                      title={knownLatestVersion === 0 ? "Nothing has been submitted for this task yet" : undefined}
                    >
                      Overwrite {knownLatestVersion === 0 ? "…" : formatVersion(knownLatestVersion)}
                    </span>
                  </div>
                  {versionMode === "overwrite" && (
                    <div className="card upload-overwrite-warning">
                      <span>
                        Overwriting deletes everything currently in{" "}
                        <span className="mono">{formatVersion(knownLatestVersion)}</span> and replaces it with what you upload
                        now. The old files are not kept.
                      </span>
                      {overwriteApproved ? (
                        <span className="upload-overwrite-approved">Overwrite approved</span>
                      ) : (
                        <span className="btn btn-danger" onClick={() => setOverwriteApproved(true)}>
                          Approve overwrite
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}

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
                  <span
                    className={`btn btn-secondary${uploading || awaitingOverwriteApproval ? " btn-disabled" : ""}`}
                    onClick={uploading || awaitingOverwriteApproval ? undefined : uploadVideo}
                  >
                    Upload Video…
                  </span>
                  <span
                    className={`btn btn-secondary${uploading || awaitingOverwriteApproval ? " btn-disabled" : ""}`}
                    onClick={uploading || awaitingOverwriteApproval ? undefined : uploadSequence}
                  >
                    Upload Image Sequence…
                  </span>
                </div>
              )}
              {uploading && (
                <div className="upload-progress">
                  <div className="upload-progress-header">
                    <span className="label">{uploadStage || "Uploading…"}</span>
                    {uploadProgress != null && (
                      <span className="upload-progress-pct mono">{Math.round(uploadProgress * 100)}%</span>
                    )}
                  </div>
                  <div
                    className={`upload-progress-track${uploadProgress == null ? " indeterminate" : ""}`}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uploadProgress == null ? undefined : Math.round(uploadProgress * 100)}
                  >
                    <div
                      className="upload-progress-fill"
                      style={uploadProgress == null ? undefined : { width: `${uploadProgress * 100}%` }}
                    />
                  </div>
                </div>
              )}
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
                    <span
                      className={`file-remove${uploading ? " file-remove-disabled" : ""}`}
                      onClick={uploading ? undefined : () => removeSelectedFile(f.id)}
                      title="Remove (deletes the uploaded copy)"
                    >
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
                <div className={`btn btn-secondary${uploading ? " btn-disabled" : ""}`} onClick={uploading ? undefined : cancel}>
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
