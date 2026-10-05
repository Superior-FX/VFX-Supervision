import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AnnotatedPlayer from "../components/AnnotatedPlayer.jsx";
import FolderStatusBanner from "../components/FolderStatusBanner.jsx";
import { aggregateTaskStatus, taskStatusInfo } from "../data/taskStatus.js";
import { buildFolderPath, padScene } from "../lib/folderPath.js";
import { formatVersion, getTaskReviewFolder, listProxyVersions } from "../lib/fsAccess.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { assigneesLabel } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import { useProjectFolder } from "../lib/useProjectFolder.js";
import { usePlateProxy, useReviewProxy } from "../lib/useReviewProxy.js";
import { versionNotes } from "../lib/versionNotes.js";
import "./Review.css";
import "./ShotDetail.css";

// Shot viewer — where the Dashboard, Shot Board and Shot Tracking send you
// for a shot. Look-only, for anyone: every submitted version of every task
// plus the plate, renders only (no annotations or notes — those live in
// Review & Dailies and the artist's Shot Viewer). Defaults to the most
// recent submission.

// Which versions each task has on disk: { [taskId]: number[] }, newest first.
function useAllTaskVersions(folder, shot) {
  const [byTask, setByTask] = useState({});
  const key = shot ? shot.tasks.map((t) => `${t.id}:${t.version ?? ""}:${t.reviewFile ?? ""}`).join("|") : "";

  useEffect(() => {
    setByTask({});
    if (!shot || folder.status !== "connected") return;
    let cancelled = false;
    (async () => {
      const result = {};
      for (const task of shot.tasks) {
        const found = new Set(task.reviewFile && task.version ? [task.version] : []);
        try {
          const dir = await getTaskReviewFolder(folder.rootHandle, {
            scene: padScene(shot.scene),
            shotCode: shot.shotCode,
            taskType: task.type,
          });
          if (dir) for (const v of await listProxyVersions(dir, shot.shotCode)) found.add(v.version);
        } catch {
          // No folder for this task yet — just whatever the record says.
        }
        if (found.size) result[task.id] = [...found].sort((a, b) => b - a);
      }
      if (!cancelled) setByTask(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [shot?.id, key, folder.rootHandle, folder.status]);

  return byTask;
}

export default function ShotDetail() {
  const { shotId } = useParams();
  const navigate = useNavigate();
  const project = useActiveProject();
  const [shots] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const folder = useProjectFolder(project);
  const [copied, setCopied] = useState(false);
  // "plate" or "<taskId>:<version>"; null until picked = the default.
  const [pick, setPick] = useState(null);

  const shot = shots.find((s) => s.shotCode === shotId) ?? null;
  const versionsByTask = useAllTaskVersions(folder, shot);
  const hasPlate = Boolean(shot?.plate?.proxy);

  // Dropdown choices, newest submission first within each task.
  const choices = useMemo(() => {
    if (!shot) return [];
    const list = [];
    for (const task of shot.tasks) {
      for (const v of versionsByTask[task.id] ?? []) {
        const { submittedAt } = versionNotes(task, v);
        list.push({
          value: `${task.id}:${v}`,
          task,
          version: v,
          submittedAt,
          label: `${task.type} ${formatVersion(v)}${v === task.version ? " — latest" : ""}${
            submittedAt ? ` — ${new Date(submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""
          }`,
        });
      }
    }
    return list;
  }, [shot, versionsByTask]);

  // Default: the most recently submitted version of any task, else the plate.
  const defaultPick = useMemo(() => {
    const latest = choices
      .filter((c) => c.version === c.task.version)
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))[0];
    return latest?.value ?? (hasPlate ? "plate" : null);
  }, [choices, hasPlate]);

  const selected = pick ?? defaultPick;
  const viewingPlate = selected === "plate";
  const choice = choices.find((c) => c.value === selected) ?? null;
  const entry = choice ? { shot, task: choice.task } : null;

  const { videoUrl, hqUrl, videoError } = useReviewProxy(folder, entry, { version: choice?.version ?? null });
  const { plateUrl, plateError } = usePlateProxy(folder, shot, viewingPlate);

  if (!shot) {
    return (
      <div className="review">
        <span className="detail-back" onClick={() => navigate(-1)}>
          ← Back
        </span>
        <div className="card review-empty">No shot called "{shotId}" in this project.</div>
      </div>
    );
  }

  const status = aggregateTaskStatus(shot.tasks);
  const folderPath = buildFolderPath({ show: project?.showCode, scene: shot.scene, shotCode: shot.shotCode });
  const playerSrc = viewingPlate ? plateUrl : videoUrl;
  const anythingToShow = choices.length > 0 || hasPlate;

  const copyPath = () => {
    if (!folderPath) return;
    navigator.clipboard.writeText(folderPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="review">
      <span className="detail-back" onClick={() => navigate(-1)}>
        ← Back
      </span>
      <div className="review-header">
        <span className="review-title">{shot.shotCode}</span>
        <div className="detail-header-pills">
          {shot.dueDate && <span className="pill mono">Due {shot.dueDate}</span>}
          <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>
            {shot.tasks.length ? status.label : "No tasks"}
          </span>
        </div>
      </div>

      {(shot.internalDescription || shot.scriptDescription) && (
        <div className="detail-descriptions">
          {shot.internalDescription && <span>{shot.internalDescription}</span>}
          {shot.scriptDescription && <span className="detail-script">Script: {shot.scriptDescription}</span>}
        </div>
      )}

      <FolderStatusBanner
        folder={folder}
        show={anythingToShow || shot.tasks.some((t) => t.reviewFile)}
        showCode={project?.showCode}
        impact="renders and the plate can't be played"
      />

      {anythingToShow ? (
        <>
          <select className="review-select mono" value={selected ?? ""} onChange={(e) => setPick(e.target.value)}>
            {choices.map((c) => (
              <option value={c.value} key={c.value}>
                {c.label} — {assigneesLabel(c.task)}
              </option>
            ))}
            {hasPlate && <option value="plate">Plate — {shot.plate.name}</option>}
          </select>

          {playerSrc ? (
            // Renders only: no annotations, no notes, nothing editable.
            <AnnotatedPlayer key={selected} src={playerSrc} hqSrc={viewingPlate ? null : hqUrl} />
          ) : (
            <div className="card review-frame">
              <span>
                {viewingPlate ? plateError || "Loading plate…" : videoError || (folder.status === "connected" ? "Loading…" : "Waiting for the project folder…")}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="card review-empty">
          Nothing to watch yet — no submissions, and no plate imported (Post Reports → Import plate).
        </div>
      )}

      <div className="card detail-tasks">
        <span className="label">Tasks</span>
        {shot.tasks.length === 0 && <span className="detail-muted">No tasks on this shot.</span>}
        {shot.tasks.map((t) => {
          const info = taskStatusInfo(t.status);
          return (
            <div className="detail-task-row" key={t.id}>
              <span className="detail-task-type">{t.type}</span>
              <span className={`pill${t.source === "inhouse" ? " pill-accent" : ""}`}>
                {t.source === "vendor" ? "Outsourced" : "In-house"}
              </span>
              <span className="detail-muted detail-task-who">{assigneesLabel(t)}</span>
              {t.version && <span className="pill mono">{formatVersion(t.version)}</span>}
              <span className={`pill${info.tone ? ` pill-${info.tone}` : ""}`}>{info.label}</span>
            </div>
          );
        })}
      </div>

      {folderPath && (
        <span className="detail-folder-path" onClick={copyPath} title="Click to copy">
          {folderPath}
          <span className="detail-folder-path-copy">{copied ? "Copied" : "Copy"}</span>
        </span>
      )}
    </div>
  );
}
