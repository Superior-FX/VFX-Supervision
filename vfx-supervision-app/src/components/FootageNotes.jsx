import { useState } from "react";
import { CURRENT_ROLE, canEditFootageNotes } from "../lib/role.js";
import "./FootageNotes.css";

// Extra notes on a shot's ingested footage (shot.footageNotes) — anyone can
// read them, only supervisors/producers (and Admin) can add or remove.
// Stored as { id, text, role, createdAt }; role stands in for the author
// until sign-in is back.
export default function FootageNotes({ notes = [], onChange, compact = false }) {
  const [draft, setDraft] = useState("");
  const canEdit = Boolean(onChange) && canEditFootageNotes();

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...notes, { id: crypto.randomUUID(), text, role: CURRENT_ROLE, createdAt: new Date().toISOString() }]);
    setDraft("");
  };

  const remove = (id) => onChange(notes.filter((n) => n.id !== id));

  if (!canEdit && notes.length === 0) return compact ? null : <span className="footage-notes-empty">No footage notes.</span>;

  return (
    <div className={`footage-notes${compact ? " footage-notes-compact" : ""}`}>
      {notes.map((n) => (
        <div className="footage-note" key={n.id}>
          <span className="footage-note-text">{n.text}</span>
          <span className="footage-note-meta mono">
            {n.role} · {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {canEdit && (
            <span className="footage-note-remove" onClick={() => remove(n.id)} title="Remove note">
              ×
            </span>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="footage-note-add">
          <textarea
            className="footage-note-input"
            placeholder="Add a footage note (supervisor / producer)…"
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
          />
          <span className={`btn btn-secondary footage-note-btn${draft.trim() ? "" : " btn-disabled"}`} onClick={add}>
            Add
          </span>
        </div>
      )}
    </div>
  );
}
