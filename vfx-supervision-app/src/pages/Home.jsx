import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { downloadExport, importAllData, isValidExport } from "../lib/backup.js";
import {
  createProjectRootFolder,
  deleteRootHandle,
  isFsAccessSupported,
  loadRootHandle,
  migrateLegacyRootHandle,
  pickDestinationFolder,
} from "../lib/fsAccess.js";
import { SCOPED_DATA_BASES, useActiveProjectId, useProjects } from "../lib/projects.js";
import { useEnterKey } from "../lib/useEnterKey.js";
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

function ProjectDeleteConfirm({ project, onConfirm, onCancel }) {
  const [text, setText] = useState("");
  const matches = text.trim().toUpperCase() === "DELETE";
  useEnterKey(() => {
    if (matches) onConfirm();
  });

  return (
    <div className="card home-project-confirm" onClick={(e) => e.stopPropagation()}>
      <span className="home-project-confirm-label">
        Type DELETE to permanently remove {project.name} ({project.showCode}) and all of its shots and reports
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
          Confirm delete
        </span>
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
    </div>
  );
}

function ImportConfirm({ fileName, data, onConfirm, onCancel }) {
  const [text, setText] = useState("");
  const matches = text.trim().toUpperCase() === "IMPORT";
  useEnterKey(() => {
    if (matches) onConfirm();
  });

  const projectCount = data.projects?.length ?? 0;
  const exportedAt = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : "unknown date";

  return (
    <div className="card home-new-project">
      <span className="label">Import backup</span>
      <span className="home-project-confirm-label">
        This replaces everything currently in the app — every project, shot, scene, and the artist roster — with the{" "}
        {projectCount} project{projectCount === 1 ? "" : "s"} from "{fileName}" (exported {exportedAt}). This can't
        be undone. Type IMPORT to continue.
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
          Replace with backup
        </span>
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
    onCreate({ id: draftId, name: name.trim(), showCode: trimmedShowCode });
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
  const navigate = useNavigate();
  const [projects, setProjects] = useProjects();
  const [activeId, setActiveId] = useActiveProjectId();
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [importPending, setImportPending] = useState(null); // { fileName, data } | null
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

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

  const openProject = (id) => {
    setActiveId(id);
    // useLocalStorageState only persists via a useEffect, which runs after
    // commit — write synchronously too so Dashboard's fresh mount (right
    // after navigate) can't read a stale active-project-id if the effect
    // hasn't flushed yet.
    localStorage.setItem("vfx-supe-active-project-id", JSON.stringify(id));
    navigate("/dashboard");
  };

  const createProject = (project) => {
    const next = [...projects, project];
    setProjects(next);
    localStorage.setItem("vfx-supe-projects", JSON.stringify(next));
    setCreating(false);
    openProject(project.id);
  };

  const removeProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId("");

    for (const base of SCOPED_DATA_BASES) {
      localStorage.removeItem(`${base}:${id}`);
    }
    deleteRootHandle(id).catch(() => {});
    setRemovingId(null);
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

  const confirmImport = () => {
    if (!importPending) return;
    importAllData(importPending.data);
    // Every page's own useLocalStorageState only reads localStorage once,
    // at mount — a full reload is the simplest way to guarantee everything
    // (Home included) picks up the freshly-imported data instead of some
    // components still holding whatever was in memory before the import.
    window.location.reload();
  };

  return (
    <div className="home">
      <aside className="home-sidebar">
        <div className="home-brand">
          <div className="home-brand-mark" />
          <span className="home-brand-name">VFX SUPE</span>
        </div>

        <div className="home-projects-header">
          <span className="label">Your projects</span>
          <span className="home-add-btn" onClick={() => setCreating(true)} title="New project">
            +
          </span>
        </div>

        <div className="home-projects-list">
          {projects.length === 0 && <span className="label home-projects-empty">No projects yet</span>}
          {projects.map((p) =>
            removingId === p.id ? (
              <ProjectDeleteConfirm
                key={p.id}
                project={p}
                onConfirm={() => removeProject(p.id)}
                onCancel={() => setRemovingId(null)}
              />
            ) : (
              <div className="card home-project-card" key={p.id} onClick={() => openProject(p.id)}>
                <div className="home-project-card-main">
                  <span className="home-project-name">{p.name}</span>
                  <span className="home-project-code mono">{p.showCode}</span>
                </div>
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
              </div>
            )
          )}
        </div>

        <div className="home-backup-actions">
          <span className="btn btn-secondary home-backup-btn" onClick={downloadExport}>
            Export All Data
          </span>
          <span className="btn btn-secondary home-backup-btn" onClick={() => fileInputRef.current?.click()}>
            Import Backup…
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="home-backup-file-input"
            onChange={handleFileSelected}
          />
          {importError && <span className="home-new-project-error">{importError}</span>}
        </div>
      </aside>

      <main className="home-main">
        {importPending ? (
          <ImportConfirm
            fileName={importPending.fileName}
            data={importPending.data}
            onConfirm={confirmImport}
            onCancel={() => setImportPending(null)}
          />
        ) : creating ? (
          <NewProjectForm onCreate={createProject} onCancel={() => setCreating(false)} />
        ) : (
          <div className="home-placeholder">
            <span className="home-placeholder-title">Select a project</span>
            <span className="home-placeholder-hint">Or click + in the sidebar to start a new one.</span>
          </div>
        )}
      </main>
    </div>
  );
}
