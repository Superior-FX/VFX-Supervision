import { useState } from "react";
import { PencilIcon } from "../../components/SceneVfxFields.jsx";
import { POST_TASK_TYPES } from "../../data/postTasks.js";
import { useEnterKey } from "../../lib/useEnterKey.js";
import { useLocalStorageState } from "../../lib/useLocalStorageState.js";
import "./ArtistDirectory.css";

function blankArtist() {
  return { id: crypto.randomUUID(), name: "", departments: [] };
}

// Older records stored a single `department` string — normalize to an array.
export function artistDepartments(artist) {
  if (Array.isArray(artist.departments)) return artist.departments;
  return artist.department ? [artist.department] : [];
}

function DepartmentPicker({ selected, onToggle }) {
  return (
    <div className="artist-directory-departments">
      {POST_TASK_TYPES.map((t) => (
        <span
          key={t}
          className={`pill artist-directory-dept-pill${selected.includes(t) ? " pill-accent" : ""}`}
          onClick={() => onToggle(t)}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ArtistRemoveConfirm({ artist, onConfirm, onCancel }) {
  const [text, setText] = useState("");
  const matches = text.trim().toUpperCase() === "DELETE";
  useEnterKey(() => {
    if (matches) onConfirm();
  });

  return (
    <div className="card artist-directory-row-confirm">
      <span className="artist-directory-confirm-label">
        Type DELETE to remove {artist.name} from the artist database
      </span>
      <input
        className="report-edit-input mono artist-directory-confirm-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="DELETE"
        autoFocus
      />
      <span className={`btn btn-danger${matches ? "" : " btn-disabled"}`} onClick={matches ? onConfirm : undefined}>
        Confirm delete
      </span>
      <span className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </span>
    </div>
  );
}

function ArtistForm({ value, onChange, onSave, onCancel }) {
  const toggleDept = (t) => {
    const next = value.departments.includes(t)
      ? value.departments.filter((d) => d !== t)
      : [...value.departments, t];
    onChange({ ...value, departments: next });
  };

  const canSave = value.name.trim() && value.departments.length > 0;
  useEnterKey(() => {
    if (canSave) onSave();
  });

  return (
    <div className="card artist-directory-form">
      <input
        className="report-edit-input"
        placeholder="Artist name"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        autoFocus
      />
      <span className="label">Tasks this artist can take (select all that apply)</span>
      <DepartmentPicker selected={value.departments} onToggle={toggleDept} />
      <div className="artist-directory-form-actions">
        <span className={`btn btn-primary${canSave ? "" : " btn-disabled"}`} onClick={canSave ? onSave : undefined}>
          Save
        </span>
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
    </div>
  );
}

export default function ArtistDirectory({ isAdmin }) {
  const [artists, setArtists] = useLocalStorageState("vfx-supe-artists", []);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const startAdd = () => setDraft(blankArtist());
  const cancelAdd = () => setDraft(null);
  const saveAdd = () => {
    setArtists((prev) => [...prev, { ...draft, name: draft.name.trim() }]);
    setDraft(null);
  };

  const startEdit = (artist) => {
    setEditingId(artist.id);
    setEditDraft({ ...artist, departments: artistDepartments(artist) });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };
  const saveEdit = () => {
    setArtists((prev) =>
      prev.map((a) => (a.id === editDraft.id ? { ...editDraft, name: editDraft.name.trim() } : a))
    );
    setEditingId(null);
    setEditDraft(null);
  };

  const removeArtist = (id) => {
    setArtists((prev) => prev.filter((a) => a.id !== id));
    if (editingId === id) cancelEdit();
    setRemovingId(null);
  };

  return (
    <div className="artist-directory">
      <div className="artist-directory-header">
        <span className="pill">{artists.length} artists</span>
        {isAdmin && !draft && (
          <span className="btn btn-secondary" onClick={startAdd}>
            + Add Artist
          </span>
        )}
      </div>

      {!isAdmin && (
        <div className="card artist-directory-hint">Only Admins can add, edit, or remove artists.</div>
      )}

      {draft && <ArtistForm value={draft} onChange={setDraft} onSave={saveAdd} onCancel={cancelAdd} />}

      {artists.length === 0 && !draft ? (
        <div className="card artist-directory-empty">No artists yet.</div>
      ) : (
        <div className="artist-directory-list">
          {artists.map((a) => {
            if (editingId === a.id) {
              return (
                <ArtistForm key={a.id} value={editDraft} onChange={setEditDraft} onSave={saveEdit} onCancel={cancelEdit} />
              );
            }
            if (removingId === a.id) {
              return (
                <ArtistRemoveConfirm
                  key={a.id}
                  artist={a}
                  onConfirm={() => removeArtist(a.id)}
                  onCancel={() => setRemovingId(null)}
                />
              );
            }
            return (
              <div className="card artist-directory-row" key={a.id}>
                <span className="artist-directory-name">{a.name}</span>
                <div className="artist-directory-row-depts">
                  {artistDepartments(a).map((d) => (
                    <span className="pill mono" key={d}>
                      {d}
                    </span>
                  ))}
                </div>
                {isAdmin && (
                  <div className="artist-directory-row-actions">
                    <span className="artist-directory-edit" onClick={() => startEdit(a)} title="Edit artist">
                      <PencilIcon />
                    </span>
                    <span className="artist-directory-remove" onClick={() => setRemovingId(a.id)} title="Remove artist">
                      ×
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
