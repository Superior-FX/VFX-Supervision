import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../logo/SuperiorFX_logo_003.jpg";
import { downloadExport, exportBrowserData, exportToFolder, importAllData, isValidExport } from "../lib/backup.js";
import {
  createOrLinkProjectRootFolder,
  createProjectRootFolder,
  deleteRootHandle,
  ensurePermission,
  isFsAccessSupported,
  listJsonFiles,
  loadBackupFolderHandle,
  loadRootHandle,
  migrateLegacyRootHandle,
  pickBackupFolder,
  pickDestinationFolder,
  readJsonFile,
} from "../lib/fsAccess.js";
import { useActiveProjectId, useProjects } from "../lib/projects.js";
import { deleteProjectData } from "../lib/sharedStore.js";
import { useEnterKey } from "../lib/useEnterKey.js";
import { useRole } from "../lib/role.js";
import UserBadge from "../components/UserBadge.jsx";
import DeleteRequestsBanner from "../components/DeleteRequestsBanner.jsx";
import { useDeleteRequests } from "../lib/deleteRequests.jsx";
import "./Home.css";

const LEADING_ARTICLES = new Set(["the", "a", "an"]);
const SHOW_CODE_MIN = 3;
const SHOW_CODE_MAX = 4;

// Initials of each significant word, e.g. "The Girl on the Plane" -> GOTP
// (a leading article is dropped, but "on"/"the" mid-title still count).
// Short titles get padded with extra letters from their own words so the
// code never falls below the minimum length.
function deriveShowCode(name) {
  const rawWords = name.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return "";

  const words =
    rawWords.length > 1 && LEADING_ARTICLES.has(rawWords[0].toLowerCase()) ? rawWords.slice(1) : rawWords;

  let code = words.map((w) => w[0]).join("").toUpperCase();

  if (code.length < SHOW_CODE_MIN) {
    // Fill toward the max, not just up to the minimum — e.g. "Jaws" should
    // land on JAWS, not stop early at JAW.
    const extraLetters = words.flatMap((w) => w.slice(1).split(""));
    for (const letter of extraLetters) {
      if (code.length >= SHOW_CODE_MAX) break;
      code += letter.toUpperCase();
    }
  }

  return code.slice(0, SHOW_CODE_MAX);
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 10.5v5M9.5 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Shown when the project is already linked to a folder, so picking a new
// location is a deliberate choice rather than a silent re-point.
function ProjectFolderRelink({ project, linkedName, onChoose, onCancel }) {
  useEnterKey(onChoose);
  return (
    <div className="card home-project-confirm home-project-folder-confirm" onClick={(e) => e.stopPropagation()}>
      <span className="home-project-confirm-label">
        {project.name} is linked to the "{linkedName}" folder. Choose a new location to create (or link) a{" "}
        {project.showCode} folder there instead? Nothing in the current folder is moved or deleted.
      </span>
      <div className="home-project-confirm-actions">
        <span className="btn btn-primary" onClick={onChoose}>
          Choose Location…
        </span>
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
    </div>
  );
}

function ProjectDeleteConfirm({ project, requestOnly, onConfirm, onCancel }) {
  const [text, setText] = useState("");
  const matches = text.trim().toUpperCase() === "DELETE";
  useEnterKey(() => {
    if (matches) onConfirm();
  });

  return (
    <div className="card home-project-confirm" onClick={(e) => e.stopPropagation()}>
      <span className="home-project-confirm-label">
        {requestOnly ? "Type DELETE to ask an Admin to remove" : "Type DELETE to permanently remove"} {project.name} (
        {project.showCode}) and all of its shots and reports
      </span>
      <input
        className="report-edit-input mono home-project-confirm-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="DELETE"
        autoFocus
      />
      <div className="home-project-confirm-actions">
        <span className={`btn btn-danger${matches ? "" : " btn-disabled"}`} onClick={matches ? onConfirm : undefined}>
          {requestOnly ? "Request delete" : "Confirm delete"}
        </span>
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
    </div>
  );
}

function ImportConfirm({ fileName, data, fromBrowser, busy, error, onConfirm, onCancel }) {
  const [text, setText] = useState("");
  const matches = text.trim().toUpperCase() === "IMPORT" && !busy;
  useEnterKey(() => {
    if (matches) onConfirm();
  });

  const projectCount = data.projects?.length ?? 0;
  const exportedAt = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : "unknown date";

  return (
    <div className="card home-new-project">
      <span className="label">{fromBrowser ? "Upload this browser's data" : "Import backup"}</span>
      <span className="home-project-confirm-label">
        This replaces the team's shared data — every project, shot, scene, and the artist roster, for everyone —
        with the {projectCount} project{projectCount === 1 ? "" : "s"}{" "}
        {fromBrowser ? "saved in this browser" : `from "${fileName}" (exported ${exportedAt})`}. This can't be
        undone. Type IMPORT to continue.
      </span>
      <input
        className="report-edit-input mono home-project-confirm-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="IMPORT"
        autoFocus
      />
      <div className="home-project-confirm-actions">
        <span className={`btn btn-danger${matches ? "" : " btn-disabled"}`} onClick={matches ? onConfirm : undefined}>
          {busy ? "Uploading…" : fromBrowser ? "Upload" : "Replace with backup"}
        </span>
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
      {error && <span className="home-new-project-error">{error}</span>}
    </div>
  );
}

function BackupFileList({ folderName, files, onPick, onCancel }) {
  return (
    <div className="card home-new-project">
      <span className="label">Import from {folderName}/</span>
      <div className="home-backup-file-list">
        {files.map((name) => (
          <span className="home-backup-file-row mono" key={name} onClick={() => onPick(name)}>
            {name}
          </span>
        ))}
      </div>
      <div className="home-new-project-actions">
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
    </div>
  );
}

function NewProjectForm({ onCreate, onCancel }) {
  const [name, setName] = useState("");
  const [showCode, setShowCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [destinationHandle, setDestinationHandle] = useState(null);
  const [folderError, setFolderError] = useState("");
  const [creating, setCreating] = useState(false);
  const supported = isFsAccessSupported();

  // Stable id for this draft so the folder handle can be saved under it
  // once Create Project actually makes the folder.
  const draftId = useMemo(() => crypto.randomUUID(), []);

  const handleNameChange = (value) => {
    setName(value);
    if (!codeTouched) setShowCode(deriveShowCode(value));
  };

  const showCodeValid = showCode.trim().length >= SHOW_CODE_MIN && showCode.trim().length <= SHOW_CODE_MAX;

  const pickFolder = async () => {
    try {
      const handle = await pickDestinationFolder();
      setDestinationHandle(handle);
      setFolderError("");
    } catch (err) {
      if (err?.name !== "AbortError") setFolderError("Couldn't get folder access — try again.");
    }
  };

  const canCreate = name.trim() && showCodeValid && (!supported || destinationHandle) && !creating;

  const create = async () => {
    if (!canCreate) return;
    const trimmedShowCode = showCode.trim().toUpperCase();
    if (destinationHandle) {
      setCreating(true);
      try {
        await createProjectRootFolder(draftId, destinationHandle, trimmedShowCode);
      } catch (err) {
        setCreating(false);
        setFolderError("Couldn't create the project folder — try choosing the destination again.");
        return;
      }
      setCreating(false);
    }
    onCreate({
      id: draftId,
      name: name.trim(),
      showCode: trimmedShowCode,
      deliveryDate: deliveryDate || undefined,
      createdAt: new Date().toISOString(),
    });
  };
  useEnterKey(create);

  return (
    <div className="card home-new-project">
      <span className="label">New project</span>
      <div className="home-new-project-fields">
        <input
          className="report-edit-input"
          placeholder="Project name, e.g. The Girl on the Plane"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          autoFocus
        />
        <input
          className="report-edit-input mono home-new-project-code"
          placeholder="SHOW"
          value={showCode}
          maxLength={SHOW_CODE_MAX}
          onChange={(e) => {
            setCodeTouched(true);
            setShowCode(e.target.value.toUpperCase());
          }}
        />
      </div>
      <label className="home-new-project-delivery">
        <span className="label">Delivery date (optional)</span>
        <input
          type="date"
          className="report-edit-input"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
        />
      </label>
      {showCode && showCode.trim().length < SHOW_CODE_MIN && (
        <span className="home-new-project-error">Show code needs at least {SHOW_CODE_MIN} letters.</span>
      )}

      {supported ? (
        <span className="btn btn-secondary" onClick={pickFolder}>
          {destinationHandle ? `Destination: ${destinationHandle.name}` : "Choose Destination Folder…"}
        </span>
      ) : (
        <span className="label home-new-project-hint">
          Automatic folder creation needs Chrome or Edge — you can still track shots and copy folder paths manually.
        </span>
      )}
      {folderError && <span className="home-new-project-error">{folderError}</span>}

      <div className="home-new-project-actions">
        <span className={`btn btn-primary${canCreate ? "" : " btn-disabled"}`} onClick={canCreate ? create : undefined}>
          {creating ? "Creating…" : "Create Project"}
        </span>
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const { can, isAdmin } = useRole();
  const canManage = can("manage_projects");
  const [importBusy, setImportBusy] = useState(false);
  const [importPendingError, setImportPendingError] = useState("");
  const deleteRequests = useDeleteRequests(null);
  const navigate = useNavigate();
  const [projects, setProjects] = useProjects();
  const [activeId, setActiveId] = useActiveProjectId();
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [editingDeliveryId, setEditingDeliveryId] = useState(null);
  const [importPending, setImportPending] = useState(null); // { fileName, data } | null
  const [importError, setImportError] = useState("");
  const [backupFolder, setBackupFolder] = useState(null);
  const [backupFolderError, setBackupFolderError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [backupFileList, setBackupFileList] = useState(null); // string[] | null
  const fileInputRef = useRef(null);
  const [linkedFolders, setLinkedFolders] = useState({}); // projectId -> folder name
  const [relinkingId, setRelinkingId] = useState(null);
  const [folderStatus, setFolderStatus] = useState(null); // { id, text, error } | null

  useEffect(() => {
    if (!isFsAccessSupported()) return;
    let cancelled = false;
    Promise.all(projects.map((p) => loadRootHandle(p.id).then((h) => [p.id, h?.name], () => [p.id, undefined]))).then(
      (entries) => {
        if (!cancelled) setLinkedFolders(Object.fromEntries(entries.filter(([, name]) => name)));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const chooseProjectFolder = async (project) => {
    setRelinkingId(null);
    setFolderStatus(null);
    let destination;
    try {
      destination = await pickDestinationFolder();
    } catch (err) {
      if (err?.name !== "AbortError") {
        setFolderStatus({ id: project.id, text: "Couldn't get folder access — try again.", error: true });
      }
      return;
    }
    try {
      const root = await createOrLinkProjectRootFolder(project.id, destination, project.showCode);
      setLinkedFolders((prev) => ({ ...prev, [project.id]: root.name }));
      const where = root === destination ? destination.name : `${destination.name}/${root.name}`;
      setFolderStatus({ id: project.id, text: `Project folder ready: ${where}` });
    } catch (err) {
      console.error("Couldn't create the project folder:", err);
      setFolderStatus({ id: project.id, text: "Couldn't create the project folder there.", error: true });
    }
  };

  const onFolderButton = (project) => {
    if (linkedFolders[project.id]) setRelinkingId(project.id);
    else chooseProjectFolder(project);
  };

  // If the app just migrated from the old single-project model, the
  // folder handle it had is still sitting under the legacy IndexedDB key —
  // move it over to the migrated project's id the first time Home loads.
  useEffect(() => {
    if (projects.length !== 1) return;
    const project = projects[0];
    loadRootHandle(project.id).then((existing) => {
      if (!existing) migrateLegacyRootHandle(project.id).catch(() => {});
    });
  }, [projects]);

  useEffect(() => {
    loadBackupFolderHandle()
      .then(setBackupFolder)
      .catch(() => {});
  }, []);

  const openProject = (id) => {
    setActiveId(id);
    // useLocalStorageState only persists via a useEffect, which runs after
    // commit — write synchronously too so Dashboard's fresh mount (right
    // after navigate) can't read a stale active-project-id if the effect
    // hasn't flushed yet.
    localStorage.setItem("vfx-supe-active-project-id", JSON.stringify(id));
    navigate(`/dashboard?project=${id}`);
  };

  // Same as openProject, but straight to Post Reports — where scene, shot
  // and assignment delete requests are approved.
  const openPostReports = (id) => {
    setActiveId(id);
    localStorage.setItem("vfx-supe-active-project-id", JSON.stringify(id));
    navigate("/post-reports");
  };

  // Admins delete straight away; anyone else files a request.
  const confirmRemoveProject = async (project) => {
    if (deleteRequests.isAdmin) {
      removeProject(project.id);
      return;
    }
    const ok = await deleteRequests.request({
      kind: "project",
      targetId: project.id,
      projectId: project.id,
      label: `${project.name} (${project.showCode})`,
    });
    if (ok) setRemovingId(null);
  };

  const approveProjectDelete = async (req) => {
    if (projects.some((p) => p.id === req.target_id)) removeProject(req.target_id);
    return deleteRequests.decide(req.id, "approved");
  };

  // Scene/shot/assignment requests are approved in each project's Post
  // Reports; Home just points the Admin at them.
  const otherRequestCounts = deleteRequests.isAdmin
    ? projects
        .map((p) => ({
          project: p,
          count: deleteRequests.requests.filter((r) => r.project_id === p.id && r.kind !== "project").length,
        }))
        .filter((row) => row.count > 0)
    : [];

  const createProject = (project) => {
    const next = [...projects, project];
    setProjects(next);
    setCreating(false);
    openProject(project.id);
  };

  const setDeliveryDate = (id, deliveryDate) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, deliveryDate: deliveryDate || undefined } : p)));
  };

  const removeProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId("");

    deleteProjectData(id);
    deleteRootHandle(id).catch(() => {});
    setRemovingId(null);
  };

  const pickBackupFolderHandler = async () => {
    try {
      const handle = await pickBackupFolder();
      setBackupFolder(handle);
      setBackupFolderError("");
      setExportStatus("");
    } catch (err) {
      if (err?.name !== "AbortError") setBackupFolderError("Couldn't set that folder — try again.");
    }
  };

  const handleExport = async () => {
    setExportStatus("");
    if (backupFolder) {
      const ok = await ensurePermission(backupFolder);
      if (ok) {
        try {
          const { name } = await exportToFolder(backupFolder);
          setExportStatus(`Saved ${name} to ${backupFolder.name}/`);
          return;
        } catch (err) {
          console.error("Couldn't write export to the backup folder:", err);
          setExportStatus("Couldn't write to the backup folder — downloaded instead.");
        }
      } else {
        setExportStatus("Backup folder access was denied — downloaded instead.");
      }
    }
    downloadExport();
  };

  const openBackupFileList = async () => {
    setImportError("");
    if (!backupFolder) return;
    const ok = await ensurePermission(backupFolder);
    if (!ok) {
      setImportError("Couldn't access the backup folder — try setting it again.");
      return;
    }
    try {
      const names = await listJsonFiles(backupFolder);
      if (names.length === 0) {
        setImportError(`No .json backups found in ${backupFolder.name}/ yet.`);
        return;
      }
      setBackupFileList(names);
    } catch (err) {
      console.error("Couldn't list files in the backup folder:", err);
      setImportError("Couldn't read the backup folder — try setting it again.");
    }
  };

  const pickBackupFile = async (name) => {
    setBackupFileList(null);
    try {
      const data = await readJsonFile(backupFolder, name);
      if (!isValidExport(data)) {
        setImportError(`"${name}" doesn't look like a VFX Supe backup file.`);
        return;
      }
      setImportPending({ fileName: name, data });
    } catch (err) {
      console.error(`Couldn't read "${name}" from the backup folder:`, err);
      setImportError(`Couldn't read "${name}".`);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file if the user cancels then retries
    if (!file) return;
    setImportError("");
    try {
      const data = JSON.parse(await file.text());
      if (!isValidExport(data)) {
        setImportError("That doesn't look like a VFX Supe backup file.");
        return;
      }
      setImportPending({ fileName: file.name, data });
    } catch {
      setImportError("Couldn't read that file — make sure it's a backup exported from this app.");
    }
  };

  const confirmImport = async () => {
    if (!importPending || importBusy) return;
    setImportBusy(true);
    setImportPendingError("");
    try {
      await importAllData(importPending.data);
      setImportPending(null);
    } catch (err) {
      console.error("Import failed:", err);
      setImportPendingError(`Couldn't import: ${err.message}`);
    } finally {
      setImportBusy(false);
    }
  };

  // Before Step 2 every browser kept its own copy. Offer an Admin the one-time
  // move of this browser's copy up to the (still empty) cloud.
  const browserData = useMemo(() => exportBrowserData(), []);
  const offerBrowserUpload = isAdmin && projects.length === 0 && browserData.projects.length > 0;

  return (
    <div className="home">
      <aside className="home-sidebar">
        <div className="home-brand">
          <img className="home-brand-mark" src={logo} alt="Superior-FX" />
          <span className="home-brand-name">Superior-FX</span>
        </div>

        <div className="home-projects-header">
          <span className="label">Your projects</span>
          {canManage && (
            <span className="home-add-btn" onClick={() => setCreating(true)} title="New project">
              +
            </span>
          )}
        </div>

        <div className="home-projects-list">
          {projects.length === 0 && <span className="label home-projects-empty">No projects yet</span>}
          {projects.map((p) =>
            removingId === p.id ? (
              <ProjectDeleteConfirm
                key={p.id}
                project={p}
                requestOnly={!deleteRequests.isAdmin}
                onConfirm={() => confirmRemoveProject(p)}
                onCancel={() => setRemovingId(null)}
              />
            ) : relinkingId === p.id ? (
              <ProjectFolderRelink
                key={p.id}
                project={p}
                linkedName={linkedFolders[p.id]}
                onChoose={() => chooseProjectFolder(p)}
                onCancel={() => setRelinkingId(null)}
              />
            ) : (
              <div className="card home-project-card" key={p.id} onClick={() => openProject(p.id)}>
                <div className="home-project-card-main">
                  <span className="home-project-name">{p.name}</span>
                  <span className="home-project-code mono">{p.showCode}</span>
                  {!canManage ? (
                    p.deliveryDate && <span className="home-project-delivery">Delivery {p.deliveryDate}</span>
                  ) : editingDeliveryId === p.id ? (
                    <input
                      type="date"
                      className="report-edit-input home-project-delivery-input"
                      defaultValue={p.deliveryDate ?? ""}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDeliveryDate(p.id, e.target.value)}
                      onBlur={() => setEditingDeliveryId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") setEditingDeliveryId(null);
                      }}
                    />
                  ) : (
                    <span
                      className="home-project-delivery"
                      title="Set delivery date"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDeliveryId(p.id);
                      }}
                    >
                      {p.deliveryDate ? `Delivery ${p.deliveryDate}` : "+ Delivery date"}
                    </span>
                  )}
                  {folderStatus?.id === p.id && (
                    <span className={folderStatus.error ? "home-new-project-error" : "home-project-folder-status"}>
                      {folderStatus.text}
                    </span>
                  )}
                </div>
                {isFsAccessSupported() && (
                  <span
                    className={`home-project-folder${linkedFolders[p.id] ? " home-project-folder-linked" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFolderButton(p);
                    }}
                    title={
                      linkedFolders[p.id]
                        ? `Project folder: ${linkedFolders[p.id]} — click to create it somewhere else`
                        : "Create project folder…"
                    }
                  >
                    <FolderIcon />
                  </span>
                )}
                {deleteRequests.pendingFor("project", p.id) ? (
                  <span className="pill pill-danger home-project-delete-pill" title="Waiting for an Admin">
                    Delete requested
                  </span>
                ) : canManage && (
                <span
                  className="home-project-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemovingId(p.id);
                  }}
                  title="Delete project"
                >
                  <TrashIcon />
                </span>
                )}
              </div>
            )
          )}
        </div>

        <DeleteRequestsBanner
          deleteRequests={deleteRequests}
          kinds={["project"]}
          onApprove={approveProjectDelete}
          compact
        />
        {otherRequestCounts.map(({ project, count }) => (
          <span className="home-request-link" key={project.id} onClick={() => openPostReports(project.id)}>
            {count} delete request{count === 1 ? "" : "s"} in {project.showCode} →
          </span>
        ))}

        {canManage && (
        <div className="home-backup-actions">
          {isFsAccessSupported() && (
            <span className="label home-backup-folder-label" title={backupFolder ? backupFolder.name : undefined}>
              Backup folder: {backupFolder ? backupFolder.name : "not set"}
            </span>
          )}
          {isFsAccessSupported() && (
            <span className="btn btn-secondary home-backup-btn" onClick={pickBackupFolderHandler}>
              {backupFolder ? "Change Backup Folder…" : "Set Backup Folder…"}
            </span>
          )}
          {backupFolderError && <span className="home-new-project-error">{backupFolderError}</span>}

          <span className="btn btn-secondary home-backup-btn" onClick={handleExport}>
            Export All Data
          </span>
          {exportStatus && <span className="label home-backup-status">{exportStatus}</span>}

          {/* Restoring replaces the whole team's data — Admins only. */}
          {isAdmin && backupFolder && (
            <span className="btn btn-secondary home-backup-btn" onClick={openBackupFileList}>
              Import from Backup Folder…
            </span>
          )}
          {isAdmin && (
            <span className="btn btn-secondary home-backup-btn" onClick={() => fileInputRef.current?.click()}>
              Import from File…
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="home-backup-file-input"
            onChange={handleFileSelected}
          />
          {importError && <span className="home-new-project-error">{importError}</span>}
        </div>
        )}

        <div className="home-user">
          <UserBadge />
        </div>
      </aside>

      <main className="home-main">
        {importPending ? (
          <ImportConfirm
            fileName={importPending.fileName}
            data={importPending.data}
            fromBrowser={importPending.fromBrowser}
            busy={importBusy}
            error={importPendingError}
            onConfirm={confirmImport}
            onCancel={() => setImportPending(null)}
          />
        ) : backupFileList ? (
          <BackupFileList
            folderName={backupFolder?.name}
            files={backupFileList}
            onPick={pickBackupFile}
            onCancel={() => setBackupFileList(null)}
          />
        ) : creating && canManage ? (
          <NewProjectForm onCreate={createProject} onCancel={() => setCreating(false)} />
        ) : (
          <div className="home-placeholder">
            {offerBrowserUpload && (
              <div className="card home-cloud-upload">
                <span className="label">Move to the cloud</span>
                <span className="home-project-confirm-label">
                  The shared database is empty, but this browser still has {browserData.projects.length} project
                  {browserData.projects.length === 1 ? "" : "s"} saved from before (
                  {browserData.projects.map((p) => p.showCode || p.name).join(", ")}). Upload them so the whole team
                  works from them.
                </span>
                <span className="btn btn-secondary" onClick={() => downloadExport(browserData)}>
                  1. Download a backup of it
                </span>
                <span
                  className="btn btn-primary"
                  onClick={() =>
                    setImportPending({ fileName: "this browser", data: browserData, fromBrowser: true })
                  }
                >
                  2. Upload this browser's data…
                </span>
              </div>
            )}
            <span className="home-placeholder-title">Select a project</span>
            {canManage && <span className="home-placeholder-hint">Or click + in the sidebar to start a new one.</span>}
          </div>
        )}
      </main>
    </div>
  );
}
