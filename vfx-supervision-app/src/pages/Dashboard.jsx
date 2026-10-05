import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { aggregateTaskStatus, statusSince, taskStatusInfo } from "../data/taskStatus.js";
import { padScene } from "../lib/folderPath.js";
import { formatVersion } from "../lib/fsAccess.js";
import { computeImportance } from "../lib/importance.js";
import {
  STATUS_COLORS,
  STATUS_ORDER,
  computeProjectStats,
  daysUntilDate,
  formatAge,
  isShotOverdue,
  loadProjectShots,
} from "../lib/projectStats.js";
import { scopedKey, useActiveProjectId, useProjects } from "../lib/projects.js";
import { sortByDueComplexityName, sortByShotCode } from "../lib/sortShots.js";
import { assigneesLabel, getAssignees } from "../lib/taskAssignees.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./Dashboard.css";

// Company-wide, read-only project tracker. Nothing on this page edits data —
// it's a condensed rollup of Post Reports, Shot Board, Review and the Artist
// Portal, and every row/tile just links to the page where the real change
// is made. Two levels: an overview of every project, and a click-in view of
// one (?project=<id>).

const STATUS_LABELS = {
  final: "Final",
  pending: "In review",
  wip: "WIP",
  needs_revision: "Revise",
  assigned: "Not started",
};

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// One horizontal bar split by task status, in a fixed order so bars line up
// row to row.
function StatusBar({ byStatus, total, tall }) {
  return (
    <div className={`dash-bar${tall ? " dash-bar-tall" : ""}`}>
      {total === 0 ? (
        <span className="dash-bar-empty" />
      ) : (
        STATUS_ORDER.filter((s) => byStatus[s] > 0).map((s) => (
          <span
            key={s}
            className="dash-bar-seg"
            style={{ flexGrow: byStatus[s], background: STATUS_COLORS[s] }}
            title={`${STATUS_LABELS[s]}: ${byStatus[s]}`}
          />
        ))
      )}
    </div>
  );
}

function StatusLegend({ byStatus }) {
  return (
    <div className="dash-legend">
      {STATUS_ORDER.map((s) => (
        <span className="dash-legend-item" key={s}>
          <span className="dash-dot" style={{ background: STATUS_COLORS[s] }} />
          {STATUS_LABELS[s]}
          {byStatus && <span className="dash-legend-count">{byStatus[s]}</span>}
        </span>
      ))}
    </div>
  );
}

function deliveryInfo(deliveryDate) {
  const days = daysUntilDate(deliveryDate);
  if (days === null) return { text: "No delivery date", tone: null };
  if (days < 0) return { text: `${-days}d past delivery`, tone: "danger" };
  if (days === 0) return { text: "Delivers today", tone: "danger" };
  return { text: `${days}d to delivery`, tone: days <= 7 ? "danger" : days <= 21 ? "warning" : null };
}

