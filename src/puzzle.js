import { moveFromUci, moveToUci, parseFen, applyMove, legalMoves } from "./chess.js";

export function decodeTcn(sequence) {
  if (Array.isArray(sequence)) return sequence.flatMap(normalizeMove);
  if (typeof sequence !== "string" || !sequence.trim()) throw new Error("Puzzle TCN sequence is empty");
  const text = sequence.trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.flatMap(normalizeMove);
  } catch { /* TCN may be encoded rather than JSON. */ }
  if (/^(?:[a-h][1-8][a-h][1-8][qrbn]?\s*)+$/i.test(text)) return text.split(/\s+/).flatMap(normalizeMove);
  let binary;
  try { binary = Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)); } catch { throw new Error("Unsupported TCN encoding"); }
  const moves = [];
  for (let i = 0; i + 1 < binary.length; i += 2) {
    const from = binary[i] & 63, to = binary[i + 1] & 63;
    moves.push(`${String.fromCharCode(97 + from % 8)}${8 - Math.floor(from / 8)}${String.fromCharCode(97 + to % 8)}${8 - Math.floor(to / 8)}`);
  }
  return moves;
}

function normalizeMove(move) {
  if (typeof move === "string") return [move.trim()];
  if (move && typeof move === "object" && typeof move.uci === "string") return [move.uci.trim()];
  throw new Error("Invalid move in puzzle sequence");
}

export function validatePuzzle(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Puzzle must be an object");
  if (typeof raw.initialFen !== "string" || typeof raw.colorOfUser !== "string" || !Number.isFinite(Number(raw.rating))) throw new Error("Puzzle requires initialFen, colorOfUser, and rating");
  const colorOfUser = raw.colorOfUser.toLowerCase().startsWith("b") ? "b" : raw.colorOfUser.toLowerCase().startsWith("w") ? "w" : null;
  if (!colorOfUser) throw new Error("colorOfUser must be white or black");
  let position = parseFen(raw.initialFen);
  const moves = decodeTcn(raw.tcn ?? raw.moves);
  if (!moves.length) throw new Error("Puzzle has no moves");
  const decoded = moves.map((uci) => {
    const move = moveFromUci(position, uci);
    if (!move) throw new Error(`Illegal puzzle move: ${uci}`);
    position = applyMove(position, move);
    return moveToUci(move);
  });
  return { ...raw, colorOfUser, rating: Math.max(0, Math.round(Number(raw.rating))), moves: decoded };
}

export function selectPuzzle(puzzles, min, max) {
  const matching = puzzles.filter((puzzle) => puzzle.rating >= min && puzzle.rating <= max);
  return matching[Math.floor(Math.random() * matching.length)] ?? null;
}

export { legalMoves };
