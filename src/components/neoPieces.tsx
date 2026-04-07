import type { PieceRenderObject } from 'react-chessboard'

/** Chess.com “Neo” piece PNGs (CDN). */
const NEO_BASE =
  'https://images.chesscomfiles.com/chess-themes/pieces/neo/300'

const FILES = {
  wP: 'wp',
  wR: 'wr',
  wN: 'wn',
  wB: 'wb',
  wQ: 'wq',
  wK: 'wk',
  bP: 'bp',
  bR: 'br',
  bN: 'bn',
  bB: 'bb',
  bQ: 'bq',
  bK: 'bk',
} as const satisfies Record<string, string>

function NeoPieceImg({ file }: { file: string }) {
  return (
    <img
      src={`${NEO_BASE}/${file}.png`}
      alt=""
      width="100%"
      height="100%"
      draggable={false}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}

export const neoPieces: PieceRenderObject = {
  wP: () => <NeoPieceImg file={FILES.wP} />,
  wR: () => <NeoPieceImg file={FILES.wR} />,
  wN: () => <NeoPieceImg file={FILES.wN} />,
  wB: () => <NeoPieceImg file={FILES.wB} />,
  wQ: () => <NeoPieceImg file={FILES.wQ} />,
  wK: () => <NeoPieceImg file={FILES.wK} />,
  bP: () => <NeoPieceImg file={FILES.bP} />,
  bR: () => <NeoPieceImg file={FILES.bR} />,
  bN: () => <NeoPieceImg file={FILES.bN} />,
  bB: () => <NeoPieceImg file={FILES.bB} />,
  bQ: () => <NeoPieceImg file={FILES.bQ} />,
  bK: () => <NeoPieceImg file={FILES.bK} />,
}
