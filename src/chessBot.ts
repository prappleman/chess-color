import { Chess } from 'chess.js'
import type { StockfishEngine } from './engine/stockfishUci'

/**
 * Official Stockfish `UCI_Elo` spin range (see UCI docs). Values outside are clamped
 * by the engine.
 */
export const STOCKFISH_UCI_ELO_MIN = 1320
export const STOCKFISH_UCI_ELO_MAX = 3190

/** Discrete chess.com–style presets (rating + tier label). Index 0 = weakest. */
export const DIFFICULTY_PRESETS = [
  { rating: 250, tier: 'Beginner' },
  { rating: 400, tier: 'Beginner' },
  { rating: 550, tier: 'Beginner' },
  { rating: 700, tier: 'Beginner' },
  { rating: 850, tier: 'Beginner' },
  { rating: 1000, tier: 'Intermediate' },
  { rating: 1100, tier: 'Intermediate' },
  { rating: 1200, tier: 'Intermediate' },
  { rating: 1300, tier: 'Intermediate' },
  { rating: 1400, tier: 'Intermediate' },
  { rating: 1500, tier: 'Intermediate' },
  { rating: 1600, tier: 'Advanced' },
  { rating: 1700, tier: 'Advanced' },
  { rating: 1800, tier: 'Advanced' },
  { rating: 1900, tier: 'Advanced' },
  { rating: 2000, tier: 'Expert' },
  { rating: 2100, tier: 'Expert' },
  { rating: 2200, tier: 'Expert' },
  { rating: 2300, tier: 'Expert' },
  { rating: 2400, tier: 'Master' },
  { rating: 2500, tier: 'Master' },
  { rating: 2600, tier: 'Grandmaster' },
  { rating: 2700, tier: 'Grandmaster' },
  { rating: 2800, tier: 'Grandmaster' },
  { rating: 2900, tier: 'Supergrandmaster' },
  { rating: 3200, tier: 'Maximum' },
] as const

export const DIFFICULTY_INDEX_MAX = DIFFICULTY_PRESETS.length - 1

export const DIFFICULTY_RATING_MIN = DIFFICULTY_PRESETS[0].rating
export const DIFFICULTY_RATING_MAX =
  DIFFICULTY_PRESETS[DIFFICULTY_INDEX_MAX].rating

function clampDifficultyIndex(difficulty: number): number {
  const r = Math.floor(difficulty)
  // Legacy 1–100 slider → same spread as old linear 250–3200 mapping
  if (r > DIFFICULTY_INDEX_MAX && r <= 100) {
    return Math.round(((r - 1) / 99) * DIFFICULTY_INDEX_MAX)
  }
  return Math.min(DIFFICULTY_INDEX_MAX, Math.max(0, r))
}

/** Target rating for the preset at this index (0 … DIFFICULTY_INDEX_MAX). */
export function difficultyTargetRating(difficulty: number): number {
  return DIFFICULTY_PRESETS[clampDifficultyIndex(difficulty)].rating
}

/**
 * Map preset index → UCI_Elo + movetime. Below Stockfish’s min UCI we keep UCI at 1320 and
 * shorten search time to weaken play; above max UCI we cap at 3190.
 */
export function difficultyToBotOptions(difficulty: number): {
  elo: number
  movetime: number
} {
  const idx = clampDifficultyIndex(difficulty)
  const target = DIFFICULTY_PRESETS[idx].rating
  const maxIdx = DIFFICULTY_INDEX_MAX || 1

  const uciElo = Math.min(
    STOCKFISH_UCI_ELO_MAX,
    Math.max(STOCKFISH_UCI_ELO_MIN, target),
  )

  const baseMovetime = Math.round(100 + (idx / maxIdx) * 750)

  let movetime = baseMovetime
  if (target < STOCKFISH_UCI_ELO_MIN) {
    const span = STOCKFISH_UCI_ELO_MIN - DIFFICULTY_RATING_MIN
    const t = span > 0 ? (target - DIFFICULTY_RATING_MIN) / span : 1
    const factor = 0.12 + 0.88 * Math.min(1, Math.max(0, t))
    movetime = Math.max(45, Math.round(baseMovetime * factor))
  }

  return { elo: uciElo, movetime }
}

/** Raw UCI_Elo passed to Stockfish. */
export function difficultyUciElo(difficulty: number): number {
  return difficultyToBotOptions(difficulty).elo
}

/** Same as target rating (chess.com-style label). Kept for callers that used “approx”. */
export function difficultyApproxHumanElo(difficulty: number): number {
  return difficultyTargetRating(difficulty)
}

export function difficultyLabel(difficulty: number): string {
  return DIFFICULTY_PRESETS[clampDifficultyIndex(difficulty)].tier
}

function uciToSan(fen: string, uci: string): string | null {
  if (!uci || uci === '(none)') return null
  const c = new Chess()
  try {
    c.load(fen)
  } catch {
    return null
  }
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion =
    uci.length >= 5
      ? (uci[4] as 'q' | 'r' | 'b' | 'n')
      : undefined
  const m = c.move({ from, to, promotion })
  return m?.san ?? null
}

/** Stockfish bot: UCI_Elo + movetime; restores full strength after. */
export async function chooseStockfishMove(
  engine: StockfishEngine,
  fen: string,
  difficulty: number,
): Promise<string | null> {
  const chess = new Chess()
  try {
    chess.load(fen)
  } catch {
    return null
  }
  if (chess.moves().length === 0) return null

  const { elo, movetime } = difficultyToBotOptions(difficulty)
  try {
    await engine.setLimitStrength(elo)
    const { bestmove } = await engine.analyzeFen(fen, { movetime })
    return uciToSan(fen, bestmove)
  } finally {
    await engine.setFullStrength()
  }
}
