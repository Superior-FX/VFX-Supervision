import { useEffect, useState } from "react";
import FolderStatusBanner from "../components/FolderStatusBanner.jsx";
import { resolveCurrentArtist } from "../lib/currentArtist.js";
import { generateReviewProxy, generateSequenceReviewProxy, isProxyableFrame } from "../lib/ffmpeg.js";
import { buildTaskReviewPath, buildTaskUploadPath, padScene } from "../lib/folderPath.js";
import {
  copyFileInto,
  ensurePermission,
  fileExists,
  formatVersion,
  getTaskReviewFolder,
  getTaskUploadFolder,
  isFsAccessSupported,
  latestProxyVersionIn,
  pickSequenceFolder,
  pickVideoFile,
  readFolderFiles,
} from "../lib/fsAccess.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { groupSequenceFiles } from "../lib/sequenceGrouping.js";
import { hqProxyName } from "../lib/hqProxy.js";
import { sortByDueComplexityName } from "../lib/sortShots.js";
import { hasAssignee } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import { useProjectFolder } from "../lib/useProjectFolder.js";
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
  // { id, name, kind: "video" | "sequence" | "file", size?, count?, names,
  //   createdNames, inPlace }
  // names: every file this entry covers. createdNames: the ones this
  // submission newly copied into render/ — the only ones × / Cancel may
  // delete. A file that replaced an existing one of the same name, or work
  // picked from inside render/ itself (inPlace), is never deleted.
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const folder = useProjectFolder(project);
  const rootHandle = folder.rootHandle;
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  // 0..1 for the current stage, or null when its length is unknown
  // (indeterminate bar, e.g. while ffmpeg itself is loading).
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  // Shown when an upload went through but no review proxy came out of it —
  // otherwise that only ever reached the browser console.
  const [proxyWarning, setProxyWarning] = useState("");
  // Review proxies written for this submission: [{ name, sourceId }]. A video
  // and a sequence each get their own (…_vid_proxy / …_seq_proxy); sourceId
  // is the selectedFiles entry a proxy was made from, so removing that entry
  // removes its proxy too. The most recent one is what Review & Dailies plays.
  const [sessionProxies, setSessionProxies] = useState([]);
  const reviewFileName = sessionProxies.at(-1)?.name ?? null;
  // Versioning applies to review proxies only — renders always go straight
  // into render/. "up" (the default) gives this submission's proxy the next
  // version number; "overwrite" reuses the latest number and, on Submit,
  // deletes that version's old proxy. Overwrite needs an approval click
  // first. sessionVersion locks once the first file is uploaded.
  const [diskLatestVersion, setDiskLatestVersion] = useState(null);
  const [versionMode, setVersionMode] = useState("up");
  const [overwriteApproved, setOverwriteApproved] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(null);
  // { renderDir, reviewDir } for this submission, set with sessionVersion.
  const [sessionDirs, setSessionDirs] = useState(null);
  const supported = isFsAccessSupported();

  const currentArtist = resolveCurrentArtist(artists);
  const myTask = (t) => hasAssignee(t, currentArtist?.name);


  // Same "what's actually actionable right now" scoping as before: only
  // shots where this artist has a task in wip show up at all.
  const myShots = currentArtist
    ? sortByDueComplexityName(postReports.filter((s) => s.tasks.some((t) => myTask(t) && t.status === "wip")))
    : [];

  const selectedShot = myShots.find((s) => s.id === selectedShotId);
  const myWipTasksOnShot = selectedShot ? selectedShot.tasks.filter((t) => myTask(t) && t.status === "wip") : [];
  const selectedTask = myWipTasksOnShot.find((t) => t.id === selectedTaskId);

  const taskFolderArgs = () => ({
    scene: padScene(selectedShot.scene),
    shotCode: selectedShot.shotCode,
    taskType: selectedTask.type,
  });

  // Peek at the review folder for existing proxy versions as soon as a task
  // is picked, if folder access is already granted (asking for it here
  // would need a click). Re-checked for real at upload time either way.
  useEffect(() => {
    setDiskLatestVersion(null);
    if (!selectedTask || !rootHandle || !selectedShot?.foldersCreatedAt) return;
    let cancelled = false;
    (async () => {
      if ((await rootHandle.queryPermission({ mode: "readwrite" })) !== "granted") return;
      const reviewDir = await getTaskReviewFolder(rootHandle, taskFolderArgs());
      if (reviewDir && !cancelled) setDiskLatestVersion(await latestProxyVersionIn(reviewDir, selectedShot.shotCode));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedTask?.id, rootHandle, selectedShot?.foldersCreatedAt]);

  const knownLatestVersion = Math.max(diskLatestVersion ?? 0, selectedTask?.version ?? 0);
  const plannedVersion = sessionVersion ?? (versionMode === "up" ? knownLatestVersion + 1 : knownLatestVersion);
  const awaitingOverwriteApproval = versionMode === "overwrite" && !overwriteApproved && sessionVersion == null;

  // Where this task's renders and proxy land — shown so it's always
  // visually obvious, per task, before anything is picked.
  const pathArgs = selectedShot && {
    show: project?.showCode,
    scene: selectedShot.scene,
    shotCode: selectedShot.shotCode,
    taskType: selectedTask?.type,
  };
  const uploadPath = pathArgs ? buildTaskUploadPath(pathArgs) : null;
  const reviewPath = pathArgs && selectedTask ? buildTaskReviewPath(pathArgs) : null;

  // kind: "vid" (made from an uploaded video) or "seq" (from an image
  // sequence).
  const proxyNameFor = (version, kind) => `${selectedShot.shotCode}_${formatVersion(version)}_${kind}_proxy.mp4`;

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
    setProxyWarning("");
    setSessionProxies([]);
    resetVersioning();
  };

  // Undoes everything this submission put on disk: the render files it
  // newly copied in and the proxies it wrote. Deleted outright, not moved —
  // they're copies, and the artist's originals are untouched.
  const discardUploadedFiles = async () => {
    if (!sessionDirs) return;
    for (const name of selectedFiles.flatMap((f) => f.createdNames)) {
      await sessionDirs.renderDir.removeEntry(name).catch(ignoreNotFound);
    }
    for (const proxy of sessionProxies) await sessionDirs.reviewDir.removeEntry(proxy.name).catch(ignoreNotFound);
  };

  // Wraps a shot/task change or Cancel so files already uploaded for an
  // abandoned submission don't linger.
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
    setProxyWarning("");
    setSessionProxies([]);
    resetVersioning();
  };

  const chooseTask = (id) => {
    setSelectedTaskId(id);
    setSelectedFiles([]);
    setUploadError("");
    setProxyWarning("");
    setSessionProxies([]);
    resetVersioning();
  };

  const reportProgress = (stage, fraction = null) => {
    setUploadStage(stage);
    setUploadProgress(fraction);
  };

  // Resolves render/ + the review folder and which proxy version this
  // upload belongs to. Nothing is written yet — the picker can still be
  // cancelled.
  const resolveDestination = async () => {
    const ok = await ensurePermission(rootHandle);
    if (!ok) throw new Error("Project folder access was denied.");
    const renderDir = await getTaskUploadFolder(rootHandle, taskFolderArgs());
    const reviewDir = await getTaskReviewFolder(rootHandle, taskFolderArgs());
    if (!renderDir || !reviewDir) throw new Error(`No folder is set up for "${selectedTask.type}" yet.`);

    if (sessionVersion != null) return { renderDir, reviewDir, version: sessionVersion };
    const latest = Math.max(await latestProxyVersionIn(reviewDir, selectedShot.shotCode), selectedTask.version ?? 0);
    setDiskLatestVersion(latest);
    if (versionMode === "overwrite") {
      if (latest === 0) throw new Error("There's no earlier version to overwrite yet.");
      if (!overwriteApproved) throw new Error(`Approve the overwrite of ${formatVersion(latest)} first.`);
      return { renderDir, reviewDir, version: latest };
    }
    return { renderDir, reviewDir, version: latest + 1 };
  };

  // Called once the artist has actually picked something: locks the rest
  // of this submission to that version.
  const beginSession = (dest) => {
    if (sessionVersion != null) return;
    setSessionVersion(dest.version);
    setSessionDirs({ renderDir: dest.renderDir, reviewDir: dest.reviewDir });
  };

  // Copies into render/, reporting whether the file is new there (and so
  // safe for × / Cancel to delete later) or replaced an existing one.
  const copyIntoRender = async (renderDir, file, opts) => {
    const existed = await fileExists(renderDir, file.name);
    await copyFileInto(renderDir, file.name, file, opts);
    return !existed;
  };

  const writeProxy = async (dest, blob, kind, sourceId) => {
    const name = proxyNameFor(dest.version, kind);
    await copyFileInto(dest.reviewDir, name, blob);
    setSessionProxies((prev) => [...prev.filter((p) => p.name !== name), { name, sourceId }]);
  };

  const uploadVideo = async () => {
    setUploadError("");
    setProxyWarning("");
    try {
      const dest = await resolveDestination();
      const { file, handle } = await pickVideoFile(dest.renderDir);
      setUploading(true);
      beginSession(dest);
      // A video already sitting in render/ (e.g. rendered straight there)
      // doesn't need copying — it's used where it is.
      const inPlace = (await dest.renderDir.resolve(handle)) !== null;
      let created = false;
      if (!inPlace) {
        reportProgress("Copying video…", 0);
        created = await copyIntoRender(dest.renderDir, file, {
          onProgress: (written, total) => reportProgress("Copying video…", written / total),
        });
      }
      const entryId = crypto.randomUUID();
      setSelectedFiles((prev) => [
        ...prev,
        {
          id: entryId,
          name: file.name,
          kind: "video",
          size: file.size,
          names: [file.name],
          createdNames: created ? [file.name] : [],
          inPlace,
        },
      ]);

      // Best-effort: a review proxy makes Review & Dailies usable, but its
      // failure (e.g. an exotic codec ffmpeg.wasm can't decode) shouldn't
      // block the actual submitted file from having been uploaded above.
      try {
        const proxyBlob = await generateReviewProxy(file, { onProgress: reportProgress });
        await writeProxy(dest, proxyBlob, "vid", entryId);
      } catch (proxyErr) {
        console.error("Review proxy generation failed:", proxyErr);
        setProxyWarning(`The video uploaded, but no review proxy could be made: ${proxyErr?.message || proxyErr}`);
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
    setProxyWarning("");
    try {
      const dest = await resolveDestination();
      const folderHandle = await pickSequenceFolder(dest.renderDir);
      setUploading(true);
      const files = await readFolderFiles(folderHandle);
      if (files.length === 0) {
        setUploadError("That folder is empty.");
        return;
      }
      beginSession(dest);
      // Frames already inside render/ (rendered straight there, or into a
      // subfolder of it) are used where they are — copying them onto
      // themselves would be pointless.
      const inPlace = (await dest.renderDir.resolve(folderHandle)) !== null;
      const groups = groupSequenceFiles(files);
      const created = new Set();
      if (!inPlace) {
        let copied = 0;
        reportProgress(`Copying frames… 0/${files.length}`, 0);
        for (const group of groups) {
          for (const file of group.files) {
            if (await copyIntoRender(dest.renderDir, file)) created.add(file.name);
            copied++;
            reportProgress(`Copying frames… ${copied}/${files.length}`, copied / files.length);
          }
        }
      }
      const entries = groups.map((g) => ({
        id: crypto.randomUUID(),
        name: g.name,
        kind: g.kind,
        count: g.files.length,
        names: g.files.map((f) => f.name),
        createdNames: g.files.map((f) => f.name).filter((n) => created.has(n)),
        inPlace,
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
          await writeProxy(dest, proxyBlob, "seq", entries[groups.indexOf(proxySource)].id);
        } catch (proxyErr) {
          console.error("Sequence review proxy generation failed:", proxyErr);
          setProxyWarning(`The frames uploaded, but no review proxy could be made: ${proxyErr?.message || proxyErr}`);
        }
      } else {
        setProxyWarning(
          "The files uploaded, but no review proxy was made — that folder has no numbered image sequence (exr, dpx, png, jpg, tif or tga)."
        );
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

  // × deletes the render files this entry newly copied in (a sequence's
  // every frame), plus the proxy made from it. Removing the last entry
  // discards the whole submission, unlocking the version choice again.
  const removeSelectedFile = async (id) => {
    const entry = selectedFiles.find((f) => f.id === id);
    if (!entry || !sessionDirs) return;
    const remaining = selectedFiles.filter((f) => f.id !== id);
    setUploadError("");
    try {
      if (remaining.length === 0) {
        await discardUploadedFiles();
        setSelectedFiles([]);
        setSessionProxies([]);
        resetVersioning();
        return;
      }
      // Keep any file another entry still refers to.
      const stillUsed = new Set(remaining.flatMap((f) => f.names));
      for (const name of entry.createdNames) {
        if (!stillUsed.has(name)) await sessionDirs.renderDir.removeEntry(name).catch(ignoreNotFound);
      }
      const ownProxies = sessionProxies.filter((p) => p.sourceId === id);
      for (const proxy of ownProxies) await sessionDirs.reviewDir.removeEntry(proxy.name).catch(ignoreNotFound);
      if (ownProxies.length) setSessionProxies((prev) => prev.filter((p) => p.sourceId !== id));
      setSelectedFiles(remaining);
    } catch (err) {
      console.error("Couldn't remove file:", err);
      setUploadError(`Couldn't remove ${entry.name}: ${err?.message || err}`);
    }
  };

  const canSubmit = Boolean(selectedTask) && selectedFiles.length > 0 && sessionVersion != null;

  const submit = async () => {
    if (!canSubmit) return;
    // An approved overwrite replaces the version's proxy: delete whichever
    // of its old proxies this submission didn't just rewrite. Done here, not
    // at upload time, so Cancel never leaves the version with no proxy.
    const deletedProxies = [];
    if (versionMode === "overwrite") {
      const keep = new Set(sessionProxies.map((p) => p.name));
      const legacyName = `${selectedShot.shotCode}_${formatVersion(sessionVersion)}_proxy.mp4`; // from before the vid/seq suffix
      for (const name of [proxyNameFor(sessionVersion, "vid"), proxyNameFor(sessionVersion, "seq"), legacyName]) {
        if (keep.has(name)) continue;
        try {
          await sessionDirs.reviewDir.removeEntry(name);
          deletedProxies.push(name);
        } catch (err) {
          if (err?.name !== "NotFoundError") console.error(`Couldn't delete old proxy ${name}:`, err);
        }
      }
      // The supervisor's HQ / 6K/8K renders were made from the old render,
      // so they go too — they'd show frames that no longer exist.
      const oldRenders = [
        hqProxyName(selectedShot.shotCode, sessionVersion, "vid"),
        hqProxyName(selectedShot.shotCode, sessionVersion, "seq"),
      ];
      // Best-effort: a leftover file is untidy, but must never block the submit.
      const logCleanupError = (what) => (err) => {
        if (err?.name !== "NotFoundError") console.error(`Couldn't delete old ${what}:`, err);
      };
      for (const name of oldRenders) await sessionDirs.reviewDir.removeEntry(name).catch(logCleanupError(name));
      for (const render of (selectedTask.uhqRenders ?? []).filter((r) => r.version === sessionVersion)) {
        await sessionDirs.reviewDir
          .removeEntry(render.folder, { recursive: true })
          .catch(logCleanupError(render.folder));
      }
    }
    // Which submitted files the proxy was made from, so a supervisor's HQ
    // render later uses exactly those (render/ is shared across versions).
    const proxied = sessionProxies.at(-1);
    const proxiedEntry = proxied && selectedFiles.find((f) => f.id === proxied.sourceId);
    const sourceRecord = proxiedEntry
      ? { kind: proxied.name.includes("_seq_") ? "seq" : "vid", names: proxiedEntry.names }
      : null;
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
                      // Keep the previous proxy if no new one was made (e.g.
                      // a stray-files-only upload) — unless it was just
                      // deleted by the overwrite.
                      reviewFile: reviewFileName ?? (deletedProxies.includes(t.reviewFile) ? undefined : t.reviewFile),
                      // An overwrite replaces this version's proxy, so marks
                      // drawn on the old frames no longer line up.
                      annotations: (t.annotations ?? []).filter((a) => a.version !== sessionVersion),
                      sourceFiles: (() => {
                        const { [sessionVersion]: _old, ...rest } = t.sourceFiles ?? {};
                        return sourceRecord ? { ...rest, [sessionVersion]: sourceRecord } : rest;
                      })(),
                      hqProxies: (() => {
                        const { [sessionVersion]: _old, ...rest } = t.hqProxies ?? {};
                        return rest;
                      })(),
                      uhqRenders: (t.uhqRenders ?? []).filter((r) => r.version !== sessionVersion),
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
      <FolderStatusBanner
        folder={folder}
        show={myShots.some((s) => s.foldersCreatedAt)}
        showCode={project?.showCode}
        impact="renders and review proxies can't be uploaded"
      />

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
              <span className="label">Proxy version</span>
              {sessionVersion != null ? (
                <span className="upload-version-locked">
                  This submission is <span className="pill pill-accent mono">{formatVersion(sessionVersion)}</span>
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
                        Overwriting replaces the <span className="mono">{formatVersion(knownLatestVersion)}</span> review
                        proxy with one made from what you upload now. The old proxy is deleted when you submit.
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
              {uploadPath && (
                <span className="upload-destination-path mono">
                  Renders → {uploadPath}
                  {reviewPath && (
                    <>
                      <br />
                      Proxy → {reviewPath}/{selectedShot.shotCode}_{formatVersion(plannedVersion)}_…_proxy.mp4
                    </>
                  )}
                </span>
              )}
              {!supported ? (
                <span className="label upload-hint">Automatic uploads need Chrome or Edge.</span>
              ) : !rootHandle ? (
                <span className="label upload-hint">
                  The project folder isn't connected — reconnect it above to upload.
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
              {proxyWarning && <span className="upload-proxy-warning">{proxyWarning}</span>}
              {sessionProxies.length > 0 && (
                <span className="upload-destination-path mono">
                  Proxy written: {sessionProxies.map((p) => p.name).join(", ")}
                </span>
              )}

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
                    {f.inPlace && <span className="pill file-size">in render/</span>}
                    {f.kind === "sequence" && <span className="pill file-size">{f.count} frames</span>}
                    {f.kind === "video" && <span className="pill file-size">{formatBytes(f.size)}</span>}
                    <span
                      className={`file-remove${uploading ? " file-remove-disabled" : ""}`}
                      onClick={uploading ? undefined : () => removeSelectedFile(f.id)}
                      title={f.inPlace ? "Remove from this submission (the files stay in render/)" : "Remove (deletes the uploaded copy)"}
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
