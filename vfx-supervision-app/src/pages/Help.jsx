import { useSearchParams } from "react-router-dom";
import HelpChecklists from "./help/HelpChecklists.jsx";
import HelpReferences from "./help/HelpReferences.jsx";
import HelpSupport from "./help/HelpSupport.jsx";
import "./Help.css";

const TABS = ["Checklists", "References", "Support"];

export default function Help() {
  // The tab lives in the URL (/help?tab=Support) so a page can link straight to it.
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : TABS[0];
  const setTab = (t) => setParams({ tab: t }, { replace: true });

  return (
    <div className="help">
      <div className="help-header">
        <span className="help-title">HELP &amp; REFERENCE</span>
        <div className="help-tabs">
          {TABS.map((t) => (
            <span
              key={t}
              className={`pill help-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="help-body">
        {tab === "Checklists" ? <HelpChecklists /> : tab === "References" ? <HelpReferences /> : <HelpSupport />}
      </div>
    </div>
  );
}
