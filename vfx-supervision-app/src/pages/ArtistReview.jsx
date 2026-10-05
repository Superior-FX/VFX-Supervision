import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AnnotatedPlayer from "../components/AnnotatedPlayer.jsx";
import FolderStatusBanner from "../components/FolderStatusBanner.jsx";
import ViewSelect from "../components/ViewSelect.jsx";
import { taskStatusInfo } from "../data/taskStatus.js";
import { resolveCurrentArtist } from "../lib/currentArtist.js";
import { formatVersion } from "../lib/fsAccess.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByDueComplexityName } from "../lib/sortShots.js";
import { hasAssignee } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import { useProjectFolder } from "../lib/useProjectFolder.js";
import { usePlateProxy, useReviewProxy, versionChoices } from "../lib/useReviewProxy.js";
import { versionNotes } from "../lib/versionNotes.js";
import "./Review.css";
import "./ArtistReview.css";

// Shot Viewer — the artist's side of Review & Dailies: the same player,
// read-only, showing what the supervisor left on a submission (supe notes +
// per-frame annotations and their notes).
//
// It remembers the last shot viewed and the frame it was left on, so
// clicking away to another page and back via the sidebar returns the artist
// to exactly where they were. VIEW in Artist Report opens a specific task.
export default function ArtistReview() {
  const project = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [postReports] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [lastTaskId, setLastTaskId] = useLocalStorageState(scopedKey("vfx-supe-viewer-last-task", project?.id), null);
  // { [taskId]: frame } — where each submission was last left.
  const [lastFrames, setLastFrames] = useLocalStorageState(scopedKey("vfx-supe-viewer-frames", project?.id), {});
  const folder = useProjectFolder(project);
  const currentArtist = resolveCurrentArtist(artists);

  // The artist's submissions that have something to watch, in this order:
  //   1. Needs Revision first — that's what they need to act on.
  //   2. Within each group (several revisions, or everything else), soonest
  //      due date first; then complexity, then shot code, as everywhere else.
  const submissions = useMemo(() => {
    if (!currentArtist) return [];
    const byDue = sortByDueComplexityName(postReports);
    const dueRank = new Map(byDue.map((shot, i) => [shot.id, i]));
    const list = byDue.flatMap((shot) =>
      shot.tasks.filter((t) => t.reviewFile && hasAssignee(t, currentArtist.name)).map((task) => ({ shot, task }))
    );
    const revisionRank = (e) => (e.task.status === "needs_revision" ? 0 : 1);
    return list.sort(
      (a, b) => revisionRank(a) - revisionRank(b) || dueRank.get(a.shot.id) - dueRank.get(b.shot.id)
    );
  }, [postReports, currentArtist?.name]);

  const findTask = (id) => {
    if (!id) return null;
    for (const shot of postReports) {
      const task = shot.tasks.find((t) => t.id === id);
      if (task) return { shot, task };
    }
    return null;
  };

  // A VIEW link wins, then the last shot looked at, then the top of the list.
  const entry = findTask(searchParams.get("task")) ?? findTask(lastTaskId) ?? submissions[0] ?? null;
  const options = entry && !submissions.some((e) => e.task.id === entry.task.id) ? [entry, ...submissions] : submissions;

  useEffect(() => {
    if (entry && entry.task.id !== lastTaskId) setLastTaskId(entry.task.id);
  }, [entry?.task.id]);

  // null = the latest submission (default), an older version number, or "plate".
  const [view, setView] = useState(null);
  useEffect(() => setView(null), [entry?.task.id]);
  const viewingPlate = view === "plate";
  const viewingOld = typeof view === "number";

  const { videoUrl, hqUrl, versions, videoError } = useReviewProxy(folder, entry, {
    version: viewingOld ? view : null,
  });
  const { plateUrl, plateError } = usePlateProxy(folder, entry?.shot, viewingPlate);

  if (!currentArtist) {
    return (
      <div className="review">
        <div className="review-header">
          <span className="review-title">SHOT VIEWER</span>
        </div>
        <div className="card review-empty">
          No artist profile found for you yet — ask an Admin to add you in Post Reports → Artists.
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="review">
        <div className="review-header">
          <span className="review-title">SHOT VIEWER</span>
        </div>
        <div className="card review-empty">
          Nothing to view yet — once you submit a shot in Upload Shot, its review proxy and any supe notes show up here.
        </div>
      </div>
    );
  }

  const { shot, task } = entry;
  const status = taskStatusInfo(task.status);
  const shownVersion = viewingOld ? view : task.version ?? null;
  // Only the marks drawn on the version that's actually being shown.
  const annotations = viewingPlate ? [] : (task.annotations ?? []).filter((a) => a.version === shownVersion);
  const notesFor = versionNotes(task, shownVersion);

  const supeNotes = viewingPlate ? null : (
    <div className="artist-review-supe">
      <span className="label">Supe notes{viewingOld ? ` — ${formatVersion(shownVersion)}` : ""}</span>
      <div className={`artist-review-supe-text${notesFor.supNote ? "" : " is-empty"}`}>
        {notesFor.supNote ||
          (viewingOld ? "No supe notes were saved on this version." : "No supe notes on this submission yet.")}
      </div>
    </div>
  );
  const playerSrc = viewingPlate ? plateUrl : videoUrl;

  return (
    <div className="review">
      <div className="review-header">
        <span className="review-title">SHOT VIEWER</span>
        <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
      </div>

      <FolderStatusBanner
        folder={folder}
        show={Boolean(task.reviewFile)}
        showCode={project?.showCode}
        impact="the review proxy can't be played"
      />

      <div className="review-pickers">
        <select
          className="review-select mono"
          value={task.id}
          onChange={(e) => setSearchParams({ task: e.target.value })}
        >
          {options.map(({ shot: s, task: t }) => (
            <option value={t.id} key={t.id}>
              {s.shotCode} — {t.type}
              {t.version ? ` ${formatVersion(t.version)}` : ""} — {taskStatusInfo(t.status).label}
              {s.dueDate ? ` — due ${s.dueDate}` : ""}
            </option>
          ))}
        </select>
        <ViewSelect
          task={task}
          choices={versionChoices(task, versions)}
          hasPlate={Boolean(shot.plate?.proxy)}
          value={view}
          onChange={setView}
        />
      </div>

      <div className="review-meta">
        <span className="pill pill-accent">{shot.shotCode}</span>
        <span className="pill">{viewingPlate ? "Plate" : task.type}</span>
        {!viewingPlate && shownVersion && <span className="pill mono">{formatVersion(shownVersion)}</span>}
        {view !== null && <span className="pill pill-warning">Not the latest</span>}
        {shot.dueDate && <span className="review-meta-assignee">Due {shot.dueDate}</span>}
      </div>

      {playerSrc ? (
        // No onChange: read-only — the artist sees the marks but can't edit.
        <AnnotatedPlayer
          key={`${task.id}:${view ?? "latest"}`}
          src={playerSrc}
          // Artists get the 4K HQ when there is one, never the 6K/8K stills.
          hqSrc={viewingPlate ? null : hqUrl}
          annotations={annotations}
          notes={supeNotes}
          // The remembered frame belongs to the latest submission only.
          startFrame={view === null ? lastFrames[task.id] ?? 0 : 0}
          onFrameSettle={(frame) => {
            if (view === null && lastFrames[task.id] !== frame) {
              setLastFrames((prev) => ({ ...prev, [task.id]: frame }));
            }
          }}
        />
      ) : (
        <>
          <div className="card review-frame">
            <span>{viewingPlate ? plateError || "Loading plate…" : videoError || "Loading proxy…"}</span>
          </div>
          {supeNotes}
        </>
      )}
    </div>
  );
}
