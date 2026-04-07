import { Chess } from 'chess.js'
import type { Move, Square } from 'chess.js'
import type { StockfishEngine } from './stockfishUci'
import { evalForPlayer } from './stockfishUci'

const CAPTURE_VALUE: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
}

function captureValue(move: Move): number {
  if (!move.captured) return 0
  return CAPTURE_VALUE[move.captured] ?? 0
}

export type MoveQuality = 'good' | 'ok' | 'bad'

/** Worse than best by this many cp → bad */
const RED_CP = 110
/**
 * evalForPlayer mate wins are ~1e6 − plies; above this we compare mate *speed*,
 * not centipawn windows (stops “all greens” in won endgames).
 */
const MATE_SCORE_FLOOR = 450_000
/** Max gap (on mate score scale) for “best” mate lines to stay green */
const MATE_GOOD_GAP = 2
/** Slower mates stay blue up to this gap, then red */
const MATE_OK_GAP = 48
const GREEN_CAPTURE_MIN = 3
const BIG_CAPTURE = 5

function tierForMove(
  cp: number,
  maxCap: number,
  best: number,
  givesCheck: boolean,
): MoveQuality {
  if (cp <= best - RED_CP) return 'bad'

  const bestIsWinningMate = best > MATE_SCORE_FLOOR
  const cpIsWinningMate = cp > MATE_SCORE_FLOOR

  if (bestIsWinningMate && cpIsWinningMate) {
    const d = best - cp
    if (d <= MATE_GOOD_GAP) return 'good'
    if (d <= MATE_OK_GAP) return 'ok'
    return 'bad'
  }

  // Centipawn world: only engine-best and sharp forcing near-best lines are green.
  const veryTop = cp >= best - 2
  const close = cp >= best - 8
  const forcing = givesCheck || maxCap >= BIG_CAPTURE
  const decentCap = maxCap >= GREEN_CAPTURE_MIN

  if (veryTop) return 'good'
  if (close && forcing) return 'good'
  if (close && decentCap && cp >= best - 4) return 'good'
  return 'ok'
}

/**
 * Classify every legal destination and every square with a movable piece (`from`).
 */
export async function classifyLegalDestinations(
  engine: StockfishEngine,
  fen: string,
  playerColor: 'w' | 'b',
  signal: AbortSignal,
  opts?: { childMovetime?: number },
): Promise<Record<string, MoveQuality>> {
  const chess = new Chess()
  try {
    chess.load(fen)
  } catch {
    return {}
  }
  if (chess.turn() !== playerColor) return {}

  const moves = chess.moves({ verbose: true })
  if (moves.length === 0) return {}

  const childMs = opts?.childMovetime ?? 68

  type Row = {
    from: Square
    to: Square
    cp: number
    cap: number
    givesCheck: boolean
  }
  const rows: Row[] = []

  for (const m of moves) {
    const c = new Chess()
    c.load(fen)
    const ok = c.move(m)
    if (!ok) continue
    const givesCheck = c.inCheck()
    const r = await engine.analyzeFen(c.fen(), { movetime: childMs })
    signal.throwIfAborted()
    const stm = c.turn()
    const cp = evalForPlayer(r.score, stm, playerColor)
    rows.push({
      from: m.from as Square,
      to: m.to as Square,
      cp,
      cap: captureValue(m),
      givesCheck,
    })
  }

  if (rows.length === 0) return {}

  const best = Math.max(...rows.map((x) => x.cp))

  const byDest = new Map<Square, Row[]>()
  const byFrom = new Map<Square, Row[]>()
  for (const row of rows) {
    const d = byDest.get(row.to) ?? []
    d.push(row)
    byDest.set(row.to, d)
    const f = byFrom.get(row.from) ?? []
    f.push(row)
    byFrom.set(row.from, f)
  }

  const out: Record<string, MoveQuality> = {}

  for (const [to, list] of byDest.entries()) {
    const cp = Math.max(...list.map((x) => x.cp))
    const maxCap = Math.max(...list.map((x) => x.cap))
    const top = list.filter((x) => x.cp >= cp - 0.5)
    const givesCheck = top.some((x) => x.givesCheck)
    out[to] = tierForMove(cp, maxCap, best, givesCheck)
  }

  for (const [from, list] of byFrom.entries()) {
    const bestRow = list.reduce((a, b) => (b.cp > a.cp ? b : a))
    out[from] = tierForMove(
      bestRow.cp,
      bestRow.cap,
      best,
      bestRow.givesCheck,
    )
  }

  return out
}
