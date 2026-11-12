import test from "node:test";
import assert from "node:assert/strict";
import { calculateRatingChange, readRating } from "../src/rating.js";
import { validatePuzzle } from "../src/puzzle.js";

const puzzle = { initialFen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", colorOfUser: "white", rating: 1200, tcn: ["e2e4", "e8e7"] };

test("validates and decodes a playable move sequence", () => {
  const result = validatePuzzle(puzzle);
  assert.deepEqual(result.moves, ["e2e4", "e8e7"]);
});

test("rejects illegal imported moves", () => {
  assert.throws(() => validatePuzzle({ ...puzzle, tcn: ["e2e5"] }), /Illegal puzzle move/);
});

test("rating cookie defaults and clamps", () => {
  assert.equal(readRating("other=1"), 1200);
  assert.equal(readRating("puzzle_rating=50"), 100);
  assert.equal(readRating("puzzle_rating=2147483648"), 2147483647);
});

test("elo changes are positive for solved and negative for failed attempts", () => {
  assert.ok(calculateRatingChange(1200, 1200, true) > 0);
  assert.ok(calculateRatingChange(1200, 1200, false) < 0);
});
