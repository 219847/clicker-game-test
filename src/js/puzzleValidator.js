import { Chess } from "chess.js";
import { decodeTCNMoves } from "./tcn.js";

function normalizeColor(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized === "white" || normalized === "black" ? normalized : undefined;
}

function sideToColor(side) {
  return side === "w" ? "white" : "black";
}

export function validatePuzzleRecord(record, { strictIdKey } = {}) {
  const errors = [];

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { valid: false, errors: ["Puzzle record must be an object"] };
  }

  const id = Number(record.id);
  if (!Number.isInteger(id) || id <= 0) {
    errors.push("id must be a positive integer");
  }

  if (strictIdKey !== undefined && Number(strictIdKey) !== id) {
    errors.push(`id does not match JSON key '${strictIdKey}'`);
  }

  if (typeof record.initialFen !== "string" || record.initialFen.trim() === "") {
    errors.push("initialFen is required");
  }

  if (typeof record.tcnMoveList !== "string") {
    errors.push("tcnMoveList is required");
  }

  const colorOfUser = normalizeColor(record.colorOfUser);
  if (!colorOfUser) {
    errors.push("colorOfUser must be 'white' or 'black'");
  }

  let decodedMoves = [];
  if (typeof record.tcnMoveList === "string") {
    try {
      decodedMoves = decodeTCNMoves(record.tcnMoveList);
    } catch (error) {
      errors.push(`tcnMoveList decode error: ${error.message}`);
    }
  }

  let firstOpponentMove;
  let moveSides = [];

  if (typeof record.initialFen === "string" && colorOfUser && decodedMoves.length >= 0) {
    const chess = new Chess();
    try {
      chess.load(record.initialFen);

      const userSide = colorOfUser === "white" ? "w" : "b";
      const opponentSide = userSide === "w" ? "b" : "w";

      if (chess.turn() !== opponentSide) {
        errors.push(
          `initialFen side-to-move (${sideToColor(chess.turn())}) must be opponent of colorOfUser (${colorOfUser})`
        );
      }

      for (let index = 0; index < decodedMoves.length; index += 1) {
        const expectedSide = index % 2 === 0 ? opponentSide : userSide;
        const actualSide = chess.turn();
        if (actualSide !== expectedSide) {
          errors.push(
            `Move ${index + 1} out of order: expected ${sideToColor(expectedSide)} to move, got ${sideToColor(actualSide)}`
          );
          break;
        }

        const decoded = decodedMoves[index];
        const legalMove = chess.move({
          from: decoded.from,
          to: decoded.to,
          promotion: decoded.promotion,
        });

        if (!legalMove) {
          errors.push(`Illegal move at ply ${index + 1}: ${decoded.uci}`);
          break;
        }

        moveSides.push(sideToColor(expectedSide));
      }

      firstOpponentMove = decodedMoves[0]?.uci;
    } catch (error) {
      errors.push(`initialFen is invalid: ${error.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedRecord: {
      ...record,
      id: Number.isInteger(id) ? id : record.id,
      colorOfUser,
    },
    decodedUciMoves: decodedMoves.map((move) => move.uci),
    firstOpponentMove,
    moveSides,
  };
}

export function preparePuzzleSession(record) {
  const validation = validatePuzzleRecord(record);
  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors,
    };
  }

  const chess = new Chess();
  chess.load(record.initialFen);

  const userSide = validation.normalizedRecord.colorOfUser === "white" ? "w" : "b";
  const decodedMoves = decodeTCNMoves(record.tcnMoveList);
  const firstMove = decodedMoves[0];

  if (!firstMove) {
    return {
      valid: true,
      autoPlayedMove: null,
      userToMove: chess.turn() === userSide,
      boardFen: chess.fen(),
    };
  }

  chess.move({ from: firstMove.from, to: firstMove.to, promotion: firstMove.promotion });

  return {
    valid: true,
    autoPlayedMove: firstMove.uci,
    userToMove: chess.turn() === userSide,
    boardFen: chess.fen(),
  };
}
