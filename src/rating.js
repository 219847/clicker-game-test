export const DEFAULT_RATING = 1200;
export const MIN_RATING = 100;
export const MAX_RATING = 2147483647;
export const RATING_COOKIE = "puzzle_rating";

function clamp(value) {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, Math.trunc(value)));
}

export function readRating(cookieString = globalThis.document?.cookie ?? "") {
  const raw = cookieString.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${RATING_COOKIE}=`))?.slice(RATING_COOKIE.length + 1);
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? clamp(parsed) : DEFAULT_RATING;
}

export function writeRating(rating) {
  const value = clamp(rating);
  if (globalThis.document) {
    document.cookie = `${RATING_COOKIE}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`;
  }
  return value;
}

export function calculateRatingChange(userRating, puzzleRating, solved) {
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
  const change = Math.max(5, Math.round(24 * (solved ? 1 - expected : expected)));
  return solved ? change : -change;
}
