// Turns a client/production VFX list (.xlsx, .csv, or a text PDF exported
// from a spreadsheet) into scenes + shots for a new project. Only parsing
// lives here — no React, no storage — so the same code runs in the New
// Project import flow and in a plain node script against real files.
//
// Pipeline: file → sheets of raw rows → pick the header row → guess what
// each column is → one candidate shot per data row, with warnings the
// review screen shows next to the row.

import { padScene } from "./folderPath.js";

// What a column can be mapped to on the review screen. "notes" may be used
// by several columns — each lands in the shot's internal description with
// its header as a label.
export const IMPORT_FIELDS = [
  { value: "", label: "Ignore" },
  { value: "shotCode", label: "Shot code" },
  { value: "scene", label: "Scene" },
  { value: "description", label: "VFX description" },
  { value: "notes", label: "Internal notes" },
  { value: "tcRange", label: "Timecode in – out" },
  { value: "tcIn", label: "Timecode in" },
  { value: "tcOut", label: "Timecode out" },
  { value: "cost", label: "Bid cost" },
  { value: "dueDate", label: "Due date" },
];

const MULTI_FIELDS = new Set(["notes"]);

// Normalized header text → field. Exact matches first; the "contains"
// list is only consulted for fields still unclaimed afterwards, so e.g.
// "Final Delivery Date" wins Due date over "Vendor 1 Next Delivery".
const EXACT_ALIASES = {
  shotCode: ["shot code", "shot", "shot name", "shot id", "shot number", "shot no", "vfx name", "vfx id", "vfx shot", "vfx no", "vfx number", "vfx"],
  scene: ["scene", "sc", "scn", "scene number", "scene no"],
  description: ["vfx description", "description", "desc", "shot description", "vfx breakdown", "breakdown", "action", "vfx work", "work description"],
  notes: ["vfx elements", "elements", "notes", "note", "comments", "comment", "vfx notes", "work required"],
  tcRange: ["in out", "in to out", "timecode", "tc", "tc in out", "timecode in out", "record tc", "rec tc"],
  tcIn: ["tc in", "in", "timecode in", "rec in", "record in", "src in", "source in", "in point"],
  tcOut: ["tc out", "out", "timecode out", "rec out", "record out", "src out", "source out", "out point"],
  cost: ["cost", "vfx cost", "bid", "bid cost", "price", "budget", "amount", "total"],
  dueDate: ["due", "due date", "final delivery date", "delivery date", "final delivery", "deadline", "final due"],
};
const CONTAINS_ALIASES = {
  shotCode: ["shot code", "shot name"],
  description: ["description"],
  notes: ["notes"],
  cost: ["cost", "bid"],
  dueDate: ["due date", "final delivery"],
};

export function normalizeHeader(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function exactField(header) {
  const h = normalizeHeader(header);
  if (!h) return "";
  for (const [field, aliases] of Object.entries(EXACT_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return "";
}

export function guessMapping(headers) {
  const mapping = headers.map((h) => exactField(h));
  const claimed = new Set(mapping.filter(Boolean));
  for (const [field, aliases] of Object.entries(CONTAINS_ALIASES)) {
    if (claimed.has(field) && !MULTI_FIELDS.has(field)) continue;
    headers.forEach((h, i) => {
      if (mapping[i]) return;
      if (claimed.has(field) && !MULTI_FIELDS.has(field)) return;
      const norm = ` ${normalizeHeader(h)} `;
      if (aliases.some((a) => norm.includes(` ${a} `))) {
        mapping[i] = field;
        claimed.add(field);
      }
    });
  }
  // A single field mapped twice (two "Shot" columns, say) keeps only the
  // left-most — the user can re-map on the review screen.
  const seen = new Set();
  return mapping.map((f) => {
    if (!f || MULTI_FIELDS.has(f)) return f;
    if (seen.has(f)) return "";
    seen.add(f);
    return f;
  });
}

// ---- Cell values ----------------------------------------------------------

export function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

// ExcelJS cell value → string | number | Date | null.
function excelValue(v) {
  if (v == null) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v.richText) return v.richText.map((t) => t.text).join("");
  if ("result" in v) return excelValue(v.result);
  if (v.text != null) return excelValue(v.text);
  if (v.error) return null;
  return null;
}

// ---- Readers --------------------------------------------------------------

// → [{ name, rows: Array<Array<string|number|Date|null>> }]
export async function readXlsx(buffer) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = [];
  wb.eachSheet((ws) => {
    const rows = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = [];
      for (let c = 1; c <= ws.columnCount; c++) values.push(excelValue(row.getCell(c).value));
      rows[rowNumber - 1] = values;
    });
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets.push({ name: ws.name, rows });
  });
  return sheets;
}

export function readCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best
  );
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return [{ name: "CSV", rows }];
}

