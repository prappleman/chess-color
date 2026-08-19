# Chess Color

A browser chess game that shows **how good each move is** by painting the board.

Green, blue, and red overlays come from a local Stockfish engine — best moves, reasonable moves, and mistakes — so you can read a position at a glance instead of staring at an evaluation number.

Play against the same engine in your browser, from a 250 Elo beginner up to maximum strength. Nothing is sent to a server.

## Features

- **Color-coded move hints** — legal destinations (and the selected piece) tint green / blue / red from engine scores
- **Play vs Stockfish** — WASM engine in a Web Worker, with chess.com-style ratings from 250 to 3200
- **Eval bar** — live evaluation as the game unfolds
- **Check and mate marks** — `+` and `#` on forcing destinations
- **Play as white, black, or random**
- **Light and dark UI**, with toggles for which hint colors to show

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **[chess.js](https://github.com/jhlywa/chess.js)** for rules, legal moves, and game state
- **[react-chessboard](https://github.com/Clariity/react-chessboard)** for the board UI
- **[Stockfish 18](https://github.com/official-stockfish/Stockfish)** (lite WASM) for the opponent and move classification

## Getting started

Requires **Node.js 20+**.

```bash
git clone https://github.com/prappleman/chess-color.git
cd chess-color
npm install
npm run dev
```

Then open the URL Vite prints, usually [http://localhost:5173](http://localhost:5173).

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Typecheck and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## How it works

On your turn, a Stockfish worker scores every legal move. The UI maps those scores to three tiers:

| Color | Meaning |
| --- | --- |
| Green | Best, or a near-best forcing line |
| Blue | Reasonable |
| Red | Clearly worse than the best move |

Settings let you color destinations, the selected piece, or both, and you can hide any tier. Below Stockfish’s official `UCI_Elo` floor, search time is shortened so a 250 rating actually plays like a beginner.
