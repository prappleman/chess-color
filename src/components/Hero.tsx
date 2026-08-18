import './Hero.css'

type HeroProps = {
  onPlay: () => void
  onOpenSettings: () => void
  playDisabled: boolean
  statusText: string
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
  return (
    <div className="hero">
      <div className="hero__inner">
        <p className="hero__eyebrow">Chess Color</p>
        <h1 className="hero__title">See every move in color</h1>
        <p className="hero__lede">
          Jump in against a 250 Elo beginner bot. Green, blue, and red show how
          strong each move is.
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
    </div>
  )
}
