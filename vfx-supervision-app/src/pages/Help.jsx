import { useState } from "react";
import HelpChecklists from "./help/HelpChecklists.jsx";
import HelpReferences from "./help/HelpReferences.jsx";
import "./Help.css";

const TABS = ["Checklists", "References"];

export default function Help() {
  const [tab, setTab] = useState(TABS[0]);

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
        {tab === "Checklists" ? <HelpChecklists /> : <HelpReferences />}
      </div>
    </div>
  );
}
