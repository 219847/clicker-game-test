const FILES = "abcdefgh";
const PIECES = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚", P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔" };

export function squareToIndex(square) {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error(`Invalid square: ${square}`);
  return (8 - Number(square[1])) * 8 + FILES.indexOf(square[0]);
}
export function indexToSquare(index) { return `${FILES[index % 8]}${8 - Math.floor(index / 8)}`; }

export function parseFen(fen) {
  const [placement, turn = "w", castling = "-", enPassant = "-", halfmove = "0", fullmove = "1"] = fen.trim().split(/\s+/);
  const board = Array(64).fill(null);
  placement.split("/").forEach((row, rank) => {
    let file = 0;
    for (const char of row) {
      if (/\d/.test(char)) file += Number(char);
      else if (/[pnbrqkPNBRQK]/.test(char)) board[rank * 8 + file++] = char;
      else throw new Error("Invalid FEN piece placement");
    }
    if (file !== 8) throw new Error("Invalid FEN rank");
  });
  if (!["w", "b"].includes(turn)) throw new Error("Invalid FEN turn");
  return { board, turn, castling, enPassant, halfmove: Number(halfmove), fullmove: Number(fullmove) };
}

export function clonePosition(position) { return { ...position, board: [...position.board] }; }
function color(piece) { return piece === piece.toUpperCase() ? "w" : "b"; }
function opponent(side) { return side === "w" ? "b" : "w"; }
function onBoard(index) { return index >= 0 && index < 64; }
function sameFile(a, b) { return a % 8 === b % 8; }
function isEnemy(piece, side) { return piece && color(piece) !== side; }

function attacksSquare(position, from, target, side) {
  const piece = position.board[from]?.toLowerCase();
  const df = (target % 8) - (from % 8), dr = Math.floor(target / 8) - Math.floor(from / 8);
  if (piece === "p") {
    const direction = side === "w" ? -1 : 1;
    return dr === direction && Math.abs(df) === 1;
  }
  if (piece === "n") return (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
  if (piece === "k") return Math.max(Math.abs(df), Math.abs(dr)) === 1;
  const diagonal = Math.abs(df) === Math.abs(dr), straight = df === 0 || dr === 0;
  if ((piece === "b" && !diagonal) || (piece === "r" && !straight) || (piece === "q" && !diagonal && !straight)) return false;
  const stepFile = Math.sign(df), stepRank = Math.sign(dr);
  let file = from % 8 + stepFile, rank = Math.floor(from / 8) + stepRank;
  while (file !== target % 8 || rank !== Math.floor(target / 8)) {
    if (position.board[rank * 8 + file]) return false;
    file += stepFile; rank += stepRank;
  }
  return true;
}

export function isInCheck(position, side) {
  const king = position.board.indexOf(side === "w" ? "K" : "k");
  return king >= 0 && position.board.some((piece, index) => piece && color(piece) === opponent(side) && attacksSquare(position, index, king, opponent(side)));
}

function pseudoMoves(position, from) {
  const piece = position.board[from], side = color(piece), kind = piece.toLowerCase(), moves = [];
  const add = (to, promotion) => { if (onBoard(to) && (!position.board[to] || isEnemy(position.board[to], side))) moves.push({ from, to, promotion }); };
  const file = from % 8, rank = Math.floor(from / 8);
  if (kind === "p") {
    const step = side === "w" ? -8 : 8, start = side === "w" ? 6 : 1;
    if (onBoard(from + step) && !position.board[from + step]) {
      add(from + step, (rank + (side === "w" ? -1 : 1)) === (side === "w" ? 0 : 7) ? "q" : undefined);
      if (rank === start && !position.board[from + 2 * step]) add(from + 2 * step);
    }
    for (const delta of [step - 1, step + 1]) {
      const to = from + delta;
      if (onBoard(to) && Math.abs(to % 8 - file) === 1 && (isEnemy(position.board[to], side) || position.enPassant === indexToSquare(to))) add(to, (Math.floor(to / 8) === 0 || Math.floor(to / 8) === 7) ? "q" : undefined);
    }
  } else if (kind === "n") [ -17, -15, -10, -6, 6, 10, 15, 17 ].forEach((delta) => { const to = from + delta; if (onBoard(to) && Math.abs(to % 8 - file) <= 2) add(to); });
  else if (kind === "k") [ -9, -8, -7, -1, 1, 7, 8, 9 ].forEach((delta) => { const to = from + delta; if (onBoard(to) && Math.abs(to % 8 - file) <= 1) add(to); });
  else {
    const directions = kind === "b" ? [-9, -7, 7, 9] : kind === "r" ? [-8, -1, 1, 8] : [-9, -8, -7, -1, 1, 7, 8, 9];
    for (const delta of directions) {
      let to = from + delta;
      while (onBoard(to) && Math.abs(to % 8 - (to - delta) % 8) <= 1) {
        if (position.board[to]) { add(to); break; }
        add(to); to += delta;
      }
    }
  }
  return moves;
}

export function applyMove(position, move) {
  const next = clonePosition(position), piece = next.board[move.from], side = color(piece);
  next.board[move.to] = move.promotion ? (side === "w" ? move.promotion.toUpperCase() : move.promotion) : piece;
  next.board[move.from] = null;
  next.turn = opponent(side);
  next.enPassant = "-";
  next.fullmove += side === "b" ? 1 : 0;
  return next;
}

export function legalMoves(position, side = position.turn) {
  const moves = [];
  position.board.forEach((piece, from) => {
    if (!piece || color(piece) !== side) return;
    for (const move of pseudoMoves(position, from)) {
      const next = applyMove(position, move);
      if (!isInCheck(next, side)) moves.push(move);
    }
  });
  return moves;
}

export function moveFromUci(position, uci) {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(uci.trim());
  if (!match) return null;
  const from = squareToIndex(match[1]), to = squareToIndex(match[2]), promotion = match[3]?.toLowerCase();
  return legalMoves(position).find((move) => move.from === from && move.to === to && (move.promotion || !promotion || move.promotion === promotion)) ?? null;
}

export function moveToUci(move) { return `${indexToSquare(move.from)}${indexToSquare(move.to)}${move.promotion ?? ""}`; }
export function pieceGlyph(piece) { return PIECES[piece] ?? ""; }
