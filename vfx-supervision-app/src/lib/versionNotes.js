// Per-version notes. Each submission's entry in task.versionHistory carries
// the artist's note (`note`, written by Upload Shot) and, from 2026-10-05 on,
// the supervisor's note for that version (`supNote`). task.versionNote /
// task.supNote still mirror the current version, so older readers keep
// working; versions from before this have no supNote of their own.

export function versionNotes(task, version) {
  const entry = (task.versionHistory ?? []).find((v) => v.version === version);
  const isCurrent = version === (task.version ?? null);
  return {
    artistNote: entry?.note ?? (isCurrent ? task.versionNote : undefined),
    supNote: entry?.supNote ?? (isCurrent ? task.supNote : undefined),
    submittedAt: entry?.submittedAt ?? null,
  };
}

// Saves the supervisor's note on the task's current version (and the
// task-level mirror).
export function withCurrentSupNote(task, note) {
  const supNote = note.trim() || undefined;
  const history = task.versionHistory ?? [];
  const version = task.version ?? null;
  const nextHistory =
    version == null
      ? history
      : history.some((v) => v.version === version)
        ? history.map((v) => (v.version === version ? { ...v, supNote } : v))
        : [...history, { version, supNote }].sort((a, b) => a.version - b.version);
  return { ...task, supNote, versionHistory: nextHistory };
}
