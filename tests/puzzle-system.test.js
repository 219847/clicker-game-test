import test from "node:test";
import assert from "node:assert/strict";

import { decodeTCNToUci } from "../src/js/tcn.js";
import { buildImportPreview, importFromPreview, parsePuzzleImportJson } from "../src/js/puzzleImporter.js";
import { preparePuzzleSession, validatePuzzleRecord } from "../src/js/puzzleValidator.js";

const SAMPLE_PUZZLE = {
  id: 1322993,
  fen3: "2r3k1/p4ppp/3p4/8/1P1qpP2/P6P/3B2P1/3Q1RK1 w -",
  initialFen: "2r3k1/p4ppp/3p4/8/1P1qpP2/P6P/3B2P1/3Q1RK1 w - - 1 23",
  tcnMoveList: "fnCunm6cdculgpBDowDnmnl{",
  colorOfUser: "black",
  rating: 3554,
  passRate: 27.3,
  averageSeconds: 85,
  attemptCount: 1411,
  gameLiveId: 12572304173,
  gameId: null,
  pgn: "...",
};

const EXPECTED_UCI = [
  "f1f2",
  "e4e3",
  "f2e2",
  "c8c1",
  "d1c1",
  "e3d2",
  "g1h2",
  "d4f4",
  "g2g3",
  "f4f2",
  "e2f2",
  "d2c1q",
];

class MockStore {
  constructor(existing = []) {
    this.map = new Map(existing.map((p) => [p.id, p]));
  }

  async hasPuzzle(id) {
    return this.map.has(id);
  }

  async putPuzzle(puzzle) {
    this.map.set(puzzle.id, puzzle);
  }
}

test("decodeTCNToUci decodes sample move list", () => {
  assert.deepEqual(decodeTCNToUci(SAMPLE_PUZZLE.tcnMoveList), EXPECTED_UCI);
});

test("validatePuzzleRecord enforces alternating opponent-first move order", () => {
  const validation = validatePuzzleRecord(SAMPLE_PUZZLE);
  assert.equal(validation.valid, true);
  assert.equal(validation.moveSides[0], "white");
  assert.equal(validation.moveSides[1], "black");
  assert.deepEqual(validation.decodedUciMoves, EXPECTED_UCI);
});

test("preparePuzzleSession auto-plays opponent move and gives user turn", () => {
  const session = preparePuzzleSession(SAMPLE_PUZZLE);
  assert.equal(session.valid, true);
  assert.equal(session.autoPlayedMove, "f1f2");
  assert.equal(session.userToMove, true);
});

test("import JSON preview counts valid, invalid and duplicate records", async () => {
  const json = JSON.stringify({
    "1322993": SAMPLE_PUZZLE,
    "1322994": { ...SAMPLE_PUZZLE, id: 1322994, initialFen: "invalid-fen" },
    "1322995": { ...SAMPLE_PUZZLE, id: 1322995 },
  });

  const store = new MockStore([{ id: 1322995 }]);
  const preview = await buildImportPreview(json, store);

  assert.equal(preview.totalCount, 3);
  assert.equal(preview.validCount, 2);
  assert.equal(preview.invalidCount, 1);
  assert.equal(preview.duplicateCount, 1);

  const importResult = await importFromPreview(preview, store, { duplicateStrategy: "skip" });
  assert.equal(importResult.importedCount, 1);
  assert.equal(importResult.skippedDuplicates, 1);
});

test("malformed TCN and malformed records are rejected", () => {
  assert.throws(() => decodeTCNToUci("abc"), /Malformed TCN sequence/);

  const parsed = parsePuzzleImportJson(
    JSON.stringify({
      "x": {
        id: "not-a-number",
        tcnMoveList: SAMPLE_PUZZLE.tcnMoveList,
        colorOfUser: "black",
      },
    })
  );

  assert.equal(parsed.validRecords.length, 0);
  assert.equal(parsed.invalidRecords.length, 1);
  assert.match(parsed.invalidRecords[0].errors.join(" "), /id must be a positive integer/);
});
