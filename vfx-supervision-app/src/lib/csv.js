// Minimal RFC 4180-style CSV writer — no library, just enough to produce a
// file Google Sheets (or Excel) opens cleanly: CRLF row endings, values
// quoted only when they need it, and a UTF-8 BOM so accented/special
// characters (em dashes, arrows used elsewhere in the app) don't get
// mis-decoded when Sheets sniffs the file's encoding.
function csvCell(value) {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows) {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return `﻿${body}`;
}

export function downloadCsv(filename, rows) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