// PDF text has no table structure — just positioned words. Rebuild it:
// group items into lines by y, take column positions from the header line
// (the one that reads most like a VFX list header), then drop each data
// item into the nearest column. A line with nothing in the shot-code
// column is a wrapped continuation of the row above.
//
// pages: [{ items: [{ str, x, y, width, height }] }]  (y grows upward)
export function pdfItemsToSheet(pages) {
  let columns = null;
  let codeCol = 0;
  const rows = [];

  for (const page of pages) {
    const items = page.items.filter((it) => it.str.trim());
    if (!items.length) continue;
    const heights = items.map((it) => it.height || 0).sort((a, b) => a - b);
    const h = heights[Math.floor(heights.length / 2)] || 8;
    const lines = groupLines(items, Math.max(1, h * 0.5));

    // Header line = the line with the most recognized header words.
    let anchor = -1;
    let anchorScore = 1;
    lines.forEach((line, i) => {
      const score = line.items.filter((it) => exactField(it.str)).length;
      if (score > anchorScore) {
        anchorScore = score;
        anchor = i;
      }
    });

    let dataStart = 0;
    if (anchor !== -1) {
      const anchorY = lines[anchor].y;
      // Multi-line headers ("Vendor 1 Next / Delivery"): everything just
      // above the anchor, plus lines just below it that hold no data-ish
      // numbers, belong to the header.
      const band = lines.filter(
        (l, i) =>
          (i <= anchor && l.y - anchorY <= h * 2.5) ||
          (i > anchor && anchorY - l.y <= h * 2.5 && !l.items.some((it) => /\d{2,}/.test(it.str)))
      );
      dataStart = lines.indexOf(band[band.length - 1]) + 1;
      if (!columns) {
        columns = buildColumns(band.flatMap((l) => l.items), h);
        const guessed = guessMapping(columns.map((c) => c.label));
        codeCol = Math.max(0, guessed.indexOf("shotCode"));
      }
    }
    if (!columns) continue;

    for (const line of lines.slice(dataStart)) {
      const cells = columns.map(() => "");
      // Wrapped cell text hangs below its own row, so a fragment sitting
      // noticeably ABOVE this row's shot code belongs to the row before.
      // (Fragments slightly below — vertically centered dates — are ours.)
      const codeItem = line.items.find((it) => nearestColumn(columns, it) === codeCol);
      const spill = columns.map(() => "");
      for (const it of [...line.items].sort((a, b) => a.x - b.x)) {
        const c = nearestColumn(columns, it);
        const target = codeItem && it.y - codeItem.y > h * 0.3 ? spill : cells;
        target[c] = target[c] ? `${target[c]} ${it.str.trim()}` : it.str.trim();
      }
      if (rows.length && spill.some(Boolean)) {
        const prev = rows[rows.length - 1];
        spill.forEach((text, c) => {
          if (text) prev[c] = prev[c] ? `${prev[c]} ${text}` : text;
        });
      }
      if (cells[codeCol]) rows.push(cells);
      else if (rows.length) {
        const prev = rows[rows.length - 1];
        cells.forEach((text, c) => {
          if (text) prev[c] = prev[c] ? `${prev[c]} ${text}` : text;
        });
      }
    }
  }

  if (!columns) return [];
  return [{ name: "PDF", rows: [columns.map((c) => c.label), ...rows] }];
}

function groupLines(items, tol) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines = [];
  for (const it of sorted) {
    const line = lines[lines.length - 1];
    if (line && line.y - it.y <= tol) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines;
}

// Header items that overlap horizontally are one column with a stacked
// label ("Final" over "Delivery" over "Date").
function buildColumns(items, h) {
  const pad = h * 0.3;
  const spans = items
    .map((it) => ({ x0: it.x, x1: it.x + it.width, y: it.y, str: it.str.trim() }))
    .sort((a, b) => a.x0 - b.x0);
  const cols = [];
  for (const s of spans) {
    const col = cols.find((c) => s.x0 < c.x1 + pad && s.x1 > c.x0 - pad);
    if (col) {
      col.x0 = Math.min(col.x0, s.x0);
      col.x1 = Math.max(col.x1, s.x1);
      col.parts.push(s);
    } else cols.push({ x0: s.x0, x1: s.x1, parts: [s] });
  }
  return cols
    .sort((a, b) => a.x0 - b.x0)
    .map((c) => ({
      x0: c.x0,
      x1: c.x1,
      center: (c.x0 + c.x1) / 2,
      label: c.parts
        .sort((a, b) => b.y - a.y || a.x0 - b.x0)
        .map((p) => p.str)
        .join(" ")
        .replace(/(\w) (ng|m)\b/g, "$1$2"),
    }));
}

