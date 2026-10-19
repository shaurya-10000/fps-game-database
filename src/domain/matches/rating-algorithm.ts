export interface RatingInput {
  playerRating: number;
  opponentRating: number;
  result: "win" | "loss" | "draw";
  isPlacement: boolean;
}

export interface RatingOutput {
  newRating: number;
  delta: number;
}

// Deterministic Elo implementation
const K_FACTOR_NORMAL = 32;
const K_FACTOR_PLACEMENT = 64;

function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function calculateNewRating(input: RatingInput): RatingOutput {
  const expected = calculateExpectedScore(input.playerRating, input.opponentRating);
  
  let actual: number;
  if (input.result === "win") actual = 1;
  else if (input.result === "loss") actual = 0;
  else actual = 0.5;

  const kFactor = input.isPlacement ? K_FACTOR_PLACEMENT : K_FACTOR_NORMAL;
  const delta = Math.round(kFactor * (actual - expected));

  return {
    newRating: input.playerRating + delta,
    delta
  };
}

export const ALGORITHM_VERSION = "v1";
