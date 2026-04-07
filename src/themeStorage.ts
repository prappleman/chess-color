export type UiTheme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'chess-color-theme'

export function getStoredTheme(): UiTheme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* private mode */
  }
  return 'dark'
}

export function setStoredTheme(theme: UiTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyThemeToDocument(theme: UiTheme): void {
  document.documentElement.dataset.theme = theme
}

export const BOARD_COLOR_SETTINGS_KEY = 'chess-color-board-colors'

export type BoardColorSettings = {
  /** Engine tint on legal destination squares (green / blue / red). */
  moveColors: boolean
  /** Engine tint on the selected piece’s square. */
  pieceColors: boolean
  /** Show strong / best-move (green) tint. */
  hintTierGreen: boolean
  /** Show OK (blue) tint. */
  hintTierBlue: boolean
  /** Show risky (red) tint. */
  hintTierRed: boolean
  /** Show + / # on destinations that give check or checkmate. */
  checkMateSymbols: boolean
}

const DEFAULT_BOARD_COLORS: BoardColorSettings = {
  moveColors: true,
  pieceColors: true,
  hintTierGreen: true,
  hintTierBlue: true,
  hintTierRed: true,
  checkMateSymbols: true,
}

export function getStoredBoardColorSettings(): BoardColorSettings {
  try {
    const raw = localStorage.getItem(BOARD_COLOR_SETTINGS_KEY)
    if (raw) {
      const o = JSON.parse(raw) as Partial<BoardColorSettings>
      const moveColors =
        typeof o.moveColors === 'boolean'
          ? o.moveColors
          : DEFAULT_BOARD_COLORS.moveColors
      const pieceColors =
        typeof o.pieceColors === 'boolean'
          ? o.pieceColors
          : DEFAULT_BOARD_COLORS.pieceColors
      return {
        moveColors,
        pieceColors,
        hintTierGreen:
          typeof o.hintTierGreen === 'boolean'
            ? o.hintTierGreen
            : DEFAULT_BOARD_COLORS.hintTierGreen,
        hintTierBlue:
          typeof o.hintTierBlue === 'boolean'
            ? o.hintTierBlue
            : DEFAULT_BOARD_COLORS.hintTierBlue,
        hintTierRed:
          typeof o.hintTierRed === 'boolean'
            ? o.hintTierRed
            : DEFAULT_BOARD_COLORS.hintTierRed,
        checkMateSymbols:
          typeof o.checkMateSymbols === 'boolean'
            ? o.checkMateSymbols
            : DEFAULT_BOARD_COLORS.checkMateSymbols,
      }
    }
  } catch {
    /* private mode / invalid */
  }
  return { ...DEFAULT_BOARD_COLORS }
}

export function setStoredBoardColorSettings(s: BoardColorSettings): void {
  try {
    localStorage.setItem(BOARD_COLOR_SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}
