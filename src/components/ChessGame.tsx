import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Chess, SQUARES } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Square } from 'chess.js'
import {
  chooseStockfishMove,
  DIFFICULTY_INDEX_MAX,
  difficultyLabel,
  difficultyTargetRating,
} from '../chessBot'
import { classifyLegalDestinations, type MoveQuality } from '../engine/classifyMoves'
import {
  effectiveHintTier,
  moveHintStyle,
  selectedPieceHintStyle,
} from '../engine/moveHintStyle'
import {
  barRatioFromScore,
  evalBarAriaLabel,
  formatWhiteEvalLabel,
} from '../engine/evalBar'
import { StockfishEngine, type ParsedScore } from '../engine/stockfishUci'
import {
  buildInteractionHighlights,
  buildPlayerCheckMateMarks,
} from '../moveSafety'
import {
  applyThemeToDocument,
  getStoredBoardColorSettings,
  getStoredTheme,
  setStoredBoardColorSettings,
  setStoredTheme,
  type UiTheme,
} from '../themeStorage'
import './ChessGame.css'
import { neoPieces } from './neoPieces'
import { PlayAsRandomIcon } from './PlayAsRandomIcon'
import { PLAY_AS_ICON_BLACK, PLAY_AS_ICON_WHITE } from '../playAsIcons'

/** Square hint tints match this palette; board stays bright in both UI themes. */
const BOARD_SURFACE_THEME: UiTheme = 'light'

type PromotionPiece = 'q' | 'r' | 'b' | 'n'

function ThemeSunIcon() {
  return (
    <svg
      className="chess-game__theme-icon"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
      />
    </svg>
  )
}

function ThemeMoonIcon() {
  return (
    <svg
      className="chess-game__theme-icon"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
  )
}

function SettingsGearIcon() {
  return (
    <svg
      className="chess-game__settings-icon"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
      />
    </svg>
  )
}

function gameStatus(chess: Chess): string {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w'
      ? 'Checkmate — Black wins'
      : 'Checkmate — White wins'
  }
  if (chess.isStalemate()) return 'Stalemate — draw'
  if (chess.isDraw()) {
    if (chess.isInsufficientMaterial()) return 'Draw — insufficient material'
    if (chess.isThreefoldRepetition()) return 'Draw — threefold repetition'
    if (chess.isDrawByFiftyMoves()) return 'Draw — fifty-move rule'
    return 'Draw'
  }
  if (chess.isCheck()) {
    return chess.turn() === 'w' ? 'White to move (in check)' : 'Black to move (in check)'
  }
  return chess.turn() === 'w' ? 'White to move' : 'Black to move'
}

function findKingSquare(chess: Chess, color: 'w' | 'b'): Square | null {
  for (const sq of SQUARES) {
    const p = chess.get(sq)
    if (p?.type === 'k' && p.color === color) return sq
  }
  return null
}

/** Ring distance on the grid (square “shells” around the king). */
function chebyshevDistance(a: Square, b: Square): number {
  const fa = a.charCodeAt(0) - 'a'.charCodeAt(0)
  const ra = Number(a.slice(1))
  const fb = b.charCodeAt(0) - 'a'.charCodeAt(0)
  const rb = Number(b.slice(1))
  return Math.max(Math.abs(fa - fb), Math.abs(ra - rb))
}

type HintTierFlags = {
  green: boolean
  blue: boolean
  red: boolean
}

function moveHintStyleAfterTierFilters(
  rawTier: MoveQuality,
  hintsRevealed: boolean,
  tierFlags: HintTierFlags,
): CSSProperties | null {
  const t = effectiveHintTier(rawTier, hintsRevealed)
  if (t === 'good' && !tierFlags.green) return null
  if (t === 'ok' && !tierFlags.blue) return null
  if (t === 'bad' && !tierFlags.red) return null
  return moveHintStyle(t, { theme: BOARD_SURFACE_THEME })
}

function selectedPieceStyleAfterTierFilters(
  rawTier: MoveQuality,
  hintsRevealed: boolean,
  tierFlags: HintTierFlags,
  playerColor: 'w' | 'b',
): CSSProperties | null {
  const t = effectiveHintTier(rawTier, hintsRevealed)
  if (t === 'good' && !tierFlags.green) return null
  if (t === 'ok' && !tierFlags.blue) return null
  if (t === 'bad' && !tierFlags.red) return null
  return selectedPieceHintStyle(t, playerColor, BOARD_SURFACE_THEME)
}

/** Full-board engine tint (respects Moves / Pieces-only filters and tier toggles). */
function buildBoardHintOverlay(
  chess: Chess,
  moveHints: Record<string, MoveQuality> | null,
  moveColorsEnabled: boolean,
  pieceColorsEnabled: boolean,
  playerColor: 'w' | 'b',
  hintsRevealed: boolean,
  tierFlags: HintTierFlags,
): Record<string, CSSProperties> {
  if (!moveHints || (!moveColorsEnabled && !pieceColorsEnabled)) {
    return {}
  }
  const verbose = chess.turn() === playerColor ? chess.moves({ verbose: true }) : []
  const destOnly =
    moveColorsEnabled &&
    !pieceColorsEnabled &&
    verbose.length > 0
      ? new Set(verbose.map((m) => m.to as Square))
      : null
  const fromOnly =
    pieceColorsEnabled &&
    !moveColorsEnabled &&
    verbose.length > 0
      ? new Set(verbose.map((m) => m.from as Square))
      : null
  const out: Record<string, CSSProperties> = {}
  for (const [sq, tier] of Object.entries(moveHints)) {
    if (destOnly && !destOnly.has(sq as Square)) continue
    if (fromOnly && !fromOnly.has(sq as Square)) continue
    const styled = moveHintStyleAfterTierFilters(
      tier as MoveQuality,
      hintsRevealed,
      tierFlags,
    )
    if (!styled) continue
    out[sq] = styled
  }
  return out
}

