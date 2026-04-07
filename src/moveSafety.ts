import { Chess, SQUARES } from 'chess.js'
import type { Move, Square } from 'chess.js'
import type { CSSProperties } from 'react'

/** Standard material (king excluded from hanging sums). */
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

function pieceMaterialValue(pieceType: string): number {
  return PIECE_VALUES[pieceType] ?? 0
}

function fenWithSideToMove(fen: string, color: 'w' | 'b'): string {
  const parts = fen.split(' ')
  if (parts.length < 2) return fen
  parts[1] = color
  return parts.join(' ')
}

const TINT_SAFE_DIM: CSSProperties = {
  backgroundColor: 'rgba(37, 99, 235, 0.28)',
}

const TINT_SAFE: CSSProperties = { backgroundColor: 'rgba(37, 99, 235, 0.42)' }

/** Stronger red for larger hanging pieces (max practical loss ≈ 9). */
function lossTintDim(maxHangingValue: number): CSSProperties {
  if (maxHangingValue <= 0) return TINT_SAFE_DIM
  const t = Math.min(maxHangingValue, 9) / 9
  const alpha = 0.2 + t * 0.28
  return { backgroundColor: `rgba(220, 38, 38, ${alpha.toFixed(3)})` }
}

function lossTintStrong(maxHangingValue: number): CSSProperties {
  if (maxHangingValue <= 0) return TINT_SAFE
  const t = Math.min(maxHangingValue, 9) / 9
  const alpha = 0.34 + t * 0.32
  return { backgroundColor: `rgba(220, 38, 38, ${alpha.toFixed(3)})` }
}

/**
 * When it is `playerColor`'s turn: tint every square they can legally move to.
 * Blue = no friendly piece obviously lost in one ply; red = at least one move there can lose material.
 */
export function buildPlayerLegalDestinationsTint(
  fen: string,
  playerColor: 'w' | 'b',
): Record<string, CSSProperties> {
  const c = new Chess()
  try {
    c.load(fen)
  } catch {
    return {}
  }
  if (c.turn() !== playerColor) return {}

  const moves = c.moves({ verbose: true })
  const destMaxLoss: Record<string, number> = {}

  for (const m of moves) {
    const loss = maxHangingPieceValueAfterMove(fen, m)
    const prev = destMaxLoss[m.to]
    destMaxLoss[m.to] =
      prev === undefined ? loss : Math.max(prev, loss)
  }

  const styles: Record<string, CSSProperties> = {}
  for (const [sq, loss] of Object.entries(destMaxLoss)) {
    styles[sq] = loss > 0 ? lossTintDim(loss) : TINT_SAFE_DIM
  }
  return styles
}

/** + / # for your legal moves only (when it is your turn). */
export function buildPlayerCheckMateMarks(
  fen: string,
  playerColor: 'w' | 'b',
): Record<string, '+' | '#'> {
  const c = new Chess()
  try {
    c.load(fen)
  } catch {
    return {}
  }
  if (c.turn() !== playerColor) return {}

  const moves = c.moves({ verbose: true })
  const marks: Record<string, '+' | '#'> = {}
  for (const m of moves) {
    const t = new Chess()
    t.load(fen)
    const ok = t.move({
      from: m.from,
      to: m.to,
      promotion: m.promotion,
    })
    if (!ok) continue
    if (t.isCheckmate()) marks[m.to] = '#'
    else if (t.isCheck()) marks[m.to] = '+'
  }
  return marks
}

/** True if opponent can legally capture on `sq` and, after that capture, no friendly recapture on `sq` exists. */
function canLosePieceToCaptureWithoutRecapture(
  fenPos: string,
  sq: Square,
  attacker: 'w' | 'b',
): boolean {
  const p = new Chess()
  try {
    p.load(fenWithSideToMove(fenPos, attacker))
  } catch {
    return false
  }
  const caps = p.moves({ verbose: true }).filter((m) => m.to === sq && m.captured)
  if (caps.length === 0) return false

  for (const cap of caps) {
    const t = new Chess()
    try {
      t.load(p.fen())
      t.move(cap)
    } catch {
      continue
    }
    const recaps = t.moves({ verbose: true }).filter((m) => m.to === sq && m.captured)
    if (recaps.length === 0) return true
  }
  return false
}

/**
 * After this legal move: max material value among friendly pieces (not king) that
 * sit on a square where the opponent can capture with no recapture on that square.
 */
export function maxHangingPieceValueAfterMove(
  fenBefore: string,
  m: Move,
): number {
  const chess = new Chess()
  chess.load(fenBefore)
  const played = chess.move({
    from: m.from,
    to: m.to,
    promotion: m.promotion,
  })
  if (!played) return 0

  const my = played.color
  const opp = my === 'w' ? 'b' : 'w'

  let maxV = 0
  for (const sq of SQUARES) {
    const piece = chess.get(sq)
    if (!piece || piece.color !== my || piece.type === 'k') continue
    if (canLosePieceToCaptureWithoutRecapture(chess.fen(), sq, opp)) {
      maxV = Math.max(maxV, pieceMaterialValue(piece.type))
    }
  }
  return maxV
}

/**
 * After this legal move, would any friendly piece (except the king) be capturable
 * in one ply with no recapture on that square?
 */
export function moveLeavesFriendlyHanging(fenBefore: string, m: Move): boolean {
  return maxHangingPieceValueAfterMove(fenBefore, m) > 0
}

export function buildInteractionHighlights(
  fen: string,
  from: Square,
  playerColor: 'w' | 'b',
): {
  styles: Record<string, CSSProperties>
  marks: Record<string, '+' | '#'>
} {
  const c = new Chess()
  try {
    c.load(fen)
  } catch {
    return { styles: {}, marks: {} }
  }
  if (c.turn() !== playerColor) return { styles: {}, marks: {} }

  const moves = c.moves({ square: from, verbose: true })
  const styles: Record<string, CSSProperties> = {}
  const marks: Record<string, '+' | '#'> = {}

  for (const m of moves) {
    const loss = maxHangingPieceValueAfterMove(fen, m)
    styles[m.to] = loss > 0 ? lossTintStrong(loss) : TINT_SAFE

    const t = new Chess()
    t.load(fen)
    const ok = t.move({
      from: m.from,
      to: m.to,
      promotion: m.promotion,
    })
    if (!ok) continue
    if (t.isCheckmate()) marks[m.to] = '#'
    else if (t.isCheck()) marks[m.to] = '+'
  }

  return { styles, marks }
}
