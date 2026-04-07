import type { CSSProperties } from 'react'
import type { UiTheme } from '../themeStorage'
import type { MoveQuality } from './classifyMoves'

/** Which squares get engine hint tints when no piece is selected. */
export type HintSurface = 'destinations' | 'pieces' | 'both'

/** Limit full-board hints to move targets, piece origins, or both. */
export function filterHintsForSurface(
  hints: Record<string, MoveQuality>,
  surface: HintSurface,
  fromSquares: ReadonlySet<string>,
  destSquares: ReadonlySet<string>,
): Record<string, MoveQuality> {
  if (surface === 'both') return hints
  const out: Record<string, MoveQuality> = {}
  for (const [sq, q] of Object.entries(hints)) {
    if (surface === 'destinations' && destSquares.has(sq)) out[sq] = q
    if (surface === 'pieces' && fromSquares.has(sq)) out[sq] = q
  }
  return out
}

/** Until user asks for a hint, strong (green) moves are shown as reasonable (blue). */
export function effectiveHintTier(
  tier: MoveQuality,
  strongMovesRevealed: boolean,
): MoveQuality {
  if (tier === 'good' && !strongMovesRevealed) return 'ok'
  return tier
}

const FILL_DARK: Record<MoveQuality, string> = {
  good: 'rgba(52, 211, 153, 0.4)',
  ok: 'rgba(96, 165, 250, 0.42)',
  bad: 'rgba(248, 113, 113, 0.38)',
}

const FILL_DARK_SELECTED: Record<MoveQuality, string> = {
  good: 'rgba(52, 211, 153, 0.5)',
  ok: 'rgba(96, 165, 250, 0.52)',
  bad: 'rgba(248, 113, 113, 0.46)',
}

const FILL_LIGHT: Record<MoveQuality, string> = {
  good: 'rgba(22, 163, 74, 0.44)',
  ok: 'rgba(37, 99, 235, 0.4)',
  bad: 'rgba(220, 38, 38, 0.42)',
}

const FILL_LIGHT_SELECTED: Record<MoveQuality, string> = {
  good: 'rgba(22, 163, 74, 0.52)',
  ok: 'rgba(37, 99, 235, 0.48)',
  bad: 'rgba(220, 38, 38, 0.5)',
}

function fillTable(theme: UiTheme, selected: boolean): Record<MoveQuality, string> {
  if (theme === 'light') {
    return selected ? FILL_LIGHT_SELECTED : FILL_LIGHT
  }
  return selected ? FILL_DARK_SELECTED : FILL_DARK
}

/** Reused for identical tiers — avoids per-square object allocation during hint tinting. */
const HINT_BG_LIGHT: Record<MoveQuality, Readonly<CSSProperties>> = {
  good: { backgroundColor: FILL_LIGHT.good },
  ok: { backgroundColor: FILL_LIGHT.ok },
  bad: { backgroundColor: FILL_LIGHT.bad },
}
const HINT_BG_DARK: Record<MoveQuality, Readonly<CSSProperties>> = {
  good: { backgroundColor: FILL_DARK.good },
  ok: { backgroundColor: FILL_DARK.ok },
  bad: { backgroundColor: FILL_DARK.bad },
}

const ACCENT_LIGHT_W = 'rgba(99, 102, 241, 0.28)'
const ACCENT_LIGHT_B = 'rgba(167, 139, 250, 0.28)'
const ACCENT_DARK_W = 'rgba(129, 140, 248, 0.26)'
const ACCENT_DARK_B = 'rgba(192, 132, 252, 0.26)'

function selectedPieceGradient(hint: string, accent: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(${hint}, ${hint}), linear-gradient(${accent}, ${accent})`,
  }
}

const SELECTED_PIECE: Record<
  UiTheme,
  Record<'w' | 'b', Record<MoveQuality, CSSProperties>>
> = {
  light: {
    w: {
      good: selectedPieceGradient(FILL_LIGHT_SELECTED.good, ACCENT_LIGHT_W),
      ok: selectedPieceGradient(FILL_LIGHT_SELECTED.ok, ACCENT_LIGHT_W),
      bad: selectedPieceGradient(FILL_LIGHT_SELECTED.bad, ACCENT_LIGHT_W),
    },
    b: {
      good: selectedPieceGradient(FILL_LIGHT_SELECTED.good, ACCENT_LIGHT_B),
      ok: selectedPieceGradient(FILL_LIGHT_SELECTED.ok, ACCENT_LIGHT_B),
      bad: selectedPieceGradient(FILL_LIGHT_SELECTED.bad, ACCENT_LIGHT_B),
    },
  },
  dark: {
    w: {
      good: selectedPieceGradient(FILL_DARK_SELECTED.good, ACCENT_DARK_W),
      ok: selectedPieceGradient(FILL_DARK_SELECTED.ok, ACCENT_DARK_W),
      bad: selectedPieceGradient(FILL_DARK_SELECTED.bad, ACCENT_DARK_W),
    },
    b: {
      good: selectedPieceGradient(FILL_DARK_SELECTED.good, ACCENT_DARK_B),
      ok: selectedPieceGradient(FILL_DARK_SELECTED.ok, ACCENT_DARK_B),
      bad: selectedPieceGradient(FILL_DARK_SELECTED.bad, ACCENT_DARK_B),
    },
  },
}

export function moveHintStyle(
  tier: MoveQuality,
  opts?: { selected?: boolean; theme?: UiTheme },
): CSSProperties {
  const selected = Boolean(opts?.selected)
  const theme = opts?.theme ?? 'dark'
  if (!selected) {
    return theme === 'light' ? HINT_BG_LIGHT[tier] : HINT_BG_DARK[tier]
  }
  const table = fillTable(theme, true)
  return { backgroundColor: table[tier] }
}

/** Selected piece: emphasize with a second tint layer (no border). */
export function selectedPieceHintStyle(
  tier: MoveQuality,
  playerColor: 'w' | 'b',
  theme: UiTheme = 'dark',
): CSSProperties {
  return SELECTED_PIECE[theme][playerColor][tier]
}
