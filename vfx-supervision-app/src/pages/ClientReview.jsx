import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import logo from "../../logo/SuperiorFX_logo_003.jpg";
import AnnotatedPlayer from "../components/AnnotatedPlayer.jsx";
import { formatVersion } from "../lib/fsAccess.js";
import { drivePreviewUrl, driveStreamUrl, hasStreamKey } from "../lib/googleDrive.js";
import { DECISIONS, loadMyFeedback, saveMyFeedback } from "../lib/reviewFeedback.js";
import { supabase } from "../lib/supabase.js";
import "./ClientReview.css";

// The page a client opens from a review link (/r/<token>). No sign-in and
// none of the team's data — just the shots on that link, played straight
// from Google Drive. The client can leave feedback on each shot: notes and
// drawings on frames, an overall comment, and Approve / Request changes.
// It saves as they go (under the name they give) and shows up for the team
// on Client Review and Review & Dailies; it never changes a task's status.

const nameKey = (token) => `crev-name:${token}`;
function readName(token) {
  try {
    return localStorage.getItem(nameKey(token)) ?? "";
  } catch {
    return "";
  }
}
function storeName(token, name) {
  try {
    localStorage.setItem(nameKey(token), name);
  } catch {
    // Private window: they'll be asked again next visit.
  }
}

const EMPTY = { annotations: [], comment: "", decision: null };

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
  const [reviewer, setReviewer] = useState(() => readName(token));
  const [nameDraft, setNameDraft] = useState("");
  const [feedback, setFeedback] = useState({}); // driveFileId -> { annotations, comment, decision }
  const [feedbackError, setFeedbackError] = useState("");
  const [saveState, setSaveState] = useState(""); // "" | "saving" | "saved" | error text
  const timers = useRef(new Map()); // driveFileId -> pending save timer
  const latest = useRef({});
  latest.current = feedback;
  const linkReady = Boolean(link);

  // Their earlier feedback, once we know who they are.
  useEffect(() => {
    if (!reviewer || !linkReady) return;
    let cancelled = false;
    loadMyFeedback(token, reviewer)
      .then((byFile) => {
        if (cancelled) return;
        setFeedback((prev) => ({ ...byFile, ...prev }));
        setFeedbackError("");
      })
      .catch((err) => !cancelled && setFeedbackError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token, reviewer, linkReady]);

  const flush = useCallback(
    async (fileId) => {
      clearTimeout(timers.current.get(fileId));
      timers.current.delete(fileId);
      setSaveState("saving");
      try {
        await saveMyFeedback(token, reviewer, fileId, latest.current[fileId] ?? EMPTY);
        if (!timers.current.size) setSaveState("saved");
      } catch (err) {
        setSaveState(err.message || "Couldn't save your notes.");
      }
    },
    [token, reviewer]
  );

  // Changes save a moment after the last edit (a click on Approve / Request
  // changes saves at once).
  const updateFeedback = (fileId, patch, { now = false } = {}) => {
    const next = { ...latest.current, [fileId]: { ...EMPTY, ...latest.current[fileId], ...patch } };
    latest.current = next;
    setFeedback(next);
    clearTimeout(timers.current.get(fileId));
    setSaveState("saving");
    if (now) flush(fileId);
    else timers.current.set(fileId, setTimeout(() => flush(fileId), 900));
  };

  // Warn before leaving with a save still waiting.
  useEffect(() => {
    const onLeave = (e) => {
      if (timers.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  // Moving to another shot saves the one being left straight away.
  const goTo = (i) => {
    for (const fileId of [...timers.current.keys()]) flush(fileId);
    setIndex(i);
  };

  const confirmName = () => {
    const name = nameDraft.trim().slice(0, 80);
    if (!name) return;
    storeName(token, name);
    setFeedback({});
    latest.current = {};
    setReviewer(name);
  };

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
  const mine = feedback[item.driveFileId] ?? EMPTY;
  const canNote = Boolean(reviewer) && !feedbackError;

  const nameForm = (
    <form
      className="crev-name"
      onSubmit={(e) => {
        e.preventDefault();
        confirmName();
      }}
    >
      <span className="label">Leave notes</span>
      <span className="crev-hint">Enter your name so the team knows who the notes are from.</span>
      <div className="crev-name-row">
        <input
          className="crev-input"
          placeholder="Your name"
          maxLength={80}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!nameDraft.trim()}>
          Start
        </button>
      </div>
    </form>
  );

  const saveIsError = saveState && saveState !== "saving" && saveState !== "saved";

  const renderFeedback = (fullscreen) => {
    if (!reviewer) return nameForm;
    if (feedbackError) return <div className="crev-feedback-error">{feedbackError}</div>;
    return (
      <div className={`crev-feedback${fullscreen ? " is-compact" : ""}`}>
        <div className="crev-feedback-head">
          <span className="label">Your feedback on {item.shotCode}</span>
          <span className={`crev-save${saveIsError ? " is-error" : ""}`}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState}
          </span>
        </div>
        {!fullscreen && (
          <span className="crev-hint">
            {mode === "stream"
              ? "Draw on the picture or add a note to mark a frame. "
              : "This shot opened in Google's player, so frame notes aren't available — leave a comment instead. "}
            Notes from {reviewer} ·{" "}
            <button
              type="button"
              className="crev-link-btn"
              onClick={() => {
                setNameDraft(reviewer);
                setReviewer("");
              }}
            >
              not you?
            </button>
          </span>
        )}
        <textarea
          className="crev-comment"
          placeholder="Overall comments on this shot…"
          maxLength={10000}
          value={mine.comment}
          onChange={(e) => updateFeedback(item.driveFileId, { comment: e.target.value })}
        />
        <div className="crev-decision">
          <button
            type="button"
            className={`btn ${mine.decision === "approved" ? "btn-primary" : "btn-secondary"}`}
            onClick={() =>
              updateFeedback(item.driveFileId, { decision: mine.decision === "approved" ? null : "approved" }, { now: true })
            }
          >
            {mine.decision === "approved" ? "✓ Approved" : "Approve"}
          </button>
          <button
            type="button"
            className={`btn ${mine.decision === "changes" ? "btn-danger" : "btn-secondary"}`}
            onClick={() =>
              updateFeedback(item.driveFileId, { decision: mine.decision === "changes" ? null : "changes" }, { now: true })
            }
          >
            {mine.decision === "changes" ? "✎ Changes requested" : "Request changes"}
          </button>
        </div>
      </div>
    );
  };

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
                onClick={() => goTo(i)}
              >
                <span className="mono">{it.shotCode}</span>
                <span className="crev-list-sub">
                  {it.taskType} · {formatVersion(it.version)}
                </span>
                {feedback[it.driveFileId]?.decision && (
                  <span className={`pill pill-${DECISIONS[feedback[it.driveFileId].decision].tone} crev-list-pill`}>
                    {DECISIONS[feedback[it.driveFileId].decision].label}
                  </span>
                )}
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
          {mode === "stream" && (
            <AnnotatedPlayer
              key={item.driveFileId}
              src={driveStreamUrl(item.driveFileId)}
              annotations={mine.annotations}
              onChange={canNote ? (annotations) => updateFeedback(item.driveFileId, { annotations }) : undefined}
              notes={renderFeedback}
            />
          )}
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
          {mode === "embed" && renderFeedback(false)}

          {items.length > 1 && (
            <div className="crev-nav">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index === 0}
                onClick={() => goTo(index - 1)}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index === items.length - 1}
                onClick={() => goTo(index + 1)}
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
