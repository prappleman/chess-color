export type ParsedScore =
  | { type: 'cp'; value: number }
  | { type: 'mate'; value: number }

export type AnalyzeResult = {
  bestmove: string
  score: ParsedScore
}

function parseScoreFromInfoLines(lines: string[]): ParsedScore {
  let last: ParsedScore | null = null
  for (const line of lines) {
    if (!line.startsWith('info ')) continue
    const mateM = /\bscore mate (-?\d+)\b/.exec(line)
    if (mateM) {
      last = { type: 'mate', value: Number(mateM[1]) }
      continue
    }
    const cpM = /\bscore cp (-?\d+)\b/.exec(line)
    if (cpM) last = { type: 'cp', value: Number(cpM[1]) }
  }
  return last ?? { type: 'cp', value: 0 }
}

/**
 * Convert engine score (for side to move) to "centipawn-like" advantage for `player`.
 * Mate scores use large magnitudes so they sort correctly vs cp.
 */
export function evalForPlayer(
  score: ParsedScore,
  sideToMove: 'w' | 'b',
  player: 'w' | 'b',
): number {
  const MATE = 1_000_000
  if (score.type === 'mate') {
    const m = score.value
    const stmWins = m > 0
    const v = stmWins ? MATE - Math.abs(m) : -(MATE - Math.abs(m))
    const goodForWhite = sideToMove === 'w' ? v : -v
    return player === 'w' ? goodForWhite : -goodForWhite
  }
  const cp = score.value
  const goodForWhite = sideToMove === 'w' ? cp : -cp
  return player === 'w' ? goodForWhite : -goodForWhite
}

export class StockfishEngine {
  private worker: Worker
  private lineHandler: ((line: string) => void) | null = null
  private queue: Promise<void> = Promise.resolve()

  constructor(workerScriptUrl: string) {
    this.worker = new Worker(workerScriptUrl, { type: 'classic' })
    this.worker.addEventListener('message', (e: MessageEvent<string>) => {
      const text = String(e.data ?? '').replace(/\r/g, '')
      for (const raw of text.split('\n')) {
        const line = raw.trim()
        if (!line) continue
        this.lineHandler?.(line)
      }
    })
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.then(
      () => {},
      () => {},
    )
    return run
  }

  private post(cmd: string): void {
    this.worker.postMessage(cmd.endsWith('\n') ? cmd : `${cmd}\n`)
  }

  private readUntil(pred: (line: string) => boolean): Promise<string[]> {
    const lines: string[] = []
    return new Promise((resolve, reject) => {
      this.lineHandler = (line: string) => {
        lines.push(line)
        try {
          if (pred(line)) {
            this.lineHandler = null
            resolve(lines)
          }
        } catch (e) {
          this.lineHandler = null
          reject(e)
        }
      }
    })
  }

  async init(): Promise<void> {
    return this.enqueue(async () => {
      this.post('uci')
      await this.readUntil((l) => l === 'uciok')
      this.post('isready')
      await this.readUntil((l) => l === 'readyok')
    })
  }

  async analyzeFen(
    fen: string,
    opts: { movetime: number; depth?: number },
  ): Promise<AnalyzeResult> {
    return this.enqueue(async () => {
      this.post(`position fen ${fen}`)
      const go =
        opts.depth != null
          ? `go depth ${opts.depth}`
          : `go movetime ${opts.movetime}`
      this.post(go)
      const lines = await this.readUntil((l) => l.startsWith('bestmove'))
      const bmLine = lines.find((l) => l.startsWith('bestmove')) ?? ''
      const parts = bmLine.split(/\s+/)
      const bestmove = parts[1] && parts[1] !== '(none)' ? parts[1] : ''
      const score = parseScoreFromInfoLines(lines)
      return { bestmove, score }
    })
  }

  async setLimitStrength(elo: number): Promise<void> {
    return this.enqueue(async () => {
      this.post('setoption name UCI_LimitStrength value true')
      this.post(`setoption name UCI_Elo value ${Math.round(elo)}`)
      this.post('isready')
      await this.readUntil((l) => l === 'readyok')
    })
  }

  async setFullStrength(): Promise<void> {
    return this.enqueue(async () => {
      this.post('setoption name UCI_LimitStrength value false')
      this.post('isready')
      await this.readUntil((l) => l === 'readyok')
    })
  }

  dispose(): void {
    try {
      this.post('quit')
    } catch {
      /* ignore */
    }
    this.worker.terminate()
  }
}