const START_FEN = new Chess().fen()

/** Stable empty `squareStyles` object to avoid allocating new `{}` each memo pass. */
const EMPTY_SQUARE_STYLES: Record<string, CSSProperties> = {}

/** You checkmated the opponent — win (green). */
const MATE_RING_STATIC_WIN: Readonly<CSSProperties> = Object.freeze({
  backgroundColor: 'rgba(34, 197, 94, 0.42)',
})

/** You were checkmated — loss (red). */
const MATE_RING_STATIC_LOSS: Readonly<CSSProperties> = Object.freeze({
  backgroundColor: 'rgba(239, 68, 68, 0.42)',
})

/** Clears hint tint so Chess.com-style dots show on the bare square. */
const DEST_LAYER_CLEAR: CSSProperties = {
  backgroundColor: 'transparent',
  backgroundImage: 'none',
}

function ChessGame() {
  const [fen, setFen] = useState(() => START_FEN)
  const [, setMoveHistory] = useState<string[]>([])
  const moveHistoryRef = useRef<string[]>([])
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w')
  const [playAsChoice, setPlayAsChoice] = useState<'w' | 'b' | 'random'>('w')
  const [botDifficulty, setBotDifficulty] = useState(12)
  const [isBotThinking, setIsBotThinking] = useState(false)
  const engineRef = useRef<StockfishEngine | null>(null)
  const evalEngineRef = useRef<StockfishEngine | null>(null)
  const analysisGenRef = useRef(0)
  const evalBarGenRef = useRef(0)
  const [engineStatus, setEngineStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('loading')
  const [engineError, setEngineError] = useState<string | null>(null)
  const [evalBarReady, setEvalBarReady] = useState(false)
  const [evalBarSnapshot, setEvalBarSnapshot] = useState<{
    score: ParsedScore
    stm: 'w' | 'b'
  } | null>(null)
  const [evalBarBusy, setEvalBarBusy] = useState(false)
  const [moveHints, setMoveHints] = useState<Record<string, MoveQuality> | null>(
    null,
  )
  const [gameStarted, setGameStarted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moveColorsEnabled, setMoveColorsEnabled] = useState(
    () => getStoredBoardColorSettings().moveColors,
  )
  const [pieceColorsEnabled, setPieceColorsEnabled] = useState(
    () => getStoredBoardColorSettings().pieceColors,
  )
  const [hintTierGreen, setHintTierGreen] = useState(
    () => getStoredBoardColorSettings().hintTierGreen,
  )
  const [hintTierBlue, setHintTierBlue] = useState(
    () => getStoredBoardColorSettings().hintTierBlue,
  )
  const [hintTierRed, setHintTierRed] = useState(
    () => getStoredBoardColorSettings().hintTierRed,
  )
  const [checkMateSymbolsEnabled, setCheckMateSymbolsEnabled] = useState(
    () => getStoredBoardColorSettings().checkMateSymbols,
  )
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => getStoredTheme())
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(
    null,
  )
  const boardWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = boardWrapRef.current
    if (!el) return
    const preventSelect = (e: Event) => e.preventDefault()
    el.addEventListener('selectstart', preventSelect, true)
    return () => el.removeEventListener('selectstart', preventSelect, true)
  }, [])

  useEffect(() => {
    applyThemeToDocument(uiTheme)
    setStoredTheme(uiTheme)
  }, [uiTheme])

  useEffect(() => {
    setStoredBoardColorSettings({
      moveColors: moveColorsEnabled,
      pieceColors: pieceColorsEnabled,
      hintTierGreen,
      hintTierBlue,
      hintTierRed,
      checkMateSymbols: checkMateSymbolsEnabled,
    })
  }, [
    moveColorsEnabled,
    pieceColorsEnabled,
    hintTierGreen,
    hintTierBlue,
    hintTierRed,
    checkMateSymbolsEnabled,
  ])

  const chess = useMemo(() => {
    const c = new Chess()
    c.load(fen)
    return c
  }, [fen])

  useEffect(() => {
    if (!gameStarted || !settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameStarted, settingsOpen])

  const gameOver = chess.isGameOver()
  const [moveSquares, setMoveSquares] = useState<
    Record<string, CSSProperties>
  >({})
  const [interactionMarks, setInteractionMarks] = useState<
    Record<string, '+' | '#'>
  >({})
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)

  const legalDestKinds = useMemo(() => {
    if (!selectedSquare) return null
    const c = new Chess()
    try {
      c.load(fen)
    } catch {
      return null
    }
    if (c.turn() !== playerColor) return null
    const moves = c.moves({ square: selectedSquare, verbose: true })
    const map: Record<string, 'empty' | 'capture'> = {}
    for (const m of moves) {
      map[m.to] = m.captured ? 'capture' : 'empty'
    }
    return map
  }, [fen, selectedSquare, playerColor])

  const clearPieceFocus = useCallback(() => {
    setMoveSquares({})
    setInteractionMarks({})
    setSelectedSquare(null)
  }, [])

  const appendSan = useCallback((san: string) => {
    setMoveHistory((h) => {
      const n = [...h, san]
      moveHistoryRef.current = n
      return n
    })
  }, [])

  const focusPieceAt = useCallback(
    (square: Square) => {
      const c = new Chess()
      try {
        c.load(fen)
      } catch {
        return
      }
      const moves = c.moves({ square, verbose: true })
      const { marks } = buildInteractionHighlights(fen, square, playerColor)
      const marksToShow = checkMateSymbolsEnabled ? marks : {}
      if (!pieceColorsEnabled && !moveColorsEnabled) {
        const styles: Record<string, CSSProperties> = {}
        for (const m of moves) {
          styles[m.to] = DEST_LAYER_CLEAR
        }
        setMoveSquares(styles)
        setInteractionMarks(marksToShow)
        setSelectedSquare(square)
        return
      }

      const styles: Record<string, CSSProperties> = {}
      if (pieceColorsEnabled) {
        const ps = selectedPieceStyleAfterTierFilters(
          moveHints?.[square] ?? 'ok',
          true,
          {
            green: hintTierGreen,
            blue: hintTierBlue,
            red: hintTierRed,
          },
          playerColor,
        )
        if (ps) styles[square] = ps
      }
      for (const m of moves) {
        styles[m.to] = DEST_LAYER_CLEAR
      }
      setMoveSquares(styles)
      setInteractionMarks(marksToShow)
      setSelectedSquare(square)
    },
    [
      fen,
      playerColor,
      moveHints,
      moveColorsEnabled,
      pieceColorsEnabled,
      hintTierGreen,
      hintTierBlue,
      hintTierRed,
      checkMateSymbolsEnabled,
    ],
  )

  useEffect(() => {
    const c = new Chess()
    c.load(fen)
    if (c.turn() !== playerColor) {
      const t = window.setTimeout(() => {
        setMoveSquares({})
        setInteractionMarks({})
        setSelectedSquare(null)
      }, 0)
      return () => window.clearTimeout(t)
    }
  }, [fen, playerColor])

  useEffect(() => {
    let cancelled = false
    const workerUrl = `${import.meta.env.BASE_URL}stockfish/stockfish.js`
    const eng = new StockfishEngine(workerUrl)
    eng
      .init()
      .then(() => {
        if (cancelled) {
          eng.dispose()
          return
        }
        engineRef.current = eng
        setEngineStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) {
          eng.dispose()
          return
        }
        setEngineStatus('error')
        setEngineError(e instanceof Error ? e.message : String(e))
        eng.dispose()
      })
    return () => {
      cancelled = true
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- second worker tracks main engine readiness */
  useEffect(() => {
    if (engineStatus !== 'ready') {
      evalEngineRef.current?.dispose()
      evalEngineRef.current = null
      setEvalBarReady(false)
      return
    }
    let cancelled = false
    const workerUrl = `${import.meta.env.BASE_URL}stockfish/stockfish.js`
    const ev = new StockfishEngine(workerUrl)
    ev.init()
      .then(() => {
        if (cancelled) {
          ev.dispose()
          return
        }
        evalEngineRef.current = ev
        setEvalBarReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          ev.dispose()
          setEvalBarReady(false)
        }
      })
    return () => {
      cancelled = true
      evalEngineRef.current?.dispose()
      evalEngineRef.current = null
      setEvalBarReady(false)
    }
  }, [engineStatus])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (
      !gameStarted ||
      gameOver ||
      promotion ||
      engineStatus !== 'ready' ||
      !engineRef.current
    )
      return
    const c = new Chess()
    try {
      c.load(fen)
    } catch {
      return
    }
    if (c.turn() === playerColor) return

    let cancelled = false
    let moveTimeout: ReturnType<typeof window.setTimeout> | undefined

    const startTimeout = window.setTimeout(() => {
      if (cancelled) return
      setIsBotThinking(true)
      moveTimeout = window.setTimeout(() => {
        if (cancelled) return
        const eng = engineRef.current
        if (!eng) {
          setIsBotThinking(false)
          return
        }
        chooseStockfishMove(eng, fen, botDifficulty)
          .then((san) => {
            if (cancelled) return
            if (!san) {
              setIsBotThinking(false)
              return
            }
            const next = new Chess()
            next.load(fen)
            const played = next.move(san)
            if (played) {
              setFen(next.fen())
              setMoveHistory((h) => {
                const n = [...h, played.san]
                moveHistoryRef.current = n
                return n
              })
            }
            setIsBotThinking(false)
          })
          .catch(() => {
            if (!cancelled) setIsBotThinking(false)
          })
      }, 200)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(startTimeout)
      if (moveTimeout !== undefined) window.clearTimeout(moveTimeout)
    }
  }, [
    gameStarted,
    fen,
    playerColor,
    botDifficulty,
    gameOver,
    promotion,
    engineStatus,
  ])

  /* eslint-disable react-hooks/set-state-in-effect -- sync clear when FEN/turn/engine cannot analyze */
  useEffect(() => {
    if (!gameStarted) {
      setMoveHints(null)
      return
    }
    if (engineStatus !== 'ready' || !engineRef.current) {
      setMoveHints(null)
      return
    }
    if (gameOver || promotion) {
      setMoveHints(null)
      return
    }
    if (!moveColorsEnabled && !pieceColorsEnabled) {
      setMoveHints(null)
      return
    }
    const c = new Chess()
    try {
      c.load(fen)
    } catch {
      setMoveHints(null)
      return
    }
    if (c.turn() !== playerColor) {
      setMoveHints(null)
      return
    }

    const gen = ++analysisGenRef.current
    const ac = new AbortController()
    classifyLegalDestinations(engineRef.current, fen, playerColor, ac.signal)
      .then((res) => {
        if (analysisGenRef.current === gen) setMoveHints(res)
      })
      .catch(() => {
        if (analysisGenRef.current === gen) setMoveHints(null)
      })
    return () => ac.abort()
  }, [
    gameStarted,
    fen,
    playerColor,
    gameOver,
    promotion,
    engineStatus,
    moveColorsEnabled,
    pieceColorsEnabled,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (
      !gameStarted ||
      !evalBarReady ||
      engineStatus !== 'ready' ||
      !evalEngineRef.current
    ) {
      return
    }
    const c = new Chess()
    try {
      c.load(fen)
    } catch {
      return
    }
    const stm = c.turn()
    const gen = ++evalBarGenRef.current
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- eval refresh tick
    setEvalBarBusy(true)
    evalEngineRef.current
      .analyzeFen(fen, { movetime: 160 })
      .then((res) => {
        if (cancelled || evalBarGenRef.current !== gen) return
        setEvalBarSnapshot({ score: res.score, stm })
        setEvalBarBusy(false)
      })
      .catch(() => {
        if (cancelled || evalBarGenRef.current !== gen) return
        setEvalBarBusy(false)
      })
    return () => {
      cancelled = true
      evalBarGenRef.current += 1
    }
  }, [fen, gameStarted, evalBarReady, engineStatus])

  useEffect(() => {
    if (!selectedSquare || engineStatus !== 'ready') return
    const t = window.setTimeout(() => focusPieceAt(selectedSquare), 0)
    return () => window.clearTimeout(t)
  }, [
    moveHints,
    selectedSquare,
    engineStatus,
    focusPieceAt,
    checkMateSymbolsEnabled,
  ])

  const onPieceDrag = useCallback(
    ({
      square,
      piece,
    }: {
      square: string | null
      piece: { pieceType: string }
      isSparePiece: boolean
    }) => {
      if (
        !square ||
        !gameStarted ||
        gameOver ||
        promotion ||
        isBotThinking
      )
        return
      const side = piece.pieceType[0] === 'w' ? 'w' : 'b'
      const c = new Chess()
      c.load(fen)
      if (side !== playerColor || c.turn() !== playerColor) return
      const sq = square as Square
      // Defer highlights until after dnd-kit measures the drag overlay; a sync
      // setState here used to re-render the board during drag start and skew the
      // cursor ↔ piece alignment (with default scale(1.2) on the overlay).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => focusPieceAt(sq))
      })
    },
    [
      fen,
      gameStarted,
      gameOver,
      promotion,
      isBotThinking,
      playerColor,
      focusPieceAt,
    ],
  )

  const tryRegularMove = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      const next = new Chess()
      next.load(fen)
      const result = next.move({ from: sourceSquare, to: targetSquare })
      if (!result) return false
      setFen(next.fen())
      appendSan(result.san)
      return true
    },
    [fen, appendSan],
  )

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string
      targetSquare: string | null
    }): boolean => {
      if (
        !targetSquare ||
        !gameStarted ||
        gameOver ||
        promotion ||
        isBotThinking
      )
        return false

      const c = new Chess()
      c.load(fen)
      if (c.turn() !== playerColor) return false
      const candidates = c
        .moves({ verbose: true })
        .filter((m) => m.from === sourceSquare && m.to === targetSquare)

      if (candidates.length === 0) return false

      if (candidates.some((m) => m.promotion)) {
        setPromotion({
          from: sourceSquare as Square,
          to: targetSquare as Square,
        })
        clearPieceFocus()
        return false
      }

      const ok = tryRegularMove(sourceSquare as Square, targetSquare as Square)
      if (ok) clearPieceFocus()
      return ok
    },
    [
      fen,
      gameStarted,
      gameOver,
      promotion,
      isBotThinking,
      playerColor,
      clearPieceFocus,
      tryRegularMove,
    ],
  )

  const completePromotion = useCallback(
    (piece: PromotionPiece) => {
      if (!promotion) return
      const next = new Chess()
      next.load(fen)
      const result = next.move({
        from: promotion.from,
        to: promotion.to,
        promotion: piece,
      })
      if (result) {
        setFen(next.fen())
        appendSan(result.san)
        clearPieceFocus()
      }
      setPromotion(null)
    },
    [fen, promotion, clearPieceFocus, appendSan],
  )

  const cancelPromotion = useCallback(() => {
    const from = promotion?.from
    setPromotion(null)
    if (from) focusPieceAt(from)
    else clearPieceFocus()
  }, [promotion, focusPieceAt, clearPieceFocus])

  const startGame = useCallback(() => {
    if (playAsChoice === 'random') {
      setPlayerColor(Math.random() < 0.5 ? 'w' : 'b')
    }
    setGameStarted(true)
    setSettingsOpen(false)
  }, [playAsChoice])

  const newGame = useCallback(() => {
    setPromotion(null)
    clearPieceFocus()
    setSettingsOpen(false)
    setEvalBarSnapshot(null)
    setFen(START_FEN)
    setMoveHistory([])
    moveHistoryRef.current = []
  }, [clearPieceFocus])

  const handlePlayAsChoiceChange = useCallback(
    (choice: 'w' | 'b' | 'random') => {
      setPlayAsChoice(choice)
      if (choice !== 'random') {
        setPlayerColor(choice)
      }
      setPromotion(null)
      clearPieceFocus()
      setEvalBarSnapshot(null)
      setMoveHistory([])
      moveHistoryRef.current = []
      setFen(START_FEN)
    },
    [clearPieceFocus],
  )

  const canDragPiece = useCallback(
    ({
      piece,
    }: {
      piece: { pieceType: string }
      isSparePiece: boolean
      square: string | null
    }) => {
      if (
        !gameStarted ||
        gameOver ||
        promotion ||
        isBotThinking
      )
        return false
      const side = piece.pieceType[0] === 'w' ? 'w' : 'b'
      const c = new Chess()
      c.load(fen)
      return side === playerColor && side === c.turn()
    },
    [fen, gameStarted, gameOver, promotion, isBotThinking, playerColor],
  )

  const onSquareClick = useCallback(
    ({
      square,
      piece,
    }: {
      square: string
      piece: { pieceType: string } | null
    }) => {
      if (!gameStarted || gameOver || promotion || isBotThinking)
        return
      const c = new Chess()
      c.load(fen)
      if (c.turn() !== playerColor) return

      const sq = square as Square
      const own = piece && piece.pieceType[0] === playerColor

      if (selectedSquare) {
        if (sq === selectedSquare) {
          clearPieceFocus()
          return
        }
        if (own) {
          focusPieceAt(sq)
          return
        }
        const candidates = c
          .moves({ verbose: true })
          .filter((m) => m.from === selectedSquare && m.to === sq)
        if (candidates.length === 0) {
          clearPieceFocus()
          return
        }
        if (candidates.some((m) => m.promotion)) {
          setPromotion({ from: selectedSquare, to: sq })
          clearPieceFocus()
          return
        }
        const next = new Chess()
        next.load(fen)
        const played = next.move({ from: selectedSquare, to: sq })
        if (played) {
          setFen(next.fen())
          appendSan(played.san)
          clearPieceFocus()
        }
      } else if (own) {
        focusPieceAt(sq)
      }
    },
    [
      fen,
      gameStarted,
      gameOver,
      promotion,
      isBotThinking,
      playerColor,
      selectedSquare,
      clearPieceFocus,
      focusPieceAt,
      appendSan,
    ],
  )

  const playerDestMarks = useMemo(
    () =>
      checkMateSymbolsEnabled
        ? buildPlayerCheckMateMarks(fen, playerColor)
        : {},
    [fen, playerColor, checkMateSymbolsEnabled],
  )

  const mergedSquareStyles = useMemo(() => {
    if (chess.isCheckmate()) {
      const mated = chess.turn()
      const kingSq = findKingSquare(chess, mated)
      if (!kingSq) return EMPTY_SQUARE_STYLES
      const playerWon = mated !== playerColor
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

      const perRingDelayS = 0.095
      const ringDurationS = 0.4
      const ringAnim = playerWon
        ? 'chess-game-mate-square-ring-win'
        : 'chess-game-mate-square-ring-loss'
      const out: Record<string, CSSProperties> = {}

      for (const sq of SQUARES) {
        const ring = chebyshevDistance(sq as Square, kingSq)
        if (reduceMotion) {
          out[sq] = playerWon ? MATE_RING_STATIC_WIN : MATE_RING_STATIC_LOSS
        } else {
          out[sq] = {
            animation: `${ringAnim} ${ringDurationS}s ease-out forwards`,
            animationDelay: `${ring * perRingDelayS}s`,
          }
        }
      }
      return out
    }

    const base = buildBoardHintOverlay(
      chess,
      moveHints,
      moveColorsEnabled,
      pieceColorsEnabled,
      playerColor,
      true,
      {
        green: hintTierGreen,
        blue: hintTierBlue,
        red: hintTierRed,
      },
    )

    if (Object.keys(moveSquares).length > 0) {
      return { ...base, ...moveSquares }
    }

    return Object.keys(base).length > 0 ? base : EMPTY_SQUARE_STYLES
  }, [
    chess,
    moveSquares,
    moveHints,
    moveColorsEnabled,
    pieceColorsEnabled,
    playerColor,
    hintTierGreen,
    hintTierBlue,
    hintTierRed,
  ])

  const mergedMarks = useMemo(() => {
    if (!checkMateSymbolsEnabled) return {}
    if (Object.keys(interactionMarks).length > 0) return interactionMarks
    return playerDestMarks
  }, [checkMateSymbolsEnabled, playerDestMarks, interactionMarks])

  const boardOptions = useMemo(() => {
    /* Light / dark square pair (user palette). */
    const brightLight = '#ecd6b1'
    const brightDark = '#b48664'
    return {
      id: 'chess-game',
      pieces: neoPieces,
      position: fen,
      boardOrientation: playerColor === 'w' ? ('white' as const) : ('black' as const),
      allowDragging:
        gameStarted &&
        !gameOver &&
        !promotion &&
        !isBotThinking &&
        engineStatus === 'ready',
      // Default library style is scale(1.2); it breaks snapCenterToCursor alignment.
      draggingPieceStyle: { transform: 'none' },
      canDragPiece,
      onPieceDrag,
      onPieceDrop,
      onSquareClick,
      squareStyles: mergedSquareStyles,
      squareRenderer: ({
        square,
        children,
      }: {
        square: string
        children?: ReactNode
      }) => {
        const mark = mergedMarks[square]
        const layer = mergedSquareStyles[square]
        const pieceLift = selectedSquare === square
        const destKind = legalDestKinds?.[square]
        const showMoveDot =
          Boolean(destKind) && selectedSquare !== square
        return (
          <div
            className={
              pieceLift ? 'chess-game__sq chess-game__sq--piece-selected' : 'chess-game__sq'
            }
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              boxSizing: 'border-box',
              ...(layer ?? {}),
            }}
          >
            {showMoveDot && destKind === 'capture' ? (
              <span
                className="chess-game__move-dot chess-game__move-dot--capture"
                aria-hidden
              />
            ) : null}
            {pieceLift ? (
              <span className="chess-game__piece-lift">{children}</span>
            ) : (
              children
            )}
            {showMoveDot && destKind === 'empty' ? (
              <span
                className="chess-game__move-dot chess-game__move-dot--empty"
                aria-hidden
              />
            ) : null}
            {mark ? (
              <span
                className="chess-game__sq-ann"
                aria-label={mark === '#' ? 'Checkmate' : 'Check'}
              >
                {mark}
              </span>
            ) : null}
          </div>
        )
      },
      showNotation: true,
      /* Same hues as the tiles: dark-tile color on light squares, light-tile color on dark squares. */
      lightSquareNotationStyle: {
        color: brightDark,
        fontWeight: 700,
      },
      darkSquareNotationStyle: {
        color: brightLight,
        fontWeight: 700,
      },
      /* Tight to the square corners (file bottom-right, rank top-left). */
      alphaNotationStyle: {
        position: 'absolute' as const,
        bottom: 2,
        right: 3,
        fontSize: 'clamp(9px, 2.5vmin, 13px)',
        lineHeight: 1,
        fontWeight: 700,
        userSelect: 'none' as const,
      },
      numericNotationStyle: {
        position: 'absolute' as const,
        top: 2,
        left: 3,
        fontSize: 'clamp(9px, 2.5vmin, 13px)',
        lineHeight: 1,
        fontWeight: 700,
        userSelect: 'none' as const,
      },
      boardStyle: {
        width: '100%',
        maxWidth: 'min(100%, 560px)',
        margin: 0,
        borderRadius: '6px',
        boxShadow: 'none',
        border: 'none',
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        gridAutoRows: 'minmax(0, 1fr)',
        gap: 0,
        rowGap: 0,
        columnGap: 0,
        overflow: 'hidden' as const,
      },
      squareStyle: {
        boxSizing: 'border-box' as const,
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      },
      darkSquareStyle: { backgroundColor: brightDark },
      lightSquareStyle: { backgroundColor: brightLight },
    }
  }, [
    fen,
    gameStarted,
    gameOver,
    promotion,
    isBotThinking,
    engineStatus,
    playerColor,
    canDragPiece,
    onPieceDrag,
    onPieceDrop,
    onSquareClick,
    mergedSquareStyles,
    mergedMarks,
    selectedSquare,
    legalDestKinds,
  ])

  const evalBarVisual = useMemo(() => {
    if (!evalBarSnapshot) {
      return {
        ratio: 0.5,
        label: evalBarBusy ? '…' : '—',
        aria: evalBarBusy
          ? 'Engine is evaluating the position. White on the left.'
          : 'Evaluation not available yet. White on the left.',
      }
    }
    const ratio = barRatioFromScore(evalBarSnapshot.score, evalBarSnapshot.stm)
    const label = formatWhiteEvalLabel(
      evalBarSnapshot.score,
      evalBarSnapshot.stm,
    )
    const aria = evalBarAriaLabel(
      evalBarSnapshot.score,
      evalBarSnapshot.stm,
      label,
    )
    return { ratio, label, aria }
  }, [evalBarSnapshot, evalBarBusy])

  const showSettingsOverlay = !gameStarted || settingsOpen
  const setupStatusText =
    engineStatus === 'loading'
      ? 'Loading chess engine…'
      : engineStatus === 'error'
        ? `Engine failed to load${engineError ? `: ${engineError}` : ''}`
        : 'Ready when you are.'

  useEffect(() => {
    if (!showSettingsOverlay) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showSettingsOverlay])

  return (
    <div className={gameStarted ? 'chess-game chess-game--playing' : 'chess-game'}>
      {gameStarted ? (
        <div className="chess-game__title-bar">
          <h1 className="chess-game__title">Chess</h1>
        </div>
      ) : null}
      <button
        type="button"
        className="chess-game__theme-fab"
        onClick={() => setUiTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        aria-label={
          uiTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        }
        title={
          uiTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        }
      >
        {uiTheme === 'dark' ? <ThemeSunIcon /> : <ThemeMoonIcon />}
      </button>
      <div
        className={
          gameStarted ? 'chess-game__main chess-game__main--centered' : 'chess-game__main'
        }
      >
        {gameStarted ? (
          <header className="chess-game__header">
            <p className="chess-game__status" role="status">
              {engineStatus === 'error'
                ? `Engine failed to load${engineError ? `: ${engineError}` : ''}`
                : isBotThinking
                  ? 'Opponent is thinking…'
                  : gameStatus(chess)}
            </p>
            {checkMateSymbolsEnabled ? (
              <p className="chess-game__legend">
                <span className="chess-game__legend-marks">
                  <span className="chess-game__legend-mark">+</span> check
                  <span className="chess-game__legend-mark">#</span> mate
                </span>
              </p>
            ) : null}
          </header>
        ) : null}

        <div
          className={
            gameStarted && evalBarReady
              ? 'chess-game__board-row chess-game__board-row--with-eval'
              : 'chess-game__board-row'
          }
        >
          {gameStarted && evalBarReady ? (
            <div className="chess-game__eval-row">
              <div className="chess-game__eval-row-main">
                <span className="chess-game__eval-axis chess-game__eval-axis--side">
                  W
                </span>
                <div
                  className={
                    evalBarBusy
                      ? 'chess-game__eval-bar chess-game__eval-bar--horizontal chess-game__eval-bar--busy'
                      : 'chess-game__eval-bar chess-game__eval-bar--horizontal'
                  }
                  role="img"
                  aria-label={evalBarVisual.aria}
                >
                  <div
                    className="chess-game__eval-bar-white"
                    style={{
                      flex: `${evalBarVisual.ratio} 1 0%`,
                      minWidth: 2,
                    }}
                  />
                  <div
                    className="chess-game__eval-bar-black"
                    style={{
                      flex: `${Math.max(1e-6, 1 - evalBarVisual.ratio)} 1 0%`,
                      minWidth: 2,
                    }}
                  />
                </div>
                <span className="chess-game__eval-axis chess-game__eval-axis--side">
                  B
                </span>
              </div>
              <span
                className={
                  evalBarBusy && evalBarSnapshot
                    ? 'chess-game__eval-value chess-game__eval-value--stale'
                    : 'chess-game__eval-value'
                }
                aria-hidden
              >
                {evalBarVisual.label}
              </span>
            </div>
          ) : null}
          <div
            ref={boardWrapRef}
            className="chess-game__board-wrap chess-game__board-wrap--framed notranslate"
            translate="no"
          >
            <Chessboard options={boardOptions} />
            {promotion ? (
              <div
                className="chess-game__promo-overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Choose promotion piece"
              >
                <div className="chess-game__promo-card">
                  <p className="chess-game__promo-title">Promote pawn</p>
                  <div className="chess-game__promo-buttons">
                    <button
                      type="button"
                      className="chess-game__promo-btn"
                      onClick={() => completePromotion('q')}
                      aria-label="Queen"
                    >
                      ♕ Queen
                    </button>
                    <button
                      type="button"
                      className="chess-game__promo-btn"
                      onClick={() => completePromotion('r')}
                      aria-label="Rook"
                    >
                      ♖ Rook
                    </button>
                    <button
                      type="button"
                      className="chess-game__promo-btn"
                      onClick={() => completePromotion('b')}
                      aria-label="Bishop"
                    >
                      ♗ Bishop
                    </button>
                    <button
                      type="button"
                      className="chess-game__promo-btn"
                      onClick={() => completePromotion('n')}
                      aria-label="Knight"
                    >
                      ♘ Knight
                    </button>
                  </div>
                  <button
                    type="button"
                    className="chess-game__promo-cancel"
                    onClick={cancelPromotion}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {gameStarted ? (
            <div className="chess-game__board-bottom">
              <div
                className="chess-game__difficulty-box"
                aria-label={`Bot difficulty ${difficultyLabel(botDifficulty)}, rating ${difficultyTargetRating(botDifficulty)}`}
              >
                <span className="chess-game__difficulty-tier">
                  {difficultyLabel(botDifficulty)}
                </span>
                <span className="chess-game__difficulty-sep" aria-hidden />
                <span className="chess-game__difficulty-rating">
                  {difficultyTargetRating(botDifficulty)}
                </span>
              </div>
              <div
                className="chess-game__board-toolbar"
                role="toolbar"
                aria-label="Game actions"
              >
                <button
                  type="button"
                  className="chess-game__new"
                  onClick={newGame}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="chess-game__settings-btn"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Settings"
                  title="Settings"
                  aria-haspopup="dialog"
                >
                  <SettingsGearIcon />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showSettingsOverlay ? (
        <div
          className="chess-game__setup-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chess-setup-title"
          onClick={gameStarted ? () => setSettingsOpen(false) : undefined}
        >
          <div
            className="chess-game__setup-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="chess-setup-title" className="chess-game__setup-title">
              {gameStarted ? 'Settings' : 'Chess'}
            </h2>
            <p className="chess-game__setup-status" role="status">
              {setupStatusText}
            </p>

            <div className="chess-game__setup-body" aria-label="Game options">
              <fieldset
                className="chess-game__fieldset chess-game__fieldset--play-as"
                disabled={gameStarted}
              >
                <legend className="chess-game__legend-title">Play as</legend>
                <div className="chess-game__play-as-row" role="presentation">
                  <label
                    className={`chess-game__play-as-tile chess-game__play-as-tile--light${
                      (gameStarted ? playerColor === 'w' : playAsChoice === 'w')
                        ? ' chess-game__play-as-tile--selected'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="play-as-setup"
                      checked={
                        gameStarted
                          ? playerColor === 'w'
                          : playAsChoice === 'w'
                      }
                      onChange={() => handlePlayAsChoiceChange('w')}
                      aria-label="Play as White"
                    />
                    <img
                      className="chess-game__play-as-piece-img"
                      src={PLAY_AS_ICON_WHITE}
                      alt=""
                      width={48}
                      height={48}
                      draggable={false}
                    />
                  </label>
                  <label
                    className={`chess-game__play-as-tile chess-game__play-as-tile--random${
                      !gameStarted && playAsChoice === 'random'
                        ? ' chess-game__play-as-tile--selected'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="play-as-setup"
                      checked={
                        !gameStarted && playAsChoice === 'random'
                      }
                      onChange={() => handlePlayAsChoiceChange('random')}
                      aria-label="Random side"
                    />
                    <PlayAsRandomIcon className="chess-game__play-as-piece-img" />
                  </label>
                  <label
                    className={`chess-game__play-as-tile chess-game__play-as-tile--dark${
                      (gameStarted ? playerColor === 'b' : playAsChoice === 'b')
                        ? ' chess-game__play-as-tile--selected'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="play-as-setup"
                      checked={
                        gameStarted
                          ? playerColor === 'b'
                          : playAsChoice === 'b'
                      }
                      onChange={() => handlePlayAsChoiceChange('b')}
                      aria-label="Play as Black"
                    />
                    <img
                      className="chess-game__play-as-piece-img"
                      src={PLAY_AS_ICON_BLACK}
                      alt=""
                      width={48}
                      height={48}
                      draggable={false}
                    />
                  </label>
                </div>
              </fieldset>

              <div className="chess-game__slider-block">
                <div className="chess-game__slider-readout">
                  <span
                    id="bot-difficulty-tier"
                    className="chess-game__slider-tier"
                  >
                    {difficultyLabel(botDifficulty)}
                  </span>
                  <span
                    id="bot-difficulty-rating"
                    className="chess-game__slider-rating"
                  >
                    {difficultyTargetRating(botDifficulty)}
                  </span>
                </div>
                <input
                  id="bot-difficulty-setup"
                  className="chess-game__slider"
                  type="range"
                  min={0}
                  max={DIFFICULTY_INDEX_MAX}
                  value={botDifficulty}
                  aria-labelledby="bot-difficulty-tier bot-difficulty-rating"
                  aria-valuetext={`${difficultyLabel(botDifficulty)} ${difficultyTargetRating(botDifficulty)}`}
                  style={
                    {
                      '--slider-fill-pct': `${(botDifficulty / DIFFICULTY_INDEX_MAX) * 100}%`,
                    } as CSSProperties
                  }
                  onChange={(e) => setBotDifficulty(Number(e.target.value))}
                />
              </div>

              <fieldset className="chess-game__fieldset chess-game__fieldset--board-colors">
                <legend className="chess-game__legend-title">Board colors</legend>
                <div className="chess-game__switch-stack chess-game__switch-stack--engine-surfaces">
                  <label className="chess-game__switch-row">
                    <span className="chess-game__switch-text">
                      <span className="chess-game__switch-title">Pieces</span>
                      <span className="chess-game__switch-desc">
                        Engine quality on the selected square
                      </span>
                    </span>
                    <span className="chess-game__switch-wrap">
                      <input
                        type="checkbox"
                        className="chess-game__switch-input"
                        role="switch"
                        checked={pieceColorsEnabled}
                        onChange={(e) =>
                          setPieceColorsEnabled(e.target.checked)
                        }
                        aria-label="Pieces: engine quality on selected square"
                      />
                      <span className="chess-game__switch-track" aria-hidden />
                    </span>
                  </label>
                  <label className="chess-game__switch-row">
                    <span className="chess-game__switch-text">
                      <span className="chess-game__switch-title">Moves</span>
                      <span className="chess-game__switch-desc">
                        Engine quality on legal destinations
                      </span>
                    </span>
                    <span className="chess-game__switch-wrap">
                      <input
                        type="checkbox"
                        className="chess-game__switch-input"
                        role="switch"
                        checked={moveColorsEnabled}
                        onChange={(e) =>
                          setMoveColorsEnabled(e.target.checked)
                        }
                        aria-label="Moves: engine quality on destination squares"
                      />
                      <span className="chess-game__switch-track" aria-hidden />
                    </span>
                  </label>
                  <label className="chess-game__switch-row">
                    <span className="chess-game__switch-text">
                      <span className="chess-game__switch-title">Check / mate</span>
                      <span className="chess-game__switch-desc">
                        + and # on destinations
                      </span>
                    </span>
                    <span className="chess-game__switch-wrap">
                      <input
                        type="checkbox"
                        className="chess-game__switch-input"
                        role="switch"
                        checked={checkMateSymbolsEnabled}
                        onChange={(e) =>
                          setCheckMateSymbolsEnabled(e.target.checked)
                        }
                        aria-label="Show check and checkmate symbols on squares"
                      />
                      <span className="chess-game__switch-track" aria-hidden />
                    </span>
                  </label>
                </div>
                <div
                  className="chess-game__board-colors-divider"
                  role="separator"
                  aria-hidden
                />
                <div className="chess-game__switch-stack chess-game__switch-stack--hint-tiers">
                  <label className="chess-game__switch-row chess-game__switch-row--hint-best">
                    <span className="chess-game__switch-text">
                      <span className="chess-game__switch-title">Best</span>
                      <span className="chess-game__switch-desc">
                        Strong (green)
                      </span>
                    </span>
                    <span className="chess-game__switch-wrap">
                      <input
                        type="checkbox"
                        className="chess-game__switch-input"
                        role="switch"
                        checked={hintTierGreen}
                        onChange={(e) =>
                          setHintTierGreen(e.target.checked)
                        }
                        aria-label="Show best (green) move tint"
                      />
                      <span className="chess-game__switch-track" aria-hidden />
                    </span>
                  </label>
                  <label className="chess-game__switch-row chess-game__switch-row--hint-safe">
                    <span className="chess-game__switch-text">
                      <span className="chess-game__switch-title">Safe</span>
                      <span className="chess-game__switch-desc">
                        OK (blue)
                      </span>
                    </span>
                    <span className="chess-game__switch-wrap">
                      <input
                        type="checkbox"
                        className="chess-game__switch-input"
                        role="switch"
                        checked={hintTierBlue}
                        onChange={(e) =>
                          setHintTierBlue(e.target.checked)
                        }
                        aria-label="Show blue (OK) hints"
                      />
                      <span className="chess-game__switch-track" aria-hidden />
                    </span>
                  </label>
                  <label className="chess-game__switch-row chess-game__switch-row--hint-danger">
                    <span className="chess-game__switch-text">
                      <span className="chess-game__switch-title">Danger</span>
                      <span className="chess-game__switch-desc">
                        Risky (red)
                      </span>
                    </span>
                    <span className="chess-game__switch-wrap">
                      <input
                        type="checkbox"
                        className="chess-game__switch-input"
                        role="switch"
                        checked={hintTierRed}
                        onChange={(e) =>
                          setHintTierRed(e.target.checked)
                        }
                        aria-label="Show red (risky) hints"
                      />
                      <span className="chess-game__switch-track" aria-hidden />
                    </span>
                  </label>
                </div>
              </fieldset>
            </div>

            <div className="chess-game__setup-footer">
              <button
                type="button"
                className="chess-game__setup-primary"
                onClick={gameStarted ? () => setSettingsOpen(false) : startGame}
                disabled={!gameStarted && engineStatus !== 'ready'}
              >
                {gameStarted ? 'Done' : 'Start game'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ChessGame