function Kpi({ label, value, sub, tone, onClick }) {
  return (
    <div className={`card dash-kpi${onClick ? " is-link" : ""}`} onClick={onClick}>
      <span className="label">{label}</span>
      <span className={`dash-kpi-value${tone ? ` tone-${tone}` : ""}`}>{value}</span>
      {sub && <span className="dash-kpi-sub">{sub}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- overview

function Overview({ projects, activeId, onOpen }) {
  const rows = useMemo(
    () =>
      projects
        .map((p) => ({ project: p, stats: computeProjectStats(loadProjectShots(p.id)) }))
        .sort((a, b) => {
          // Soonest delivery first; undated projects after, by name.
          const da = a.project.deliveryDate;
          const db = b.project.deliveryDate;
          if (da && db) return da.localeCompare(db);
          if (da) return -1;
          if (db) return 1;
          return a.project.name.localeCompare(b.project.name);
        }),
    [projects]
  );

  const totals = rows.reduce(
    (acc, { stats }) => ({
      shots: acc.shots + stats.shotCount,
      review: acc.review + stats.byStatus.pending,
      revise: acc.revise + stats.byStatus.needs_revision,
      overdue: acc.overdue + stats.overdueShots,
      finaled: acc.finaled + stats.finaledThisWeek,
    }),
    { shots: 0, review: 0, revise: 0, overdue: 0, finaled: 0 }
  );

  return (
    <>
      <div className="dashboard-header">
        <span className="dashboard-title">COMPANY OVERVIEW — {projects.length} PROJECT{projects.length === 1 ? "" : "S"}</span>
      </div>

      <div className="dash-kpis">
        <Kpi label="Shots in post" value={totals.shots} />
        <Kpi label="Awaiting review" value={totals.review} tone={totals.review ? "accent" : null} />
        <Kpi label="Needs revision" value={totals.revise} tone={totals.revise ? "danger" : null} />
        <Kpi label="Overdue shots" value={totals.overdue} tone={totals.overdue ? "danger" : null} />
        <Kpi label="Finaled this week" value={totals.finaled} sub="tasks" tone={totals.finaled ? "success" : null} />
      </div>

      <div className="card dash-projects">
        <div className="dash-projects-head">
          <span>Project</span>
          <span>Shots</span>
          <span>Progress (tasks)</span>
          <span>Review</span>
          <span>Revise</span>
          <span>Overdue</span>
          <span>Delivery</span>
        </div>
        {rows.length === 0 && <span className="dash-empty">No projects yet.</span>}
        {rows.map(({ project, stats }) => {
          const delivery = deliveryInfo(project.deliveryDate);
          return (
            <div
              className={`dash-project-row${project.id === activeId ? " is-active" : ""}`}
              key={project.id}
              onClick={() => onOpen(project.id)}
            >
              <span className="dash-project-name">
                <span className="pill mono">{project.showCode}</span>
                <span className="dash-project-title">{project.name}</span>
              </span>
              <span className="dash-num">{stats.shotCount}</span>
              <span className="dash-progress-cell">
                <StatusBar byStatus={stats.byStatus} total={stats.taskCount} />
                <span className="dash-pct">{stats.taskCount ? `${stats.finalPct}%` : "—"}</span>
              </span>
              <span className={`dash-num${stats.byStatus.pending ? " tone-accent" : ""}`}>{stats.byStatus.pending}</span>
              <span className={`dash-num${stats.byStatus.needs_revision ? " tone-danger" : ""}`}>
                {stats.byStatus.needs_revision}
              </span>
              <span className={`dash-num${stats.overdueShots ? " tone-danger" : ""}`}>{stats.overdueShots}</span>
              <span className="dash-delivery">
                {project.deliveryDate && <span className="mono">{project.deliveryDate}</span>}
                <span className={delivery.tone ? `tone-${delivery.tone}` : "dash-muted"}>{delivery.text}</span>
              </span>
            </div>
          );
        })}
        <StatusLegend />
      </div>
    </>
  );
}

// ------------------------------------------------------------ project view

function ShotTile({ shot, onOpen }) {
  const status = aggregateTaskStatus(shot.tasks);
  const statusKey = shot.tasks.length ? Object.keys(STATUS_COLORS).find((k) => taskStatusInfo(k) === status) : null;
  const color = statusKey ? STATUS_COLORS[statusKey] : "var(--border)";
  const importance = computeImportance(shot);
  const overdue = isShotOverdue(shot);
  return (
    <div className="dash-tile" style={{ "--tile-color": color }} onClick={onOpen}>
      <div className="dash-tile-thumb">
        {shot.thumbnail ? <img src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} /> : <ImageIcon />}
        {importance.tier === "high" && <span className="dash-tile-flag" title="High importance" />}
      </div>
      <div className="dash-tile-foot">
        <span className="dash-tile-code">{shot.shotCode}</span>
        <span className="dash-tile-dots">
          {shot.tasks.map((t) => (
            <span key={t.id} className="dash-dot" style={{ background: STATUS_COLORS[t.status] ?? STATUS_COLORS.assigned }} />
          ))}
        </span>
      </div>
      <div className="dash-tile-pop">
        <span className="dash-tile-pop-title">
          {shot.shotCode}
          <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{shot.tasks.length ? status.label : "No tasks"}</span>
        </span>
        {shot.internalDescription && <span className="dash-tile-pop-desc">{shot.internalDescription}</span>}
        {shot.dueDate && (
          <span className={`dash-tile-pop-due${overdue ? " tone-danger" : ""}`}>
            Due {shot.dueDate}
            {overdue ? " · overdue" : ""}
          </span>
        )}
        {shot.tasks.map((t) => {
          const info = taskStatusInfo(t.status);
          return (
            <span className="dash-tile-pop-task" key={t.id}>
              <span className="dash-tile-pop-type">{t.type}</span>
              <span className="dash-muted">{assigneesLabel(t)}</span>
              <span className={`pill${info.tone ? ` pill-${info.tone}` : ""}`}>{info.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ProjectView({ project, onBack }) {
  const navigate = useNavigate();
  const [shots] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project.id), []);
  const stats = useMemo(() => computeProjectStats(shots), [shots]);
  const delivery = deliveryInfo(project.deliveryDate);
  const openShot = (shot) => navigate(`/shot/${shot.shotCode}`);

  // Scenes in natural order, each with its shots in shot-code order.
  const scenes = useMemo(() => {
    const groups = new Map();
    for (const shot of sortByShotCode(shots)) {
      const key = padScene(shot.scene) || "—";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(shot);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [shots]);

  const taskRows = shots.flatMap((shot) => shot.tasks.map((task) => ({ shot, task })));

  // Waiting longest first. Submission time comes from versionHistory (older
  // tasks have it); falls back to when it entered pending.
  const reviewQueue = taskRows
    .filter(({ task }) => task.status === "pending")
    .map((row) => ({
      ...row,
      since:
        (row.task.versionHistory ?? []).find((v) => v.version === row.task.version)?.submittedAt ?? statusSince(row.task),
    }))
    .sort((a, b) => (a.since ?? "9").localeCompare(b.since ?? "9"));

  const revisions = taskRows
    .filter(({ task }) => task.status === "needs_revision")
    .map((row) => ({ ...row, since: statusSince(row.task) }))
    .sort((a, b) => (a.since ?? "9").localeCompare(b.since ?? "9"));

  // Open (non-final) work per artist.
  const artistLoad = useMemo(() => {
    const map = new Map();
    for (const { task } of taskRows) {
      if (task.status === "final") continue;
      for (const name of getAssignees(task)) {
        if (!map.has(name)) map.set(name, { assigned: 0, wip: 0, pending: 0, needs_revision: 0, final: 0, total: 0 });
        const entry = map.get(name);
        entry[task.status in entry ? task.status : "assigned"]++;
        entry.total++;
      }
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [shots]);
  const maxLoad = Math.max(1, ...artistLoad.map(([, l]) => l.total));

  const attention = sortByDueComplexityName(shots)
    .filter((shot) => !(shot.tasks.length && shot.tasks.every((t) => t.status === "final")))
    .map((shot) => {
      const importance = computeImportance(shot);
      const unassigned = shot.tasks.filter((t) => getAssignees(t).length === 0).length;
      const overdue = isShotOverdue(shot);
      const revise = shot.tasks.some((t) => t.status === "needs_revision");
      const reasons = [];
      if (overdue) reasons.push({ label: `Overdue ${shot.dueDate}`, tone: "danger" });
      if (importance.tier === "high") reasons.push({ label: "High importance", tone: "danger" });
      else if (importance.tier === "medium") reasons.push({ label: "Watch", tone: "warning" });
      if (revise) reasons.push({ label: "In revision", tone: "danger" });
      if (unassigned > 0) reasons.push({ label: `${unassigned} unassigned`, tone: "warning" });
      const severity =
        (overdue ? 3 : 0) + (importance.tier === "high" ? 2 : importance.tier === "medium" ? 1 : 0) + (revise ? 1 : 0) + unassigned;
      return { shot, reasons, severity };
    })
    .filter((row) => row.reasons.length > 0)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 8);

  return (
    <>
      <div className="dashboard-header">
        <div className="dash-project-header">
          <span className="dash-back" onClick={onBack}>
            ← All projects
          </span>
          <span className="dashboard-title">
            <span className="pill mono">{project.showCode}</span> {project.name.toUpperCase()}
          </span>
        </div>
        <span className={`pill${delivery.tone ? ` pill-${delivery.tone}` : ""}`}>
          {project.deliveryDate ? `Delivery ${project.deliveryDate} · ${delivery.text}` : delivery.text}
        </span>
      </div>

      <div className="dash-kpis">
        <Kpi
          label="Tasks final"
          value={`${stats.finalPct}%`}
          sub={`${stats.byStatus.final} of ${stats.taskCount}`}
          tone={stats.taskCount && stats.finalPct === 100 ? "success" : null}
        />
        <Kpi label="Shots final" value={stats.shotsFinal} sub={`of ${stats.shotCount}`} />
        <Kpi
          label="Awaiting review"
          value={stats.byStatus.pending}
          tone={stats.byStatus.pending ? "accent" : null}
          onClick={() => navigate("/review")}
        />
        <Kpi label="Needs revision" value={stats.byStatus.needs_revision} tone={stats.byStatus.needs_revision ? "danger" : null} />
        <Kpi label="Overdue shots" value={stats.overdueShots} tone={stats.overdueShots ? "danger" : null} />
        <Kpi
          label="Unassigned tasks"
          value={stats.unassigned}
          tone={stats.unassigned ? "warning" : null}
          onClick={() => navigate("/post-reports")}
        />
        <Kpi label="Finaled this week" value={stats.finaledThisWeek} sub="tasks" tone={stats.finaledThisWeek ? "success" : null} />
      </div>

      <div className="card dash-section is-link" onClick={() => navigate("/board")}>
        <div className="dash-section-head">
          <span className="label">Pipeline</span>
          <span className="dash-muted">{stats.taskCount} tasks · open Shot Board →</span>
        </div>
        <StatusBar byStatus={stats.byStatus} total={stats.taskCount} tall />
        <StatusLegend byStatus={stats.byStatus} />
      </div>

      <div className="card dash-section">
        <div className="dash-section-head">
          <span className="label">Shots by scene</span>
          <span className="dash-muted">Hover for tasks · click to open</span>
        </div>
        {scenes.length === 0 && <span className="dash-empty">No shots in post yet.</span>}
        {scenes.map(([scene, sceneShots]) => {
          const done = sceneShots.filter((s) => s.tasks.length && s.tasks.every((t) => t.status === "final")).length;
          return (
            <div className="dash-scene" key={scene}>
              <div className="dash-scene-head">
                <span className="dash-scene-code mono">SC{scene}</span>
                <span className="dash-muted">
                  {done}/{sceneShots.length} final
                </span>
              </div>
              <div className="dash-tiles">
                {sceneShots.map((shot) => (
                  <ShotTile key={shot.id} shot={shot} onOpen={() => openShot(shot)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="dash-two-col">
        <div className="card dash-section">
          <div className="dash-section-head">
            <span className="label">Review queue</span>
            <span className="dash-muted">waiting longest first</span>
          </div>
          {reviewQueue.length === 0 && revisions.length === 0 && <span className="dash-empty">Nothing waiting on review.</span>}
          {reviewQueue.map(({ shot, task, since }) => (
            <div className="dash-list-row" key={task.id} onClick={() => navigate(`/review?task=${task.id}`)}>
              <span className="dash-dot" style={{ background: STATUS_COLORS.pending }} />
              <span className="mono dash-list-code">{shot.shotCode}</span>
              <span className="dash-list-main">
                {task.type}
                {task.version ? ` · ${formatVersion(task.version)}` : ""}
              </span>
              <span className="dash-muted dash-list-who">{assigneesLabel(task)}</span>
              <span className="dash-list-age">{since ? formatAge(since) : "—"}</span>
            </div>
          ))}
          {revisions.length > 0 && <span className="label dash-subhead">Sent back for revision</span>}
          {revisions.map(({ shot, task, since }) => (
            <div className="dash-list-row" key={task.id} onClick={() => openShot(shot)}>
              <span className="dash-dot" style={{ background: STATUS_COLORS.needs_revision }} />
              <span className="mono dash-list-code">{shot.shotCode}</span>
              <span className="dash-list-main">
                {task.type}
                {task.version ? ` · ${formatVersion(task.version)}` : ""}
              </span>
              <span className="dash-muted dash-list-who">{assigneesLabel(task)}</span>
              <span className="dash-list-age">{since ? formatAge(since) : "—"}</span>
            </div>
          ))}
        </div>

        <div className="card dash-section">
          <div className="dash-section-head">
            <span className="label">Artist load</span>
            <span className="dash-muted">open tasks</span>
          </div>
          {artistLoad.length === 0 && <span className="dash-empty">No open assigned tasks.</span>}
          {artistLoad.map(([name, load]) => (
            <div className="dash-artist-row" key={name}>
              <span className="dash-artist-name">{name}</span>
              <div className="dash-artist-bar" style={{ width: `${(load.total / maxLoad) * 100}%` }}>
                <StatusBar byStatus={load} total={load.total} />
              </div>
              <span className="dash-num">{load.total}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card dash-section">
        <div className="dash-section-head">
          <span className="label">Needs attention</span>
        </div>
        {attention.length === 0 && <span className="dash-empty">Nothing needs attention right now.</span>}
        {attention.map(({ shot, reasons }) => (
          <div className="dash-list-row" key={shot.id} onClick={() => openShot(shot)}>
            {shot.thumbnail ? (
              <img className="dash-attn-thumb" src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} />
            ) : (
              <span className="dash-attn-thumb dash-attn-thumb-empty">
                <ImageIcon />
              </span>
            )}
            <span className="mono dash-list-code">{shot.shotCode}</span>
            <span className="dash-attn-reasons">
              {reasons.map((r) => (
                <span className={`pill pill-${r.tone}`} key={r.label}>
                  {r.label}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// -------------------------------------------------------------------- page

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects] = useProjects();
  const [activeId, setActiveId] = useActiveProjectId();
  const selected = projects.find((p) => p.id === searchParams.get("project")) ?? null;

  // Clicking into a project also makes it the active one, so the shot /
  // review / board links from there land in the right project's data.
  const activate = (id) => {
    setActiveId(id);
    localStorage.setItem("vfx-supe-active-project-id", JSON.stringify(id));
  };
  const openProject = (id) => {
    activate(id);
    setSearchParams({ project: id });
  };

  // A direct link/refresh onto ?project=<id> also syncs the active project.
  useEffect(() => {
    if (selected && selected.id !== activeId) activate(selected.id);
  }, [selected?.id]);

  return (
    <div className="dashboard">
      {selected ? (
        <ProjectView key={selected.id} project={selected} onBack={() => setSearchParams({})} />
      ) : (
        <Overview projects={projects} activeId={activeId} onOpen={openProject} />
      )}
    </div>
  );
}
