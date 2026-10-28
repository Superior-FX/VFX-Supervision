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

// Thumbnails in an image column are fitted inside this box (px), and every
// data row is made tall enough to hold one.
const THUMB_BOX = { width: 112, height: 63 };

function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// "data:image/png;base64,..." -> "png"; null for anything exceljs can't embed.
function imageExtension(dataUrl) {
  const match = /^data:image\/(png|jpe?g|gif);base64,/i.exec(dataUrl ?? "");
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === "jpg" ? "jpeg" : ext;
}

// columns: [{ header, width, image? }] — an `image` column's cells are data:
//   URLs (or null), embedded as pictures sitting in the cell
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
  const hasImages = columns.some((col) => col.image);
  const merge = (row) => {
    if (colCount > 1) sheet.mergeCells(row, 1, row, colCount);
  };

  let r = 1;

  merge(r);
  const titleCell = sheet.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: `FF${BRAND.white}` } };
  titleCell.fill = fill(BRAND.navy);
  titleCell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(r).height = 34;
  r += 1;

  if (subtitle) {
    merge(r);
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
    // Row height is in points (0.75 per px); 9px of padding around the picture.
    if (hasImages) sheet.getRow(r).height = Math.round((THUMB_BOX.height + 9) * 0.75);
    for (const [colIdx, value] of rowData.entries()) {
      const cell = sheet.getCell(r, colIdx + 1);
      if (columns[colIdx].image) {
        const extension = imageExtension(value);
        const size = extension && (await imageSize(value));
        if (size) {
          const scale = Math.min(THUMB_BOX.width / size.width, THUMB_BOX.height / size.height);
          const imageId = workbook.addImage({ base64: value, extension });
          sheet.addImage(imageId, {
            tl: { col: colIdx + 0.05, row: r - 1 + 0.08 },
            ext: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
            editAs: "oneCell",
          });
        }
        continue;
      }
      cell.value = value;
      cell.alignment = { vertical: "top", wrapText: true };
      const tier = cellTier?.(rowData, colIdx);
      if (tier === "high") cell.fill = fill(BRAND.redSoft);
      else if (tier === "medium") cell.fill = fill(BRAND.orangeSoft);
    }
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
      tl: { col: Math.max(0, colCount - 1.05), row: 0.05 },
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
