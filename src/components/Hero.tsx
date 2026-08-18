import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import {
  moveHintStyle,
  selectedPieceHintStyle,
} from '../engine/moveHintStyle'
import { neoPieces } from './neoPieces'
import './Hero.css'

type HeroProps = {
  onPlay: () => void
  onOpenSettings: () => void
  playDisabled: boolean
  statusText: string
}

const BOARD_LIGHT = '#ecd6b1'
const BOARD_DARK = '#b48664'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const HERO_SQUARE_STYLES = {
  e2: selectedPieceHintStyle('ok', 'w', 'light'),
  e3: moveHintStyle('ok', { theme: 'light' }),
  e4: moveHintStyle('good', { theme: 'light' }),
}

function PlayIcon() {
  return (
    <svg
      className="hero__play-icon"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
    >
      <path fill="currentColor" d="M8 4.5v15l12-7.5z" />
    </svg>
  )
}

export function Hero({
  onPlay,
  onOpenSettings,
  playDisabled,
  statusText,
}: HeroProps) {
  const boardOptions = useMemo(
    () => ({
      id: 'hero-board',
      pieces: neoPieces,
      position: START_FEN,
      allowDragging: false,
      showNotation: true,
      squareStyles: HERO_SQUARE_STYLES,
      lightSquareNotationStyle: {
        color: BOARD_DARK,
        fontWeight: 700,
      },
      darkSquareNotationStyle: {
        color: BOARD_LIGHT,
        fontWeight: 700,
      },
      alphaNotationStyle: {
        position: 'absolute' as const,
        bottom: 2,
        right: 3,
        fontSize: 'clamp(8px, 2.2vmin, 12px)',
        lineHeight: 1,
        fontWeight: 700,
        userSelect: 'none' as const,
      },
      numericNotationStyle: {
        position: 'absolute' as const,
        top: 2,
        left: 3,
        fontSize: 'clamp(8px, 2.2vmin, 12px)',
        lineHeight: 1,
        fontWeight: 700,
        userSelect: 'none' as const,
      },
      boardStyle: {
        width: '100%',
        margin: 0,
        borderRadius: '6px',
        boxShadow: 'none',
        border: 'none',
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        gridAutoRows: 'minmax(0, 1fr)',
        gap: 0,
        overflow: 'hidden' as const,
      },
      squareStyle: {
        boxSizing: 'border-box' as const,
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      },
      darkSquareStyle: { backgroundColor: BOARD_DARK },
      lightSquareStyle: { backgroundColor: BOARD_LIGHT },
    }),
    [],
  )

  return (
    <div className="hero">
      <div className="hero__layout">
        <div className="hero__copy">
          <p className="hero__eyebrow">Chess Color</p>
          <h1 className="hero__title">See every move in color</h1>
          <p className="hero__lede">
            Jump in against a 250 Elo beginner bot. Green, blue, and red show
            how strong each move is.
          </p>
          <div className="hero__swatches" aria-hidden>
            <span className="hero__swatch hero__swatch--best" />
            <span className="hero__swatch hero__swatch--safe" />
            <span className="hero__swatch hero__swatch--danger" />
          </div>
          <div className="hero__actions">
            <button
              type="button"
              className="hero__play"
              onClick={onPlay}
              disabled={playDisabled}
            >
              <PlayIcon />
              Play
            </button>
            <button
              type="button"
              className="hero__settings"
              onClick={onOpenSettings}
            >
              Settings
            </button>
          </div>
          {statusText ? (
            <p className="hero__status" role="status">
              {statusText}
            </p>
          ) : null}
        </div>
        <div className="hero__board-wrap notranslate" translate="no" aria-hidden>
          <Chessboard options={boardOptions} />
        </div>
      </div>
    </div>
  )
}
