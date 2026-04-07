import { cpSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const bin = join(root, 'node_modules', 'stockfish', 'bin')
const outDir = join(root, 'public', 'stockfish')
const jsSrc = join(bin, 'stockfish-18-lite-single.js')
const wasmSrc = join(bin, 'stockfish-18-lite-single.wasm')

if (!existsSync(jsSrc) || !existsSync(wasmSrc)) {
  console.warn(
    '[copy-stockfish] stockfish lite binaries missing; run npm install stockfish',
  )
  process.exit(0)
}

mkdirSync(outDir, { recursive: true })
cpSync(jsSrc, join(outDir, 'stockfish.js'))
cpSync(wasmSrc, join(outDir, 'stockfish.wasm'))
console.log('[copy-stockfish] copied lite-single engine to public/stockfish/')
