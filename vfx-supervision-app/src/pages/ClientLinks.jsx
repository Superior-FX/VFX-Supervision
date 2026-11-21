import { useCallback, useEffect, useMemo, useState } from "react";
import { taskFolderSlug } from "../data/postTasks.js";
import { taskStatusInfo } from "../data/taskStatus.js";
import { formatVersion } from "../lib/fsAccess.js";
import {
  driveConfigured,
  findReviewProxy,
  getDriveToken,
  preloadGoogle,
  shareWithAnyone,
  unshare,
} from "../lib/googleDrive.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { sortByShotCode } from "../lib/sortShots.js";
import { supabase } from "../lib/supabase.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./ClientLinks.css";

const EXPIRY_CHOICES = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "Never" },
];

// 24 random bytes → 32 url-safe characters. Unguessable, so the link is the key.
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const linkUrl = (token) => `${window.location.origin}/r/${token}`;

const itemKey = (shotId, taskId) => `${shotId}:${taskId}`;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function linkState(link) {
  if (link.revoked_at) return "revoked";
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return "expired";
  return "active";
}

export default function ClientLinks() {
  const project = useActiveProject();
  const [postReports] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [finalsOnly, setFinalsOnly] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [expiryDays, setExpiryDays] = useState(14);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // token of the link just made
  const [links, setLinks] = useState([]);
  const [linksError, setLinksError] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => preloadGoogle(), []);

  // Every task whose current version has a review proxy.
  const candidates = useMemo(
    () =>
      sortByShotCode(postReports).flatMap((shot) =>
        (shot.tasks ?? [])
          .filter((t) => t.reviewFile && t.version && (!finalsOnly || t.status === "final"))
          .map((task) => ({ shot, task, key: itemKey(shot.id, task.id) }))
      ),
    [postReports, finalsOnly]
  );

  const chosen = candidates.filter((c) => selected.has(c.key));

  const loadLinks = useCallback(async () => {
    if (!project) return;
    const { data, error: err } = await supabase
      .from("review_links")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    if (err) {
      setLinksError(
        err.code === "42P01" || /review_links/.test(err.message)
          ? "Client review links aren't set up in the database yet — run supabase/migrations/005_client_review_links.sql."
          : err.message
      );
      return;
    }
    setLinksError("");
    setLinks(data ?? []);
  }, [project?.id]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allChosen = candidates.length > 0 && candidates.every((c) => selected.has(c.key));
  const toggleAll = () =>
    setSelected(allChosen ? new Set() : new Set(candidates.map((c) => c.key)));

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(linkUrl(token));
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy it by hand.");
    }
  };

  // Shares every chosen proxy in Drive, then saves the link. If any proxy
  // can't be shared, everything shared so far is taken back off and no
  // link is made, so a client never gets a half-working link.
  const createLink = async () => {
    if (!chosen.length || busy) return;
    setError("");
    setCreated(null);
    const shared = [];
    try {
      setBusy("Signing in to Google…");
      await getDriveToken();
      const items = [];
      for (const [i, { shot, task }] of chosen.entries()) {
        setBusy(`Sharing ${shot.shotCode} ${task.type} (${i + 1} of ${chosen.length})…`);
        const file = await findReviewProxy({
          fileName: task.reviewFile,
          shotCode: shot.shotCode,
          taskFolder: taskFolderSlug(task.type),
        });
        const permissionId = await shareWithAnyone(file.id);
        shared.push({ fileId: file.id, permissionId });
        items.push({
          shotCode: shot.shotCode,
          taskType: task.type,
          version: task.version,
          fileName: task.reviewFile,
          driveFileId: file.id,
          permissionId,
        });
      }

      setBusy("Saving link…");
      const token = newToken();
      const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 86_400_000).toISOString() : null;
      const { error: err } = await supabase.from("review_links").insert({
        token,
        project_id: project.id,
        title: title.trim() || `${project.showCode} review — ${formatDate(new Date().toISOString())}`,
        client_name: clientName.trim(),
        items,
        expires_at: expiresAt,
      });
      if (err) throw new Error(err.message);

      setCreated(token);
      setSelected(new Set());
      setTitle("");
      setClientName("");
      await loadLinks();
    } catch (err) {
      setError(err.message || "Couldn't create the link.");
      // Files already shared by another live link keep their share.
      const stillUsed = new Set(
        links.filter((l) => !l.revoked_at).flatMap((l) => l.items.map((it) => it.driveFileId))
      );
      for (const s of shared) {
        if (!stillUsed.has(s.fileId)) await unshare(s.fileId, s.permissionId).catch(() => {});
      }
    } finally {
      setBusy("");
    }
  };

  // Revoking stops the link working at once (database), then takes each
  // file's link share back off in Drive — unless another live link of this
  // project still uses that file (Drive keeps one "anyone" share per file,
  // so both links ride on it).
  const revoke = async (link) => {
    setConfirmRevoke(null);
    setError("");
    try {
      setBusy("Signing in to Google…");
      await getDriveToken();
      setBusy("Revoking link…");
      const { error: err } = await supabase
        .from("review_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token", link.token);
      if (err) throw new Error(err.message);

      const stillUsed = new Set(
        links
          .filter((l) => l.token !== link.token && !l.revoked_at)
          .flatMap((l) => l.items.map((it) => it.driveFileId))
      );
      const failed = [];
      for (const it of link.items) {
        if (stillUsed.has(it.driveFileId)) continue;
        try {
          await unshare(it.driveFileId, it.permissionId);
        } catch {
          failed.push(it.fileName);
        }
      }
      if (failed.length) {
        setError(
          `The link no longer works, but these files are still shared in Google Drive — turn off link sharing on them by hand: ${failed.join(", ")}`
        );
      }
      await loadLinks();
    } catch (err) {
      setError(err.message || "Couldn't revoke the link.");
    } finally {
      setBusy("");
    }
  };

  if (!driveConfigured) {
    return (
      <div className="clinks">
        <div className="clinks-header">
          <span className="clinks-title">CLIENT REVIEW</span>
        </div>
        <div className="card clinks-setup">
          <strong>Google Drive isn't connected to the app yet.</strong>
          <span>
            Client links share review proxies straight from Google Drive. Add <code>VITE_GOOGLE_CLIENT_ID</code> and{" "}
            <code>VITE_GOOGLE_API_KEY</code> to <code>.env.local</code> (and to Vercel for the live site), then restart.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="clinks">
      <div className="clinks-header">
        <span className="clinks-title">CLIENT REVIEW</span>
        <span className="pill">{links.filter((l) => linkState(l) === "active").length} active links</span>
      </div>

      <div className="card clinks-intro">
        Pick shots, make a link, send it to the client. They watch the review proxies in the browser — no account
        needed. The files are shared from Google Drive as “anyone with the link can view” until the link is revoked.
      </div>

      {linksError && <div className="card clinks-error">{linksError}</div>}

      <section className="card clinks-new">
        <div className="clinks-section-head">
          <span className="label">New link</span>
          <label className="clinks-check">
            <input type="checkbox" checked={finalsOnly} onChange={(e) => setFinalsOnly(e.target.checked)} />
            Finals only
          </label>
        </div>

        {candidates.length === 0 ? (
          <div className="clinks-empty">
            {finalsOnly ? "No finaled tasks with a review proxy yet." : "No tasks have a review proxy yet."}
          </div>
        ) : (
          <div className="clinks-list">
            <label className="clinks-row clinks-row-all">
              <input type="checkbox" checked={allChosen} onChange={toggleAll} />
              <span>Select all ({candidates.length})</span>
            </label>
            {candidates.map(({ shot, task, key }) => {
              const status = taskStatusInfo(task.status);
              return (
                <label className="clinks-row" key={key}>
                  <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                  <span className="mono clinks-shot">{shot.shotCode}</span>
                  <span>{task.type}</span>
                  <span className="pill mono">{formatVersion(task.version)}</span>
                  <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
                </label>
              );
            })}
          </div>
        )}

        <div className="clinks-form">
          <label className="clinks-field">
            <span className="label">Title</span>
            <input
              className="clinks-input"
              placeholder={`${project?.showCode ?? ""} review — ${formatDate(new Date().toISOString())}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="clinks-field">
            <span className="label">Client</span>
            <input
              className="clinks-input"
              placeholder="Who it's for (only you see this)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </label>
          <label className="clinks-field clinks-field-short">
            <span className="label">Expires</span>
            <select className="clinks-input" value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
              {EXPIRY_CHOICES.map((c) => (
                <option key={c.days} value={c.days}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="clinks-actions">
          {busy && <span className="clinks-busy">{busy}</span>}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!chosen.length || Boolean(busy)}
            onClick={createLink}
          >
            Create link{chosen.length ? ` (${chosen.length} shot${chosen.length === 1 ? "" : "s"})` : ""}
          </button>
        </div>

        {error && <div className="clinks-error-inline">{error}</div>}

        {created && (
          <div className="clinks-created">
            <span className="label">Link ready</span>
            <div className="clinks-url-row">
              <input className="clinks-input mono" readOnly value={linkUrl(created)} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-secondary" onClick={() => copy(created)}>
                {copied === created ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card clinks-existing">
        <span className="label">Links for this project</span>
        {links.length === 0 ? (
          <div className="clinks-empty">No links yet.</div>
        ) : (
          links.map((link) => {
            const state = linkState(link);
            return (
              <div className={`clinks-link is-${state}`} key={link.token}>
                <div className="clinks-link-main">
                  <span className="clinks-link-title">{link.title || "Untitled review"}</span>
                  <span className="clinks-link-meta">
                    {link.client_name ? `${link.client_name} · ` : ""}
                    {link.items.length} shot{link.items.length === 1 ? "" : "s"} · made {formatDate(link.created_at)} ·{" "}
                    {state === "revoked"
                      ? `revoked ${formatDate(link.revoked_at)}`
                      : link.expires_at
                        ? `${state === "expired" ? "expired" : "expires"} ${formatDate(link.expires_at)}`
                        : "never expires"}{" "}
                    · {link.view_count} view{link.view_count === 1 ? "" : "s"}
                    {link.last_viewed_at ? ` (last ${formatDate(link.last_viewed_at)})` : ""}
                  </span>
                  <span className="clinks-link-shots mono">
                    {link.items.map((it) => `${it.shotCode} ${formatVersion(it.version)}`).join(" · ")}
                  </span>
                  {state === "expired" && (
                    <span className="clinks-link-note">
                      The link no longer opens, but its files are still shared in Drive — revoke to unshare them.
                    </span>
                  )}
                </div>
                <div className="clinks-link-actions">
                  <span className={`pill${state === "active" ? " pill-success" : state === "expired" ? " pill-warning" : ""}`}>
                    {state}
                  </span>
                  {state === "active" && (
                    <button type="button" className="btn btn-secondary" onClick={() => copy(link.token)}>
                      {copied === link.token ? "Copied" : "Copy link"}
                    </button>
                  )}
                  {state !== "revoked" &&
                    (confirmRevoke === link.token ? (
                      <>
                        <button type="button" className="btn btn-danger" disabled={Boolean(busy)} onClick={() => revoke(link)}>
                          Yes, revoke
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirmRevoke(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={Boolean(busy)}
                        onClick={() => setConfirmRevoke(link.token)}
                      >
                        Revoke
                      </button>
                    ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
