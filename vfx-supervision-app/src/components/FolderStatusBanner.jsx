import { useState } from "react";
import "./FolderStatusBanner.css";

// The one warning every folder-using page shows when the project folder
// isn't usable — with the button that fixes it right there, instead of a
// failure surfacing later as a silent no-op or a misleading error.
//
// folder: the useProjectFolder() result. show: whether this page actually
// needs the folder right now (e.g. the project has folders on disk).
// impact: what stops working on this page, finishing "…until you do,".
export default function FolderStatusBanner({ folder, show, showCode, impact }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!show || (folder.status !== "missing" && folder.status !== "needs-permission")) return null;

  const run = async (action) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (err?.name !== "AbortError") setError(err?.message || "Couldn't connect the folder — try again.");
    } finally {
      setBusy(false);
    }
  };

  const missing = folder.status === "missing";

  return (
    <div className="card folder-status-banner" role="alert">
      <div className="folder-status-banner-text">
        <span className="folder-status-banner-title">
          {missing ? "Project folder isn't connected in this browser" : "Chrome needs your OK to use the project folder"}
        </span>
        <span>
          {missing
            ? `Until you reconnect it, ${impact}. Pick the ${showCode || "show"} folder, or the folder it's in — nothing new is created.`
            : `This happens after Chrome restarts. Until you allow it, ${impact}.`}
        </span>
        {error && <span className="folder-status-banner-error">{error}</span>}
      </div>
      <span
        className={`btn btn-secondary${busy ? " btn-disabled" : ""}`}
        onClick={busy ? undefined : () => run(missing ? folder.reconnect : folder.grantAccess)}
      >
        {missing ? "Reconnect Folder…" : "Allow Access"}
      </span>
    </div>
  );
}
