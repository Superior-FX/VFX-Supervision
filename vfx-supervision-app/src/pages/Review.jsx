import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { assigneesLabel } from "../lib/taskAssignees.js";
import { padScene } from "../lib/folderPath.js";
import { getTaskReviewFolder, loadRootHandle, readFileFrom } from "../lib/fsAccess.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByDueComplexityName } from "../lib/sortShots.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Review.css";

export default function Review() {
  const project = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [postReports, setPostReports] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [rootHandle, setRootHandle] = useState(null);
  const [supNote, setSupNote] = useState("");
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoError, setVideoError] = useState("");

  useEffect(() => {
    if (!project) return;
    loadRootHandle(project.id)
      .then(setRootHandle)
      .catch(() => {});
  }, [project]);

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

  const requestedTaskId = searchParams.get("task");
  const current = queue.find((c) => c.task.id === requestedTaskId) ?? queue[0] ?? null;

  // The note field always mirrors whatever's already saved on the task
  // being looked at — switching shots shouldn't drag a half-typed note
  // from the last one along with it.
  useEffect(() => {
    setSupNote(current?.task.supNote ?? "");
  }, [current?.task.id]);

  useEffect(() => {
    setVideoUrl(null);
    setVideoError("");
    if (!current || !rootHandle || !current.task.reviewFile) return;
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const reviewDir = await getTaskReviewFolder(rootHandle, {
          scene: padScene(current.shot.scene),
          shotCode: current.shot.shotCode,
          taskType: current.task.type,
        });
        if (!reviewDir) throw new Error("No review folder for this task type.");
        const file = await readFileFrom(reviewDir, current.task.reviewFile);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setVideoUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("Couldn't load review proxy:", err);
          setVideoError("Couldn't load the review proxy — it may have been moved or deleted on disk.");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current?.task.id, current?.task.reviewFile, rootHandle]);

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

  const saveNote = () => updateCurrentTask({ supNote: supNote.trim() || undefined });

  // Acting on a task drops it out of the pending queue — clear the
  // selection so the picker falls back to whatever's next instead of
  // pointing at a task id that's no longer in the list.
  const act = (status) => {
    updateCurrentTask({ status });
    setSearchParams({});
  };

  return (
    <div className="review">
      <div className="review-header">
        <span className="review-title">REVIEW &amp; DAILIES</span>
        <span className="pill">{queue.length} pending</span>
      </div>

      {queue.length === 0 && (
        <div className="card review-empty">Nothing waiting on supervisor review right now.</div>
      )}

      {current && (
        <>
          <select
            className="review-select mono"
            value={current.task.id}
            onChange={(e) => chooseTask(e.target.value)}
          >
            {queue.map(({ shot, task }) => (
              <option value={task.id} key={task.id}>
                {shot.shotCode} — {task.type}
              </option>
            ))}
          </select>

          <div className="review-meta">
            <span className="pill pill-accent">{current.shot.shotCode}</span>
            <span className="pill">{current.task.type}</span>
            <span className="review-meta-assignee">{assigneesLabel(current.task)}</span>
          </div>

          {videoUrl ? (
            <video className="review-video" src={videoUrl} controls />
          ) : (
            <div className="card review-frame">
              <span>{videoError || (current.task.reviewFile ? "Loading proxy…" : "No review proxy for this submission.")}</span>
            </div>
          )}

          {current.task.versionNote && (
            <div className="card review-version-note">
              <span className="label">Artist's version note</span>
              <br />
              {current.task.versionNote}
            </div>
          )}

          <span className="label">Sup notes</span>
          <div className="review-note">
            <textarea
              placeholder="Notes for the artist…"
              value={supNote}
              onChange={(e) => setSupNote(e.target.value)}
            />
          </div>

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
        </>
      )}
    </div>
  );
}
