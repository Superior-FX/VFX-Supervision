// Groups a flat list of files (e.g. everything picked from one folder)
// into image sequences by detecting a trailing frame-number token on each
// filename and stripping it — "SH010_comp_v001_0001.exr" groups under
// "SH010_comp_v001.exr" alongside every other frame with that same base
// name and extension. A file with no detected frame number becomes its
// own single-file group (kind "file" instead of "sequence").

// Splits "name.ext" into { baseName, ext } with any trailing run of 2+
// digits (optionally preceded by "_" or ".") removed from the base — the
// frame number. Returns null for a name with no extension or no trailing
// digit run, i.e. not something that looks like a sequence frame.
function splitFrameName(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = filename.slice(0, dot);
  const ext = filename.slice(dot);
  const match = base.match(/^(.*?)[._]?(\d{2,})$/);
  if (!match) return null;
  return { baseName: match[1] || "sequence", ext };
}

// files: File[] (or anything with a `.name`). Returns groups in the shape
// { name, files, kind }, kind "sequence" for 2+ frames sharing a base name
// + extension, "file" otherwise (including a single frame on its own —
// there's nothing to summarize as a count of 1).
export function groupSequenceFiles(files) {
  const order = [];
  const groups = new Map();

  for (const file of files) {
    const split = splitFrameName(file.name);
    const key = split ? `${split.baseName}${split.ext}` : `\0single:${file.name}`;
    if (!groups.has(key)) {
      groups.set(key, { name: split ? key : file.name, files: [] });
      order.push(key);
    }
    groups.get(key).files.push(file);
  }

  return order.map((key) => {
    const group = groups.get(key);
    return { name: group.name, files: group.files, kind: group.files.length > 1 ? "sequence" : "file" };
  });
}
