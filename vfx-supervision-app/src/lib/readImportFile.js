// Browser-side half of the shot importer: File → sheets of raw rows.
// Kept apart from shotImport.js because the pdf.js worker URL is a Vite
// import, which plain node (used to test the parser on real files) can't
// resolve. Everything is read locally — nothing is uploaded.
import { pdfItemsToSheet, readCsv, readXlsx } from "./shotImport.js";

export const IMPORT_ACCEPT = ".xlsx,.csv,.pdf,.xls";

export async function readImportFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "xlsx") return readXlsx(await file.arrayBuffer());
  if (ext === "csv") return readCsv(await file.text());
  if (ext === "pdf") return readPdf(await file.arrayBuffer());
  if (ext === "xls") {
    throw new Error("Old .xls files can't be read — open it in Excel and Save As .xlsx (or export a CSV), then import that.");
  }
  throw new Error("Pick an .xlsx, .csv or .pdf file.");
}

async function readPdf(buffer) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    pages.push({
      items: content.items.map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        height: it.height,
      })),
    });
  }
  const sheets = pdfItemsToSheet(pages);
  if (!sheets.length) {
    throw new Error(
      "Couldn't find a shot table in this PDF. Scanned PDFs have no text to read — import the original spreadsheet instead."
    );
  }
  return sheets;
}
