import { useState } from "react";
import { useRole } from "../lib/role.js";
import "./FootageNotes.css";

// Extra notes on a shot's ingested footage (shot.footageNotes) — anyone can
// read them, only supervisors/producers (and Admin) can add or remove.
// A Post-Supervisor can add, but removes only the notes they wrote.
// Stored as { id, text, authorId, roles, author, role, createdAt }. Notes written before
// sign-in have only role.
export default function FootageNotes({ notes = [], onChange, compact = false }) {
  const [draft, setDraft] = useState("");
  const { can, profile, roles, primaryRole } = useRole();
  const canEdit = Boolean(onChange) && can("footage_notes");
  // A Post-Supervisor may only remove notes they wrote themselves (never an
  // Admin's, or anyone else's). Every other role that can edit removes any.
  const ownNotesOnly = primaryRole === "Post-Supervisor";
  const canRemove = (n) => canEdit && (!ownNotesOnly || (n.authorId && n.authorId === profile?.id && !(n.roles ?? []).includes("Admin")));

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...notes, {
        id: crypto.randomUUID(),
        text,
        authorId: profile?.id ?? null,
        roles,
        author: profile?.name || profile?.email || "",
        role: primaryRole,
        createdAt: new Date().toISOString(),
      }]);
    setDraft("");
  };

  const remove = (id) => onChange(notes.filter((n) => n.id !== id || !canRemove(n)));

  if (!canEdit && notes.length === 0) return compact ? null : <span className="footage-notes-empty">No footage notes.</span>;

  return (
    <div className={`footage-notes${compact ? " footage-notes-compact" : ""}`}>
      {notes.map((n) => (
        <div className="footage-note" key={n.id}>
          <span className="footage-note-text">{n.text}</span>
          <span className="footage-note-meta mono">
            {n.author || n.role} · {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {canRemove(n) && (
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
