import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Square } from 'chess.js'
import './ChessGame.css'

type PromotionPiece = 'q' | 'r' | 'b' | 'n'

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

const highlightFrom: CSSProperties = {
  backgroundColor: 'rgba(186, 104, 200, 0.45)',
}
const highlightTo: CSSProperties = {
  background:
    'radial-gradient(circle, rgba(106, 27, 154, 0.35) 22%, transparent 22%)',
}
const highlightCapture: CSSProperties = {
  background:
    'radial-gradient(circle, rgba(106, 27, 154, 0.5) 82%, transparent 82%)',
}

function ChessGame() {
  const [fen, setFen] = useState(() => new Chess().fen())
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(
    null,
  )

  const chess = useMemo(() => {
    const c = new Chess()
    c.load(fen)
    return c
  }, [fen])

  const gameOver = chess.isGameOver()
  const [moveSquares, setMoveSquares] = useState<
    Record<string, CSSProperties>
  >({})

  const clearHighlights = useCallback(() => setMoveSquares({}), [])

  const onPieceDrag = useCallback(
    ({ square }: { square: string | null }) => {
      if (!square || gameOver || promotion) return
      const c = new Chess()
      c.load(fen)
      const moves = c.moves({ square: square as Square, verbose: true })
      const styles: Record<string, CSSProperties> = {
        [square]: highlightFrom,
      }
      for (const m of moves) {
        styles[m.to] = m.captured ? highlightCapture : highlightTo
      }
      setMoveSquares(styles)
    },
    [fen, gameOver, promotion],
  )

  const tryRegularMove = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      const next = new Chess()
      next.load(fen)
      const result = next.move({ from: sourceSquare, to: targetSquare })
      if (!result) return false
      setFen(next.fen())
      return true
    },
    [fen],
  )

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string
      targetSquare: string | null
    }): boolean => {
      clearHighlights()
      if (!targetSquare || gameOver || promotion) return false

      const c = new Chess()
      c.load(fen)
      const candidates = c
        .moves({ verbose: true })
        .filter((m) => m.from === sourceSquare && m.to === targetSquare)

      if (candidates.length === 0) return false

      if (candidates.some((m) => m.promotion)) {
        setPromotion({
          from: sourceSquare as Square,
          to: targetSquare as Square,
        })
        return false
      }

      return tryRegularMove(sourceSquare as Square, targetSquare as Square)
    },
    [fen, gameOver, promotion, clearHighlights, tryRegularMove],
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
      if (result) setFen(next.fen())
      setPromotion(null)
    },
    [fen, promotion],
  )

  const cancelPromotion = useCallback(() => setPromotion(null), [])

  const newGame = useCallback(() => {
    setPromotion(null)
    clearHighlights()
    setFen(new Chess().fen())
  }, [clearHighlights])

  const canDragPiece = useCallback(
    ({
      piece,
    }: {
      piece: { pieceType: string }
      isSparePiece: boolean
      square: string | null
    }) => {
      if (gameOver || promotion) return false
      const side = piece.pieceType[0] === 'w' ? 'w' : 'b'
      const c = new Chess()
      c.load(fen)
      return side === c.turn()
    },
    [fen, gameOver, promotion],
  )

  const moveRows = useMemo(() => {
    const c = new Chess()
    c.load(fen)
    return c.history()
  }, [fen])

  const boardOptions = useMemo(
    () => ({
      position: fen,
      boardOrientation: 'white' as const,
      allowDragging: !gameOver && !promotion,
      canDragPiece,
      onPieceDrag,
      onPieceDrop,
      squareStyles: moveSquares,
      showNotation: true,
      boardStyle: {
        width: 'min(100%, 560px)',
        margin: '0 auto',
        borderRadius: '6px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
      },
      darkSquareStyle: { backgroundColor: '#5b2c6f' },
      lightSquareStyle: { backgroundColor: '#e8d5f2' },
    }),
    [
      fen,
      gameOver,
      promotion,
      canDragPiece,
      onPieceDrag,
      onPieceDrop,
      moveSquares,
    ],
  )

  return (
    <div className="chess-game">
      <div className="chess-game__main">
        <header className="chess-game__header">
          <h1 className="chess-game__title">Chess</h1>
          <p className="chess-game__status" role="status">
            {gameStatus(chess)}
          </p>
          <button type="button" className="chess-game__new" onClick={newGame}>
            New game
          </button>
        </header>

        <div className="chess-game__board-wrap">
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
      </div>

      <aside className="chess-game__sidebar" aria-label="Move list">
        <h2 className="chess-game__sidebar-title">Moves</h2>
        <ol className="chess-game__movelist">
          {Array.from(
            { length: Math.ceil(moveRows.length / 2) },
            (_, pairIndex) => {
              const white = moveRows[pairIndex * 2]
              const black = moveRows[pairIndex * 2 + 1]
              return (
                <li key={pairIndex} className="chess-game__move-pair">
                  <span className="chess-game__move-num">{pairIndex + 1}.</span>
                  <span className="chess-game__move-san">{white}</span>
                  <span className="chess-game__move-san">
                    {black ?? '\u00a0'}
                  </span>
                </li>
              )
            },
          )}
        </ol>
        {moveRows.length === 0 ? (
          <p className="chess-game__movelist-empty">No moves yet</p>
        ) : null}
      </aside>
    </div>
  )
}

export default ChessGame
