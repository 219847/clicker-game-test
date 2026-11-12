export const TCN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$";

const PROMOTION_PIECES = "qnrb";

function indexToSquare(index) {
  if (!Number.isInteger(index) || index < 0 || index > 63) {
    throw new Error(`Square index out of range: ${index}`);
  }
  const file = String.fromCharCode("a".charCodeAt(0) + (index % 8));
  const rank = Math.floor(index / 8) + 1;
  return `${file}${rank}`;
}

function decodePair(firstChar, secondChar, pairIndex) {
  const fromIndex = TCN_ALPHABET.indexOf(firstChar);
  if (fromIndex < 0) {
    throw new Error(`Invalid TCN character '${firstChar}' at position ${pairIndex * 2}`);
  }
  if (fromIndex > 63) {
    throw new Error(`Invalid from-square code '${firstChar}' at pair ${pairIndex + 1}`);
  }

  const secondIndex = TCN_ALPHABET.indexOf(secondChar);
  if (secondIndex < 0) {
    throw new Error(`Invalid TCN character '${secondChar}' at position ${pairIndex * 2 + 1}`);
  }

  const from = indexToSquare(fromIndex);

  if (secondIndex <= 63) {
    const to = indexToSquare(secondIndex);
    return { from, to, promotion: undefined, uci: `${from}${to}` };
  }

  const promotionIndex = Math.floor((secondIndex - 64) / 3);
  const promotion = PROMOTION_PIECES[promotionIndex];
  if (!promotion) {
    throw new Error(`Invalid promotion code '${secondChar}' at pair ${pairIndex + 1}`);
  }

  const offset = ((secondIndex - 1) % 3) - 1;
  const promotionDirection = fromIndex < 16 ? -8 : 8;
  const toIndex = fromIndex + promotionDirection + offset;
  if (toIndex < 0 || toIndex > 63) {
    throw new Error(`Promotion target out of range at pair ${pairIndex + 1}`);
  }

  const to = indexToSquare(toIndex);
  return { from, to, promotion, uci: `${from}${to}${promotion}` };
}

export function decodeTCNMoves(tcnMoveList) {
  if (typeof tcnMoveList !== "string") {
    throw new Error("tcnMoveList must be a string");
  }
  if (tcnMoveList.length === 0) {
    return [];
  }
  if (tcnMoveList.length % 2 !== 0) {
    throw new Error("Malformed TCN sequence: expected an even number of characters");
  }

  const moves = [];
  for (let i = 0; i < tcnMoveList.length; i += 2) {
    moves.push(decodePair(tcnMoveList[i], tcnMoveList[i + 1], i / 2));
  }
  return moves;
}

export function decodeTCNToUci(tcnMoveList) {
  return decodeTCNMoves(tcnMoveList).map((move) => move.uci);
}
