import { useMemo, useState } from "react";
import { BudgetControl, ComplexityDots, EffectPicker } from "../components/SceneVfxFields.jsx";
import { upsertById, useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./ScriptBreakdown.css";

const INITIAL_SCENES = [
  {
    id: "sc-012",
    number: 12,
    page: 8,
    heading: "INT. OBSERVATION DECK — NIGHT",
    flagged: true,
    script: [
      {
        type: "action",
        text:
          "The deck's viewport fills with light as the alien mothership breaks through the storm clouds, its hull rippling with bioluminescent veins.",
      },
      { type: "character", text: "KESSLER" },
      { type: "dialogue", text: "That's not one of ours." },
      { type: "action", text: "No one moves. The ship keeps coming." },
      { type: "transition", text: "CUT TO:" },
    ],
    primaryEffect: "Full digital environment build",
    additionalEffects: ["Sky replacement", "Weather/atmospherics", "Particle FX"],
    complexity: 5,
    budgeted: true,
    budgetLow: 180000,
    budgetHigh: 260000,
    aiLow: 165000,
    aiHigh: 240000,
  },
  {
    id: "sc-014",
    number: 14,
    page: 10,
    heading: "EXT. ROOFTOP — CONTINUOUS",
    flagged: false,
    script: [
      {
        type: "action",
        text:
          "REYES sprints, leaps the gap between buildings — hangs in the air a beat too long — lands hard, rolls upright without breaking stride.",
      },
      { type: "character", text: "REYES" },
      { type: "parenthetical", text: "(into comms, breathless)" },
      { type: "dialogue", text: "I'm across. Keep moving." },
    ],
    primaryEffect: "Invisible wire/rig removal",
    additionalEffects: ["Continuity fix"],
    complexity: 3,
    budgeted: true,
    budgetLow: 8000,
    budgetHigh: 14000,
    aiLow: 7500,
    aiHigh: 12000,
  },
  {
    id: "sc-018",
    number: 18,
    page: 15,
    heading: "INT. SERVER ROOM — NIGHT",
    flagged: false,
    script: [
      {
        type: "action",
        text:
          "Sparks erupt from a ruptured coolant line. Flame catches along exposed cabling, fast — the room fills with smoke inside seconds.",
      },
      { type: "character", text: "OKAFOR" },
      { type: "dialogue", text: "Get out, get out now!" },
      { type: "transition", text: "DISSOLVE TO:" },
    ],
    primaryEffect: "Fire/smoke/explosion simulation",
    additionalEffects: ["Particle FX", "Practical FX enhancement"],
    complexity: 4,
    budgeted: true,
    budgetLow: 45000,
    budgetHigh: 70000,
    aiLow: 50000,
    aiHigh: 68000,
  },
  {
    id: "sc-006",
    number: 6,
    page: 4,
    heading: "INT. NIGHTFALL COMMAND — CONTINUOUS",
    flagged: false,
    script: [
      {
        type: "action",
        text: "The ops floor goes quiet. Every screen shows the same feed from the observation deck.",
      },
      { type: "character", text: "VASQUEZ" },
      { type: "dialogue", text: "Confirm that reading. Say it again." },
    ],
    primaryEffect: null,
    additionalEffects: [],
    complexity: 1,
    budgeted: false,
    budgetLow: 0,
    budgetHigh: 0,
    aiLow: 0,
    aiHigh: 0,
  },
  {
    id: "sc-009",
    number: 9,
    page: 6,
    heading: "EXT. LAUNCH PAD — DAY",
    flagged: false,
    script: [
      { type: "action", text: "REYES jogs up the gantry, duffel over one shoulder. Ground crew wave her through." },
      { type: "character", text: "REYES" },
      { type: "dialogue", text: "Tell me the weather window's still open." },
    ],
    primaryEffect: null,
    additionalEffects: [],
    complexity: 1,
    budgeted: false,
    budgetLow: 0,
    budgetHigh: 0,
    aiLow: 0,
    aiHigh: 0,
  },
];

function ScreenplayLine({ block }) {
  switch (block.type) {
    case "character":
      return <div className="sp-character">{block.text}</div>;
    case "dialogue":
      return <div className="sp-dialogue">{block.text}</div>;
    case "parenthetical":
      return <div className="sp-parenthetical">{block.text}</div>;
    case "transition":
      return <div className="sp-transition">{block.text}</div>;
    default:
      return <div className="sp-action">{block.text}</div>;
  }
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 16V4M12 4l-5 5M12 4l5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 3v18M5 4h11l-2.5 3.5L16 11H5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function SceneCard({ scene, onChange }) {
  const update = (patch) => onChange({ ...scene, ...patch });

  return (
    <div className="card scene-card">
      <div className="scene-card-header">
        <span className="scene-number">SC {scene.number}</span>
        <span className="scene-heading">{scene.heading}</span>
        <span className="scene-page">pg. {scene.page}</span>
        <div className="scene-header-right">
          <ComplexityDots value={scene.complexity} onChange={(v) => update({ complexity: v })} />
          <span
            className={`scene-flag${scene.flagged ? " active" : ""}`}
            onClick={() => update({ flagged: !scene.flagged })}
            title="Flag for supervisor review"
          >
            <FlagIcon />
          </span>
        </div>
      </div>

      <EffectPicker scene={scene} onChange={update} />

      <div className="screenplay">
        {scene.script.map((block, i) => (
          <ScreenplayLine block={block} key={i} />
        ))}
      </div>

      <BudgetControl scene={scene} onChange={update} />
    </div>
  );
}

export default function ScriptBreakdown() {
  const [scenes, setScenes] = useState(INITIAL_SCENES);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmation, setConfirmation] = useState(null);

  const [, setScriptReports] = useLocalStorageState("vfx-supe-script-reports", []);

  const updateScene = (updated) => {
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const submitBreakdown = () => {
    const vfxScenes = scenes.filter((s) => s.primaryEffect);
    setScriptReports((prev) => {
      let next = prev;
      for (const scene of vfxScenes) {
        next = upsertById(next, { ...scene, submittedAt: new Date().toISOString() });
      }
      return next;
    });
    setConfirmation(`${vfxScenes.length} VFX scene${vfxScenes.length === 1 ? "" : "s"} submitted to Script Reports`);
    setTimeout(() => setConfirmation(null), 3000);
  };

  const vfxCount = scenes.filter((s) => s.primaryEffect).length;

  const visibleScenes = useMemo(() => {
    let list = scenes;
    if (filter === "vfx") list = list.filter((s) => s.primaryEffect);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const haystack = [
          s.heading,
          s.primaryEffect,
          ...s.additionalEffects,
          ...s.script.map((b) => b.text),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [scenes, filter, query]);

  const totals = useMemo(() => {
    const budgeted = scenes.filter((s) => s.budgeted);
    const low = budgeted.reduce((sum, s) => sum + s.budgetLow, 0);
    const high = budgeted.reduce((sum, s) => sum + s.budgetHigh, 0);
    return { low, high };
  }, [scenes]);

  return (
    <div className="breakdown">
      <div className="breakdown-header">
        <div className="breakdown-title-group">
          <span className="breakdown-title">SCRIPT BREAKDOWN</span>
          <span className="pill">Project Nightfall — S2</span>
        </div>
        <div className="breakdown-header-actions">
          <span className="btn btn-secondary">Export PDF</span>
          <span className="btn btn-primary" onClick={submitBreakdown}>
            Submit Breakdown
          </span>
        </div>
      </div>
      {confirmation && <div className="breakdown-confirmation">{confirmation}</div>}

      <div className="dropzone-compact">
        <div className="dropzone-compact-icon">
          <UploadIcon />
        </div>
        <div>
          <div className="dropzone-compact-text">Drop a script PDF here to parse new scenes</div>
          <div className="dropzone-compact-hint">AI parsing connects here once the data layer is wired up</div>
        </div>
      </div>

      <div className="breakdown-summary">
        <div className="card stat-card">
          <span className="label">Total scenes</span>
          <span className="stat-value">{scenes.length}</span>
        </div>
        <div className="card stat-card">
          <span className="label">VFX scenes</span>
          <span className="stat-value">{vfxCount}</span>
        </div>
        <div className="card stat-card">
          <span className="label">Est. budget range</span>
          <span className="stat-value" style={{ fontSize: 18 }}>
            ${(totals.low / 1000).toFixed(0)}K–${(totals.high / 1000).toFixed(0)}K
          </span>
        </div>
      </div>

      <div className="breakdown-controls">
        <div className="breakdown-search">
          <span className="breakdown-search-icon">
            <SearchIcon />
          </span>
          <input
            placeholder="Search scenes, descriptions, VFX notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="breakdown-filters">
          <span
            className={`pill breakdown-filter${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({scenes.length})
          </span>
          <span
            className={`pill breakdown-filter${filter === "vfx" ? " active" : ""}`}
            onClick={() => setFilter("vfx")}
          >
            🚩 VFX ({vfxCount})
          </span>
        </div>
      </div>

      <div className="scene-list">
        {visibleScenes.length === 0 && <div className="card scene-empty">No scenes match.</div>}
        {visibleScenes.map((scene) => (
          <SceneCard scene={scene} onChange={updateScene} key={scene.id} />
        ))}
      </div>
    </div>
  );
}
