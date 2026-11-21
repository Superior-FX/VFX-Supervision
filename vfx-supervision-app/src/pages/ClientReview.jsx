import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import logo from "../../logo/SuperiorFX_logo_003.jpg";
import AnnotatedPlayer from "../components/AnnotatedPlayer.jsx";
import { formatVersion } from "../lib/fsAccess.js";
import { drivePreviewUrl, driveStreamUrl, hasStreamKey } from "../lib/googleDrive.js";
import { supabase } from "../lib/supabase.js";
import "./ClientReview.css";

// The page a client opens from a review link (/r/<token>). No sign-in and
// none of the team's data — just the shots on that link, played straight
// from Google Drive.

// Checks Drive will stream the file to our own player; if it won't (Drive
// throttling a busy file, an older file needing a resource key), the page
// falls back to Drive's embedded player.
async function canStream(fileId) {
  if (!hasStreamKey()) return false;
  try {
    const res = await fetch(driveStreamUrl(fileId), { headers: { Range: "bytes=0-0" } });
    return res.ok;
  } catch {
    return false;
  }
}

export default function ClientReview() {
  const { token } = useParams();
  const [link, setLink] = useState(undefined); // undefined = loading, null = not available
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null); // "stream" | "embed" | null while checking

  useEffect(() => {
    document.title = "Superior-FX Review";
    if (!supabase) {
      setLink(null);
      return;
    }
    let cancelled = false;
    supabase.rpc("get_review_link", { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      setLink(error || !data ? null : data);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const item = link?.items?.[index] ?? null;

  useEffect(() => {
    setMode(null);
    if (!item) return;
    let cancelled = false;
    canStream(item.driveFileId).then((ok) => {
      if (!cancelled) setMode(ok ? "stream" : "embed");
    });
    return () => {
      cancelled = true;
    };
  }, [item?.driveFileId]);

  if (link === undefined) {
    return (
      <Shell>
        <div className="crev-message">Loading review…</div>
      </Shell>
    );
  }
  if (!link || !link.items?.length) {
    return (
      <Shell>
        <div className="crev-message">
          <strong>This review link isn't available.</strong>
          <span>It may have expired or been turned off. Ask your Superior-FX contact for a new one.</span>
        </div>
      </Shell>
    );
  }

  const items = link.items;
  const label = (it) => `${it.shotCode} — ${it.taskType} ${formatVersion(it.version)}`;

  return (
    <Shell title={link.title}>
      <div className="crev-body">
        {items.length > 1 && (
          <nav className="crev-list" aria-label="Shots">
            {items.map((it, i) => (
              <button
                type="button"
                key={`${it.driveFileId}:${i}`}
                className={`crev-list-item${i === index ? " is-active" : ""}`}
                onClick={() => setIndex(i)}
              >
                <span className="mono">{it.shotCode}</span>
                <span className="crev-list-sub">
                  {it.taskType} · {formatVersion(it.version)}
                </span>
              </button>
            ))}
          </nav>
        )}

        <div className="crev-player">
          <div className="crev-player-head">
            <span className="crev-shot mono">{label(item)}</span>
            {items.length > 1 && (
              <span className="crev-count">
                {index + 1} of {items.length}
              </span>
            )}
          </div>

          {mode === null && <div className="crev-frame">Loading…</div>}
          {mode === "stream" && <AnnotatedPlayer key={item.driveFileId} src={driveStreamUrl(item.driveFileId)} />}
          {mode === "embed" && (
            <div className="crev-embed">
              <iframe
                key={item.driveFileId}
                src={drivePreviewUrl(item.driveFileId)}
                title={label(item)}
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          )}

          {items.length > 1 && (
            <div className="crev-nav">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index === items.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ title, children }) {
  return (
    <div className="crev">
      <header className="crev-header">
        <img className="crev-logo" src={logo} alt="Superior-FX" />
        <span className="crev-brand">Superior-FX</span>
        {title && <span className="crev-title">{title}</span>}
      </header>
      <main className="crev-main">{children}</main>
    </div>
  );
}
