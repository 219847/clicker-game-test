import { validatePuzzleRecord } from "./puzzleValidator.js";

export function parsePuzzleImportJson(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Top-level JSON must be an object keyed by puzzle IDs");
  }

  const totalCount = Object.keys(parsed).length;
  const validRecords = [];
  const invalidRecords = [];

  for (const [rawKey, rawPuzzle] of Object.entries(parsed)) {
    const normalizedPuzzle = {
      ...rawPuzzle,
      id: rawPuzzle?.id ?? Number(rawKey),
    };

    const validation = validatePuzzleRecord(normalizedPuzzle, { strictIdKey: rawKey });

    if (validation.valid) {
      validRecords.push(validation.normalizedRecord);
    } else {
      invalidRecords.push({
        id: normalizedPuzzle.id,
        key: rawKey,
        errors: validation.errors,
      });
    }
  }

  return {
    totalCount,
    validRecords,
    invalidRecords,
  };
}

export async function buildImportPreview(jsonText, puzzleStore) {
  const parsed = parsePuzzleImportJson(jsonText);

  const duplicateIds = [];
  for (const puzzle of parsed.validRecords) {
    // eslint-disable-next-line no-await-in-loop
    if (await puzzleStore.hasPuzzle(puzzle.id)) {
      duplicateIds.push(puzzle.id);
    }
  }

  return {
    totalCount: parsed.totalCount,
    validCount: parsed.validRecords.length,
    invalidCount: parsed.invalidRecords.length,
    duplicateCount: duplicateIds.length,
    duplicateIds,
    validRecords: parsed.validRecords,
    invalidRecords: parsed.invalidRecords,
  };
}

export async function importFromPreview(preview, puzzleStore, { duplicateStrategy = "skip", onProgress } = {}) {
  if (!preview || !Array.isArray(preview.validRecords)) {
    throw new Error("Import preview is missing or invalid");
  }

  if (!["skip", "replace"].includes(duplicateStrategy)) {
    throw new Error("duplicateStrategy must be 'skip' or 'replace'");
  }

  const duplicateIdSet = new Set(preview.duplicateIds);

  let importedCount = 0;
  let skippedDuplicates = 0;
  let replacedCount = 0;

  for (let index = 0; index < preview.validRecords.length; index += 1) {
    const puzzle = preview.validRecords[index];
    const isDuplicate = duplicateIdSet.has(puzzle.id);

    if (isDuplicate && duplicateStrategy === "skip") {
      skippedDuplicates += 1;
    } else {
      // eslint-disable-next-line no-await-in-loop
      await puzzleStore.putPuzzle(puzzle);
      importedCount += 1;
      if (isDuplicate) {
        replacedCount += 1;
      }
    }

    if (typeof onProgress === "function") {
      onProgress({ processed: index + 1, total: preview.validRecords.length });
    }
  }

  return {
    totalCount: preview.totalCount,
    validCount: preview.validCount,
    invalidCount: preview.invalidCount,
    duplicateCount: preview.duplicateCount,
    importedCount,
    replacedCount,
    skippedDuplicates,
    invalidRecords: preview.invalidRecords,
  };
}
