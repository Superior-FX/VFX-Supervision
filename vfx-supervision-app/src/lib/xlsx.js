// Real spreadsheet styling (cell fills, a branded header banner, an
// embedded logo) needs actual formatting data, which plain CSV can't carry
// at all — colors/branding baked in here show up immediately on open, in
// Google Sheets or Excel, with no manual per-file setup. Colors sourced from
// superior-fx.base44.app's own CSS bundle (Tailwind slate-950/blue-500/
// red-500/orange-500), so this matches the live site rather than guessing.
import ExcelJS from "exceljs";
import { BRAND } from "./brandColors.js";

function fill(hex) {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } };
}

// columns: [{ header, width }]
// rows: [[cell, cell, ...], ...] — same order/length as columns
// cellTier(rowData, colIndex) => "high" | "medium" | null — colors that cell
// logoBuffer: ArrayBuffer, optional — placed top-right of the title banner
export async function downloadStyledWorkbook({
  filename,
  sheetName = "Sheet1",
  title,
  subtitle,
  columns,
  rows,
  cellTier,
  legend,
  logoBuffer,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Superior-FX";
  const sheet = workbook.addWorksheet(sheetName);
  const colCount = columns.length;

  let r = 1;

  sheet.mergeCells(r, 1, r, colCount);
  const titleCell = sheet.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: `FF${BRAND.white}` } };
  titleCell.fill = fill(BRAND.navy);
  titleCell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(r).height = 34;
  r += 1;

  if (subtitle) {
    sheet.mergeCells(r, 1, r, colCount);
    const subCell = sheet.getCell(r, 1);
    subCell.value = subtitle;
    subCell.font = { name: "Arial", size: 10, italic: true, color: { argb: `FF${BRAND.white}` } };
    subCell.fill = fill(BRAND.navy);
    subCell.alignment = { vertical: "middle", indent: 1 };
    sheet.getRow(r).height = 18;
    r += 1;
  }

  const headerRow = r;
  columns.forEach((col, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: `FF${BRAND.white}` } };
    cell.fill = fill(BRAND.blue);
    cell.alignment = { vertical: "middle", wrapText: true };
    sheet.getColumn(i + 1).width = col.width ?? 16;
  });
  sheet.getRow(headerRow).height = 20;
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
  r += 1;

  for (const rowData of rows) {
    rowData.forEach((value, colIdx) => {
      const cell = sheet.getCell(r, colIdx + 1);
      cell.value = value;
      cell.alignment = { vertical: "top", wrapText: true };
      const tier = cellTier?.(rowData, colIdx);
      if (tier === "high") cell.fill = fill(BRAND.redSoft);
      else if (tier === "medium") cell.fill = fill(BRAND.orangeSoft);
    });
    r += 1;
  }

  if (legend?.length) {
    r += 1;
    for (const { color, text } of legend) {
      const swatch = sheet.getCell(r, 1);
      if (color) swatch.fill = fill(color);
      const label = sheet.getCell(r, 2);
      label.value = text;
      label.font = { size: 10, italic: true };
      r += 1;
    }
  }

  if (logoBuffer) {
    const imageId = workbook.addImage({ buffer: logoBuffer, extension: "jpeg" });
    sheet.addImage(imageId, {
      tl: { col: colCount - 1.05, row: 0.05 },
      ext: { width: 40, height: 40 },
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
