import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AnnotatedPlayer from "../components/AnnotatedPlayer.jsx";
import FolderStatusBanner from "../components/FolderStatusBanner.jsx";
import { assigneesLabel, getAssignees, hasAssignee } from "../lib/taskAssignees.js";
import { padScene } from "../lib/folderPath.js";
import { formatVersion } from "../lib/fsAccess.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByDueComplexityName } from "../lib/sortShots.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import { useProjectFolder } from "../lib/useProjectFolder.js";
import { useReviewProxy } from "../lib/useReviewProxy.js";
import "./Review.css";

// How the queue is ordered/narrowed. "due" and "submitted" show every
// pending submission; the other three narrow it to one artist/task/scene
// (still soonest-due first inside that).
const SORT_MODES = [
  { id: "due", label: "Due date" },
  { id: "artist", label: "Artist" },
  { id: "task", label: "Task" },
  { id: "scene", label: "Scene" },
  { id: "submitted", label: "Date submitted" },
];

const sceneLabel = (shot) => `SC${padScene(shot.scene)}`;

// When the version under review was handed in, from its versionHistory entry.
function submittedAt(task) {
  return (task.versionHistory ?? []).find((v) => v.version === task.version)?.submittedAt ?? null;
}

function formatSubmitted(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Review() {
  const project = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [postReports, setPostReports] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const folder = useProjectFolder(project);
  const [supNote, setSupNote] = useState("");
  const [artistNoteOpen, setArtistNoteOpen] = useState(false);
  const [sortMode, setSortMode] = useLocalStorageState(scopedKey("vfx-supe-review-sort", project?.id), "due");
  const [sortValue, setSortValue] = useLocalStorageState(scopedKey("vfx-supe-review-sort-value", project?.id), "");

  // Every task still awaiting a supervisor call, one row per task (same
  // shape as Shot Board's cards) — this page's real unit is a task, not a
  // shot, same reasoning as there.
  const queue = useMemo(
    () =>
      sortByDueComplexityName(postReports).flatMap((shot) =>
        shot.tasks.filter((t) => t.status === "pending").map((task) => ({ shot, task }))
      ),
    [postReports]
  );

  // The choices for the second dropdown, from what's actually pending.
  const filterOptions = useMemo(() => {
    const values = new Set();
    for (const { shot, task } of queue) {
      if (sortMode === "artist") getAssignees(task).forEach((a) => values.add(a));
      else if (sortMode === "task") values.add(task.type);
      else if (sortMode === "scene") values.add(sceneLabel(shot));
    }
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [queue, sortMode]);

  // A remembered pick that has nothing pending anymore falls back to the first.
  const activeValue = filterOptions.includes(sortValue) ? sortValue : filterOptions[0] ?? "";

  const visible = useMemo(() => {
    if (sortMode === "submitted") {
      // Newest submission first; anything without a recorded date goes last.
      return [...queue].sort((a, b) => (submittedAt(b.task) ?? "").localeCompare(submittedAt(a.task) ?? ""));
    }
    if (sortMode === "artist") return queue.filter(({ task }) => hasAssignee(task, activeValue));
    if (sortMode === "task") return queue.filter(({ task }) => task.type === activeValue);
    if (sortMode === "scene") return queue.filter(({ shot }) => sceneLabel(shot) === activeValue);
    return queue;
  }, [queue, sortMode, activeValue]);

  const requestedTaskId = searchParams.get("task");
  // A deep link (Post Reports / Shot Board "Review →") always opens its
  // task, even if the current filter would otherwise hide it.
  const current =
    visible.find((c) => c.task.id === requestedTaskId) ??
    queue.find((c) => c.task.id === requestedTaskId) ??
    visible[0] ??
    null;
  const options = current && !visible.includes(current) ? [current, ...visible] : visible;

  const changeSortMode = (mode) => {
    setSortMode(mode);
    setSortValue("");
    setSearchParams({});
  };

  const changeSortValue = (value) => {
    setSortValue(value);
    setSearchParams({});
  };

  // The note field always mirrors whatever's already saved on the task
  // being looked at — switching shots shouldn't drag a half-typed note
  // from the last one along with it.
  useEffect(() => {
    setSupNote(current?.task.supNote ?? "");
    setArtistNoteOpen(false);
  }, [current?.task.id]);

  const { videoUrl, videoError } = useReviewProxy(folder, current);

  const chooseTask = (taskId) => {
    setSearchParams(taskId ? { task: taskId } : {});
  };

  const updateCurrentTask = (patch) => {
    if (!current) return;
    setPostReports((prev) =>
      prev.map((s) =>
        s.id === current.shot.id
          ? { ...s, tasks: s.tasks.map((t) => (t.id === current.task.id ? { ...t, ...patch } : t)) }
          : s
      )
    );
  };

  // Annotations live on the task, each tagged with the proxy version it was
  // drawn on, so a new submission starts clean while older marks are kept.
  const currentVersion = current?.task.version ?? null;
  const versionAnnotations = (current?.task.annotations ?? []).filter((a) => a.version === currentVersion);
  const saveAnnotations = (list) => {
    const others = (current.task.annotations ?? []).filter((a) => a.version !== currentVersion);
    updateCurrentTask({ annotations: [...others, ...list.map((a) => ({ ...a, version: currentVersion }))] });
  };

  const saveNote = () => updateCurrentTask({ supNote: supNote.trim() || undefined });

  // Acting on a task drops it out of the pending queue — clear the
  // selection so the picker falls back to whatever's next instead of
  // pointing at a task id that's no longer in the list.
  const act = (status) => {
    updateCurrentTask({ status });
    setSearchParams({});
  };

  const supeNotesBox = (
    <div className="review-note">
      <span className="label">Supe notes</span>
      <textarea placeholder="Notes for the artist…" value={supNote} onChange={(e) => setSupNote(e.target.value)} />
    </div>
  );

  // Normal view: everything stacked. Full screen: a small Supe notes box
  // plus an "Artist note" toggle that pops the note up over the picture,
  // so the bottom row stays short and the video gets the room.
  const renderNotes = (fullscreen) =>
    !current ? null : fullscreen ? (
      <>
        {supeNotesBox}
        <div className="review-artist-toggle">
          <button
            className="aplayer-btn"
            disabled={!current.task.versionNote}
            onClick={() => setArtistNoteOpen((o) => !o)}
          >
            {current.task.versionNote ? `Artist note ${artistNoteOpen ? "▾" : "▴"}` : "No artist note"}
          </button>
          {artistNoteOpen && current.task.versionNote && (
            <div className="review-artist-popup">
              <span className="label">Artist's version note</span>
              <div>{current.task.versionNote}</div>
            </div>
          )}
        </div>
      </>
    ) : (
      <div className="review-notes">
        {current.task.versionNote && (
          <div className="card review-version-note">
            <span className="label">Artist's version note</span>
            <br />
            {current.task.versionNote}
          </div>
        )}
        {supeNotesBox}
      </div>
    );

  const actions = current && (
    <div className="review-actions">
      <div className="btn btn-secondary" onClick={saveNote}>
        Save note
      </div>
      <div className="btn btn-danger" onClick={() => act("needs_revision")}>
        Revise
      </div>
      <div className="btn btn-primary" onClick={() => act("final")}>
        Final
      </div>
    </div>
  );

  return (
    <div className="review">
      <div className="review-header">
        <span className="review-title">REVIEW &amp; DAILIES</span>
        <span className="pill">{queue.length} pending</span>
      </div>

      <FolderStatusBanner
        folder={folder}
        show={queue.some(({ task }) => task.reviewFile)}
        showCode={project?.showCode}
        impact="review proxies can't be played"
      />

      {queue.length === 0 && (
        <div className="card review-empty">Nothing waiting on supervisor review right now.</div>
      )}

      {queue.length > 0 && (
        <div className="review-sort">
          <span className="label">Sort by</span>
          <select className="review-select" value={sortMode} onChange={(e) => changeSortMode(e.target.value)}>
            {SORT_MODES.map((m) => (
              <option value={m.id} key={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {filterOptions.length > 0 && (
            <select className="review-select" value={activeValue} onChange={(e) => changeSortValue(e.target.value)}>
              {filterOptions.map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
          <span className="review-sort-count">
            {visible.length} of {queue.length}
          </span>
        </div>
      )}

      {current && (
        <>
          <select
            className="review-select mono"
            value={current.task.id}
            onChange={(e) => chooseTask(e.target.value)}
          >
            {options.map(({ shot, task }) => (
              <option value={task.id} key={task.id}>
                {shot.shotCode} — {task.type}
                {task.version ? ` ${formatVersion(task.version)}` : ""} — {assigneesLabel(task)}
                {sortMode === "submitted"
                  ? submittedAt(task)
                    ? ` — submitted ${formatSubmitted(submittedAt(task))}`
                    : ""
                  : shot.dueDate
                    ? ` — due ${shot.dueDate}`
                    : ""}
              </option>
            ))}
          </select>

          <div className="review-meta">
            <span className="pill pill-accent">{current.shot.shotCode}</span>
            <span className="pill">{current.task.type}</span>
            {current.task.version && <span className="pill mono">{formatVersion(current.task.version)}</span>}
            <span className="review-meta-assignee">{assigneesLabel(current.task)}</span>
          </div>

          {videoUrl ? (
            // The notes panel goes inside the player so it follows it into
            // full screen (as a side column) instead of being left behind.
            <AnnotatedPlayer
              src={videoUrl}
              annotations={versionAnnotations}
              onChange={saveAnnotations}
              notes={renderNotes}
              actions={actions}
            />
          ) : (
            <>
              <div className="card review-frame">
                <span>{videoError || (current.task.reviewFile ? "Loading proxy…" : "No review proxy for this submission.")}</span>
              </div>
              {renderNotes(false)}
              {actions}
            </>
          )}
        </>
      )}
    </div>
  );
}
