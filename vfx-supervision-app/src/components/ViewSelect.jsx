import { formatVersion } from "../lib/fsAccess.js";

// The "what am I looking at" picker shared by Review & Dailies and the
// Shot Viewer: every submitted version of the task (newest first, the
// latest marked), plus the shot's plate when one has been imported.
// value is a version number or "plate"; null means the latest version.
export default function ViewSelect({ task, choices, hasPlate, value, onChange }) {
  if (choices.length <= 1 && !hasPlate) return null;
  const latest = task.version ?? choices[0] ?? null;
  const selected = value ?? latest;
  return (
    <select
      className="review-select mono review-view-select"
      value={String(selected ?? "")}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "plate" ? "plate" : Number(v) === latest ? null : Number(v));
      }}
    >
      {choices.map((v) => (
        <option value={String(v)} key={v}>
          {formatVersion(v)}
          {v === latest ? " — latest" : ""}
        </option>
      ))}
      {hasPlate && <option value="plate">Plate</option>}
    </select>
  );
}
