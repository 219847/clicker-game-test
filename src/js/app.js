import { PuzzleStore } from "./puzzleStore.js";
import { buildImportPreview, importFromPreview } from "./puzzleImporter.js";

const puzzleStore = new PuzzleStore();
let selectedJsonText = null;
let latestPreview = null;

const uploadInput = document.getElementById("puzzle-json-file");
const previewButton = document.getElementById("preview-import");
const importButton = document.getElementById("confirm-import");
const duplicateStrategySelect = document.getElementById("duplicate-strategy");
const progressBar = document.getElementById("import-progress");
const progressLabel = document.getElementById("import-progress-label");
const summaryElement = document.getElementById("import-summary");
const detailsElement = document.getElementById("import-details");
const storedCountElement = document.getElementById("stored-count");

function setSummary(message, isError = false) {
  summaryElement.textContent = message;
  summaryElement.classList.toggle("error", isError);
}

function renderPreview(preview) {
  detailsElement.innerHTML = "";

  const stats = [
    `Total puzzles in file: ${preview.totalCount}`,
    `Valid puzzles: ${preview.validCount}`,
    `Invalid puzzles: ${preview.invalidCount}`,
    `Duplicate puzzles: ${preview.duplicateCount}`,
  ];

  const statList = document.createElement("ul");
  stats.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    statList.appendChild(li);
  });
  detailsElement.appendChild(statList);

  if (preview.invalidRecords.length > 0) {
    const heading = document.createElement("h4");
    heading.textContent = "Invalid records";
    detailsElement.appendChild(heading);

    const invalidList = document.createElement("ul");
    preview.invalidRecords.slice(0, 20).forEach((invalidRecord) => {
      const li = document.createElement("li");
      li.textContent = `Puzzle ${invalidRecord.key}: ${invalidRecord.errors.join("; ")}`;
      invalidList.appendChild(li);
    });
    detailsElement.appendChild(invalidList);
  }

  importButton.disabled = preview.validCount === 0;
}

async function updateStoredCount() {
  const count = await puzzleStore.countAll();
  storedCountElement.textContent = String(count);
}

async function readSelectedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
    reader.readAsText(file);
  });
}

uploadInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  selectedJsonText = null;
  latestPreview = null;
  importButton.disabled = true;
  detailsElement.innerHTML = "";

  if (!file) {
    setSummary("No file selected", true);
    return;
  }

  try {
    selectedJsonText = await readSelectedFile(file);
    setSummary(`Loaded ${file.name}. Click \"Preview Import\" to validate.`);
  } catch (error) {
    setSummary(`Failed to read file: ${error.message}`, true);
  }
});

previewButton.addEventListener("click", async () => {
  if (!selectedJsonText) {
    setSummary("Please upload a JSON file first.", true);
    return;
  }

  try {
    latestPreview = await buildImportPreview(selectedJsonText, puzzleStore);
    renderPreview(latestPreview);
    setSummary("Preview complete. Review results and confirm import.");
  } catch (error) {
    setSummary(`Preview failed: ${error.message}`, true);
  }
});

importButton.addEventListener("click", async () => {
  if (!latestPreview) {
    setSummary("Run preview before importing.", true);
    return;
  }

  const strategy = duplicateStrategySelect.value;
  const warning =
    latestPreview.duplicateCount > 0 && strategy === "replace"
      ? `This will replace ${latestPreview.duplicateCount} existing puzzles. Continue?`
      : "Start import?";

  if (!window.confirm(warning)) {
    return;
  }

  progressBar.value = 0;
  progressBar.max = latestPreview.validCount || 1;
  progressLabel.textContent = "0%";

  try {
    const result = await importFromPreview(latestPreview, puzzleStore, {
      duplicateStrategy: strategy,
      onProgress: ({ processed, total }) => {
        progressBar.max = total || 1;
        progressBar.value = processed;
        const percent = total === 0 ? 100 : Math.round((processed / total) * 100);
        progressLabel.textContent = `${percent}%`;
      },
    });

    await updateStoredCount();

    setSummary(
      `Import complete: imported ${result.importedCount}, replaced ${result.replacedCount}, skipped duplicates ${result.skippedDuplicates}, invalid ${result.invalidCount}.`
    );
  } catch (error) {
    setSummary(`Import failed: ${error.message}`, true);
  }
});

await puzzleStore.open();
await updateStoredCount();

window.puzzleDb = {
  byId: (id) => puzzleStore.getPuzzleById(id),
  byRatingRange: (min, max, options) => puzzleStore.queryByRatingRange(min, max, options),
  byColor: (color, options) => puzzleStore.queryByColor(color, options),
  random: () => puzzleStore.getRandomPuzzle(),
};
