import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { boardColumnForStatus } from "../data/taskStatus.js";
import { buildTaskUploadPath } from "../lib/folderPath.js";
import { computeImportance } from "../lib/importance.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByDueComplexityName } from "../lib/sortShots.js";
import { getAssignees } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./ShotBoard.css";

const COLUMNS = [
  { id: "bidding", label: "Bidding" },
  { id: "progress", label: "In progress" },
  { id: "review", label: "Sup review" },
  { id: "final", label: "Final" },
];

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function assigneeSummary(task) {
  const names = getAssignees(task);
  if (names.length === 0) return "Unassigned";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

// Groups a column's task-cards by shot, preserving shot order (already
// priority-sorted upstream) — a shot with two tasks both landing in the
// same column collapses to one box instead of two near-duplicate ones.
function groupByShot(cards) {
  const order = [];
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.shot.id)) {
      groups.set(card.shot.id, { shot: card.shot, tasks: [] });
      order.push(card.shot.id);
    }
    groups.get(card.shot.id).tasks.push(card.task);
  }
  return order.map((id) => groups.get(id));
}

export default function ShotBoard() {
  const navigate = useNavigate();
  const project = useActiveProject();
  const [shots] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [expandedGroups, setExpandedGroups] = useState([]); // "<colId>:<shotId>" keys

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // The board's real unit is a task, not a shot — each task moves through
  // the columns on its own, live off task.status, so a shot with several
  // tasks in different stages shows up in several columns at once rather
  // than being stuck at one column for all of them. Shots are pre-sorted
  // so higher-priority shots cluster first within a column.
  const taskCards = sortByDueComplexityName(shots).flatMap((shot) => shot.tasks.map((task) => ({ shot, task })));

  return (
    <div className="board">
      <div className="board-header">
        <span className="board-title">SHOT BOARD — {taskCards.length} TASKS</span>
        <div className="board-filters">
          <span className="pill">Filter</span>
          <span className="pill">Vendor</span>
          <span className="pill">By seq</span>
        </div>
      </div>

      <div className="board-columns">
        {COLUMNS.map((col) => {
          const colCards = taskCards.filter(({ task }) => boardColumnForStatus(task.status) === col.id);
          const groups = groupByShot(colCards);
          return (
            <div className="board-column" key={col.id}>
              <span className="label board-column-label">
                {col.label} ({colCards.length})
              </span>
              <div className="board-cards">
                {groups.length === 0 && <span className="board-column-empty">No tasks</span>}
                {groups.map(({ shot, tasks }) => {
                  const groupKey = `${col.id}:${shot.id}`;
                  const isExpanded = expandedGroups.includes(groupKey);
                  const importance = computeImportance(shot);
                  const anyNeedsRevision = tasks.some((t) => t.status === "needs_revision");
                  return (
                    <div
                      key={groupKey}
                      className={`card board-card${importance.colorKey ? ` importance-${importance.colorKey}` : ""}${anyNeedsRevision ? " needs-revision" : ""}`}
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <div className="board-card-top">
                        {shot.thumbnail ? (
                          <img className="board-card-thumb" src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} />
                        ) : (
                          <div className="board-card-thumb-placeholder">
                            <ImageIcon />
                          </div>
                        )}
                        <div className="board-card-top-text">
                          <span className="board-card-code">{shot.shotCode}</span>
                          <span className="board-card-task-count">
                            {tasks.length} task{tasks.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <span className="board-card-expand">{isExpanded ? "▼" : "▶"}</span>
                      </div>

                      {isExpanded && (
                        <div className="board-card-tasks" onClick={(e) => e.stopPropagation()}>
                          {tasks.map((task) => {
                            const needsRevision = task.status === "needs_revision";
                            const uploadPath = buildTaskUploadPath({
                              show: project?.showCode,
                              scene: shot.scene,
                              shotCode: shot.shotCode,
                              taskType: task.type,
                            });
                            return (
                              <div className="board-card-task-row" key={task.id}>
                                <span className="board-card-task">
                                  {task.type}
                                  {needsRevision && (
                                    <span className="pill pill-danger board-card-revision-pill">Revise</span>
                                  )}
                                </span>
                                <span className="board-card-meta">{assigneeSummary(task)}</span>
                                {uploadPath && <span className="board-card-folder-path mono">{uploadPath}</span>}
                                {task.status === "pending" && (
                                  <span
                                    className="board-card-review-link"
                                    onClick={() => navigate(`/review?task=${task.id}`)}
                                  >
                                    Review →
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          <span className="board-card-view-shot" onClick={() => navigate(`/shot/${shot.shotCode}`)}>
                            View shot →
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
