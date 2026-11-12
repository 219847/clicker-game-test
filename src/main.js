import { applyMove, indexToSquare, parseFen, pieceGlyph, squareToIndex, moveToUci } from "./chess.js";
import { calculateRatingChange, readRating, writeRating } from "./rating.js";
import { selectPuzzle, validatePuzzle } from "./puzzle.js";

const storedPuzzles = (() => {
  try {
    const value = JSON.parse(localStorage.getItem("imported_puzzles") ?? "[]");
    return Array.isArray(value) ? value.map(validatePuzzle) : [];
  } catch {
    return [];
  }
})();
const state = { puzzles: storedPuzzles, puzzle: null, position: null, moveIndex: 0, selected: null, attemptRated: false, rating: readRating() };
const $ = (id) => document.getElementById(id);
const board = $("board");

function setMessage(text) { $("message").textContent = text; }
function render() {
  board.replaceChildren();
  const orientation = state.puzzle?.colorOfUser === "b" ? [...Array(64).keys()].reverse() : [...Array(64).keys()];
  orientation.forEach((index) => {
    const button = document.createElement("button");
    button.className = `square ${(Math.floor(index / 8) + index) % 2 ? "dark" : "light"}`;
    button.dataset.square = indexToSquare(index);
    button.textContent = pieceGlyph(state.position?.board[index]);
    button.disabled = !state.puzzle || state.moveIndex >= state.puzzle.moves.length || state.position?.turn !== state.puzzle.colorOfUser;
    if (state.selected === index) button.classList.add("selected");
    button.addEventListener("click", () => selectSquare(index));
    board.append(button);
  });
  $("user-rating").textContent = state.rating;
  $("puzzle-rating").textContent = state.puzzle?.rating ?? "—";
}

function selectSquare(index) {
  if (!state.position || state.position.turn !== state.puzzle.colorOfUser || state.moveIndex >= state.puzzle.moves.length) return;
  const piece = state.position.board[index];
  if (state.selected === null) {
    if (piece && (piece === piece.toUpperCase() ? "w" : "b") === state.puzzle.colorOfUser) { state.selected = index; render(); }
    return;
  }
  if (piece && (piece === piece.toUpperCase() ? "w" : "b") === state.puzzle.colorOfUser) {
    state.selected = index;
    render();
    return;
  }
  const from = state.selected;
  const candidate = moveToUci({ from, to: index });
  const expected = state.puzzle.moves[state.moveIndex];
  state.selected = null;
  if (candidate.slice(0, 4) !== expected.slice(0, 4)) return failAttempt();
  // The expected move was validated during import, so applying its coordinates is safe.
  state.position = applyMove(state.position, { from, to: index, promotion: expected[4] });
  state.moveIndex++;
  render();
  if (state.moveIndex >= state.puzzle.moves.length) return completeAttempt(true);
  window.setTimeout(playOpponentMove, 250);
}

function playOpponentMove() {
  if (!state.puzzle || state.moveIndex >= state.puzzle.moves.length || state.position.turn === state.puzzle.colorOfUser) return;
  const uci = state.puzzle.moves[state.moveIndex];
  state.position = applyMove(state.position, { from: squareToIndex(uci.slice(0, 2)), to: squareToIndex(uci.slice(2, 4)), promotion: uci[4] });
  state.moveIndex++;
  render();
  if (state.moveIndex >= state.puzzle.moves.length) completeAttempt(true);
}

function failAttempt() {
  if (state.attemptRated) return;
  state.attemptRated = true;
  completeAttempt(false);
}

function completeAttempt(solved) {
  const change = calculateRatingChange(state.rating, state.puzzle.rating, solved);
  state.rating = writeRating(state.rating + change);
  $("result").textContent = `${solved ? "Puzzle solved!" : "Puzzle failed."} Rating ${change >= 0 ? "gained" : "lost"}: ${Math.abs(change)}.`;
  setMessage(solved ? "Well done. Load another puzzle when ready." : "Incorrect move. Load another puzzle to try again.");
  render();
}

function loadPuzzle() {
  const min = Number($("rating-min").value) || 0, max = Number($("rating-max").value) || Number.MAX_SAFE_INTEGER;
  state.puzzle = selectPuzzle(state.puzzles, min, max);
  $("result").textContent = "";
  if (!state.puzzle) { setMessage("No imported puzzles match that rating range."); state.position = null; render(); return; }
  state.position = parseFen(state.puzzle.initialFen);
  state.moveIndex = 0; state.selected = null; state.attemptRated = false;
  setMessage("Puzzle loaded.");
  render();
  playOpponentMove();
}

$("load-puzzle").addEventListener("click", loadPuzzle);
$("import-file").addEventListener("change", async (event) => {
  try {
    const parsed = JSON.parse(await event.target.files[0].text());
    const imported = Array.isArray(parsed) ? parsed : parsed.puzzles ?? [parsed];
    state.puzzles.push(...imported.map(validatePuzzle));
    localStorage.setItem("imported_puzzles", JSON.stringify(state.puzzles));
    setMessage(`Imported ${imported.length} puzzle${imported.length === 1 ? "" : "s"}.`);
    loadPuzzle();
  } catch (error) {
    setMessage(`Import failed: ${error.message}`);
  } finally { event.target.value = ""; }
});
render();
