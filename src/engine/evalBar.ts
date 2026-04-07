import type { ParsedScore } from './stockfishUci'
import { evalForPlayer } from './stockfishUci'

/** Centipawn scale for tanh — larger → bar moves less for the same advantage. */
const BAR_CP_SCALE = 920

/**
 * Softer than raw eval so huge / mate positions don’t peg the bar as hard.
 */
function whiteCpForBar(score: ParsedScore, stm: 'w' | 'b'): number {
  if (score.type === 'cp') {
    return evalForPlayer(score, stm, 'w')
  }
  const w = evalForPlayer(score, stm, 'w')
  if (w === 0) return 0
  const plies = Math.max(1, Math.abs(score.value))
  const sign = w > 0 ? 1 : -1
  // Mate leans the bar but leaves headroom; faster mate nudges further.
  return sign * (260 + 380 / Math.sqrt(plies))
}

/**
 * 0 = black winning (bar favors right), 1 = white winning (left).
 */
export function barRatioFromScore(score: ParsedScore, stm: 'w' | 'b'): number {
  const wCp = whiteCpForBar(score, stm)
  const t = 0.5 + 0.5 * Math.tanh(wCp / BAR_CP_SCALE)
  return Math.min(1, Math.max(0, t))
}

/** Short label from White’s perspective (+ = White better). */
export function formatWhiteEvalLabel(score: ParsedScore, stm: 'w' | 'b'): string {
  const wCp = evalForPlayer(score, stm, 'w')
  if (score.type === 'mate') {
    if (wCp > 0) return '+#'
    if (wCp < 0) return '-#'
    return '0'
  }
  const p = wCp / 100
  const rounded = Math.round(p * 10) / 10
  if (rounded === 0) return '0.0'
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`
}

export function evalBarAriaLabel(
  score: ParsedScore,
  stm: 'w' | 'b',
  label: string,
): string {
  const wCp = evalForPlayer(score, stm, 'w')
  if (score.type === 'mate') {
    if (wCp > 0)
      return `Engine evaluation: White is mating. ${label}. White on the left of the bar.`
    if (wCp < 0)
      return `Engine evaluation: Black is mating. ${label}. White on the left of the bar.`
  }
  if (wCp > 40)
    return `Engine evaluation: White is clearly better, about ${label} pawns. White on the left of the bar.`
  if (wCp < -40)
    return `Engine evaluation: Black is clearly better, about ${label} pawns. White on the left of the bar.`
  return `Engine evaluation: roughly equal, ${label}. White on the left of the bar.`
}
