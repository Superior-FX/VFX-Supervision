// New scene/shot records in the shape Post Reports stores — shared by
// Post Reports (+ Add Scene / + Add Shot) and the New Project spreadsheet
// importer so both create identical records.

export function blankScene(scene) {
  return {
    id: crypto.randomUUID(),
    scene,
    folderCreatedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function blankShot(sceneId, sceneNumber) {
  return {
    id: crypto.randomUUID(),
    sceneId,
    // Denormalized copy of the parent scene's number — kept in sync at
    // creation time so Shot Board / Shot Detail (which read shot.scene
    // directly and aren't part of this pass) keep working unchanged.
    scene: sceneNumber,
    shotCode: "",
    pipeline: "traditional",
    scriptDescription: "",
    internalDescription: "",
    thumbnail: null,
    tasks: [],
    dispatched: false,
    boardStatus: "bidding",
    complexity: 1,
    storyImportance: 1,
    dueDate: "",
    foldersCreatedAt: null,
    // The shotCode that was actually on disk the last time folders were
    // created — compared against the live shotCode so the UI can tell when
    // they've drifted apart instead of silently pointing at a stale folder.
    foldersCreatedForCode: null,
    // Filled by the spreadsheet importer (lib/shotImport.js); editable in
    // Post Reports. bidCost is only shown to view_costs roles.
    timecodeIn: "",
    timecodeOut: "",
    bidCost: null,
    submittedAt: new Date().toISOString(),
  };
}