function nearestColumn(columns, it) {
  const center = it.x + it.width / 2;
  let best = 0;
  let bestDist = Infinity;
  columns.forEach((c, i) => {
    const dist = center >= c.x0 && center <= c.x1 ? 0 : Math.abs(center - c.center);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

// ---- Header row -----------------------------------------------------------

export function headerScore(row) {
  return (row ?? []).filter((v) => exactField(cellText(v))).length;
}

export function findHeaderRow(rows) {
  let best = 0;
  let bestScore = 0;
  rows.slice(0, 30).forEach((row, i) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export function pickSheet(sheets) {
  let best = 0;
  let bestScore = -1;
  sheets.forEach((s, i) => {
    const score = headerScore(s.rows[findHeaderRow(s.rows)]);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

// ---- Field parsers --------------------------------------------------------

// "01;02;29;11", "01'08'15'05", "1:2:3:4" → "01:02:29:11". Anything that
// still isn't four sane fields comes back as-is with valid: false.
export function normalizeTimecode(raw) {
  const text = cellText(raw);
  if (!text) return { value: "", valid: true };
  const cleaned = text.replace(/[;'.,]/g, ":").replace(/\s+/g, "");
  const m = cleaned.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (!m || +m[2] > 59 || +m[3] > 59 || +m[4] > 59) return { value: text, valid: false };
  return { value: m.slice(1).map((p) => p.padStart(2, "0")).join(":"), valid: true };
}

export function splitTimecodeRange(raw) {
  const text = cellText(raw);
  if (!text) return ["", ""];
  const parts = text.split(/\s*[-–—]\s*|\s+to\s+/i).filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? ""];
}

export function parseCost(raw) {
  if (raw == null || raw === "") return { value: null, valid: true };
  if (typeof raw === "number") return { value: raw, valid: true };
  const text = cellText(raw);
  if (!text) return { value: null, valid: true };
  const n = Number(text.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? { value: n, valid: true } : { value: null, valid: false };
}

// → "YYYY-MM-DD" (what <input type="date"> and shot.dueDate use).
export function parseDate(raw) {
  if (raw == null || raw === "") return { value: "", valid: true };
  if (raw instanceof Date) return { value: raw.toISOString().slice(0, 10), valid: true };
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
    return { value: d.toISOString().slice(0, 10), valid: true };
  }
  const text = cellText(raw);
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { value: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`, valid: true };
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return { value: `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`, valid: true };
  }
  return { value: "", valid: false };
}

// "SSC_08_010" → "08", "GOTP_SC009_D" → "009". Codes with no scene in
// them ("VFX-001") → "".
export function sceneFromCode(code) {
  const parts = code.includes("_") ? code.split("_") : code.split("-");
  const sc = parts.find((p) => /^sc\d+[a-z]?$/i.test(p));
  if (sc) return sc.slice(2);
  if (parts.length >= 3 && /^\d+[a-z]?(-\d+)?$/i.test(parts[1])) return parts[1];
  return "";
}

// Codes whose number is padded differently from most codes sharing their
// prefix ("VFX-13" among "VFX-0xx") → { [code]: suggestedCode }.
export function codeFixes(codes) {
  const groups = new Map();
  for (const code of codes) {
    const m = code.match(/^(.*?)(\d+)((?:\.\d+)?)$/);
    if (!m) continue;
    const [, prefix, digits, suffix] = m;
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push({ code, digits, suffix });
  }
  const fixes = {};
  for (const [prefix, list] of groups) {
    if (list.length < 3) continue;
    const widths = new Map();
    for (const { digits } of list) widths.set(digits.length, (widths.get(digits.length) ?? 0) + 1);
    const [width] = [...widths].sort((a, b) => b[1] - a[1])[0];
    for (const { code, digits, suffix } of list) {
      if (digits.length < width) fixes[code] = `${prefix}${digits.padStart(width, "0")}${suffix}`;
    }
  }
  return fixes;
}

// ---- Rows → candidate shots ------------------------------------------------

// One entry per data row that has a code or a description. Values are
// already cleaned; `issues` are re-derived by checkRows on every edit.
export function buildRows(rows, headerIndex, mapping) {
  const headers = (rows[headerIndex] ?? []).map(cellText);
  const col = (field) => mapping.indexOf(field);
  const get = (row, field) => (col(field) === -1 ? null : row[col(field)]);
  const out = [];

  rows.slice(headerIndex + 1).forEach((row, i) => {
    if (!row || !row.some((v) => cellText(v))) return;
    const shotCode = cellText(get(row, "shotCode"));
    const description = cellText(get(row, "description"));
    if (!shotCode && !description) return;
    // A header row repeated mid-sheet (PDF page breaks, pasted lists).
    if (headerScore(row) >= 2) return;

    let tcInRaw = get(row, "tcIn");
    let tcOutRaw = get(row, "tcOut");
    if (col("tcRange") !== -1) [tcInRaw, tcOutRaw] = splitTimecodeRange(get(row, "tcRange"));
    const tcIn = normalizeTimecode(tcInRaw);
    const tcOut = normalizeTimecode(tcOutRaw);
    const cost = parseCost(get(row, "cost"));
    const due = parseDate(get(row, "dueDate"));

    const notes = mapping
      .map((f, c) => (f === "notes" && cellText(row[c]) ? `${headers[c] || "Notes"}: ${cellText(row[c])}` : ""))
      .filter(Boolean)
      .join("\n");

    const sceneCell = cellText(get(row, "scene"));
    // A code with nothing else is usually a pre-numbered placeholder row
    // at the bottom of the list — start it excluded.
    const placeholder = !(description || notes || tcIn.value || tcOut.value || cost.value != null || due.value);
    out.push({
      key: `r${headerIndex + 1 + i}`,
      sourceRow: headerIndex + 2 + i,
      include: !placeholder,
      placeholder,
      shotCode,
      generatedCode: false,
      scene: sceneCell || sceneFromCode(shotCode),
      description,
      notes,
      tcIn: tcIn.value,
      tcOut: tcOut.value,
      cost: cost.value,
      dueDate: due.value,
      parseIssues: [
        !cost.valid && `Cost "${cellText(get(row, "cost"))}" isn't a number`,
        !due.valid && `Date "${cellText(get(row, "dueDate"))}" wasn't recognized`,
      ].filter(Boolean),
    });
  });

  return out;
}

// Fills blank codes with SHOW_NNN so every shot has a folder-able name.
export function fillMissingCodes(list, showCode) {
  const taken = new Set(list.map((r) => r.shotCode).filter(Boolean));
  let n = 0;
  return list.map((r) => {
    if (r.shotCode) return r;
    let code;
    do code = `${showCode || "SHOT"}_${String(++n).padStart(3, "0")}`;
    while (taken.has(code));
    taken.add(code);
    return { ...r, shotCode: code, generatedCode: true };
  });
}

// Per-row problems for the review screen. "blocking" ones must be fixed
// (or the row excluded) before importing.
export function checkRows(list) {
  const included = list.filter((r) => r.include);
  const counts = new Map();
  for (const r of included) counts.set(r.shotCode.trim(), (counts.get(r.shotCode.trim()) ?? 0) + 1);
  const fixes = codeFixes(included.map((r) => r.shotCode.trim()));

  const result = {};
  for (const r of list) {
    const issues = [...r.parseIssues];
    let blocking = false;
    const code = r.shotCode.trim();
    if (r.include) {
      if (!code) {
        issues.push("Needs a shot code");
        blocking = true;
      } else if (counts.get(code) > 1) {
        issues.push("Duplicate shot code");
        blocking = true;
      } else if (/[\\/:*?"<>|]/.test(code)) {
        issues.push('Shot code can\'t contain \\ / : * ? " < > |');
        blocking = true;
      }
    }
    if (fixes[code]) issues.push(`Doesn't match the others — ${fixes[code]}?`);
    if (r.tcIn && !normalizeTimecode(r.tcIn).valid) issues.push(`Timecode in "${r.tcIn}" isn't valid`);
    if (r.tcOut && !normalizeTimecode(r.tcOut).valid) issues.push(`Timecode out "${r.tcOut}" isn't valid`);
    if (r.tcIn && r.tcOut && normalizeTimecode(r.tcIn).valid && normalizeTimecode(r.tcOut).valid && r.tcOut < r.tcIn) {
      issues.push("Timecode out is before in");
    }
    if (r.generatedCode) issues.push("No code in the sheet — generated");
    if (r.placeholder) issues.push("Only a shot code in the sheet — excluded by default");
    result[r.key] = { issues, blocking, fix: fixes[code] ?? null };
  }
  return result;
}

// Included rows → { scenes, shots } in the shapes Post Reports stores
// (see lib/shotRecords.js). Rows with no
// scene go to SC000.
export function toRecords(list, makeShot, makeScene) {
  const scenes = new Map();
  const shots = [];
  for (const r of list) {
    if (!r.include) continue;
    const sceneNumber = padScene(r.scene) || "000";
    if (!scenes.has(sceneNumber)) scenes.set(sceneNumber, makeScene(sceneNumber));
    const scene = scenes.get(sceneNumber);
    shots.push({
      ...makeShot(scene.id, sceneNumber),
      shotCode: r.shotCode.trim(),
      scriptDescription: r.description,
      internalDescription: r.notes,
      dueDate: r.dueDate,
      timecodeIn: r.tcIn,
      timecodeOut: r.tcOut,
      bidCost: r.cost,
    });
  }
  return { scenes: [...scenes.values()], shots };
}
