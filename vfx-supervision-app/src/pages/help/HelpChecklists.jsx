import { useEffect, useState } from "react";
import preProduction from "../../../checklists/pre_production.json";
import production from "../../../checklists/production.json";
import postProduction from "../../../checklists/post_production.json";
import "./HelpChecklists.css";

const CHECKLISTS = [
  { label: "Pre-Production", data: preProduction },
  { label: "Production", data: production },
  { label: "Post-Production", data: postProduction },
];

const STORAGE_KEY = "vfx-supe-checklist-state";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function HelpChecklists() {
  const [tab, setTab] = useState(CHECKLISTS[0].label);
  const [state, setState] = useState(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const toggle = (id) => {
    setState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const active = CHECKLISTS.find((c) => c.label === tab);
  const allItems = active.data.sections.flatMap((s) => s.items);
  const doneCount = allItems.filter((item) => state[item.id]).length;

  return (
    <div className="checklists">
      <div className="checklist-tabs">
        {CHECKLISTS.map((c) => (
          <span
            key={c.label}
            className={`pill checklist-tab${tab === c.label ? " active" : ""}`}
            onClick={() => setTab(c.label)}
          >
            {c.label}
          </span>
        ))}
        <span className="checklist-progress">
          {doneCount} / {allItems.length} complete
        </span>
      </div>

      <div className="checklist-scroll">
        <div className="checklist-sections">
          {active.data.sections.map((section) => (
            <div className="card checklist-section" key={section.title}>
              <div className="checklist-section-title">{section.title}</div>
              <div className="checklist-section-items">
                {section.items.map((item) => {
                  const checked = Boolean(state[item.id]);
                  return (
                    <div className="checklist-row" key={item.id} onClick={() => toggle(item.id)}>
                      <div className={`checklist-row-box${checked ? " checked" : ""}`}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M4 12l5 5L20 6"
                              stroke="#0e0f13"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <span className={`checklist-row-label${checked ? " checked" : ""}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
