/**
 * Cinematic night sky. Stars and an Earth limb are CSS only.
 * The comet is a thin light streak, not an illustrated object.
 */

const FAR = [
  [4, 8], [9, 18], [15, 6], [21, 22], [28, 11], [34, 4], [40, 16], [47, 9],
  [53, 20], [60, 7], [66, 15], [73, 5], [79, 19], [86, 10], [93, 17], [97, 6],
  [7, 32], [18, 38], [30, 30], [42, 36], [55, 28], [68, 34], [81, 29], [94, 37],
]
const MID = [
  [6, 14], [17, 8], [29, 18], [41, 12], [54, 22], [66, 10], [78, 16], [90, 8],
  [12, 44], [33, 40], [58, 46], [76, 38], [95, 42],
]
const NEAR = [
  [11, 12], [24, 26], [39, 10], [52, 24], [67, 14], [81, 22], [93, 12], [20, 52], [48, 50], [72, 48],
]

function starLayer(points: number[][], size: number, alpha: number) {
  return points
    .map(([x, y]) => `radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgba(226,244,255,${alpha}), transparent 70%)`)
    .join(",")
}

export function SpaceSky({
  hero = false,
  arrival = false,
  postbox,
}: {
  hero?: boolean
  arrival?: boolean
  postbox?: "home" | "start" | "arrive"
}) {
  const tone = arrival ? "mm-sky mm-sky-hero mm-sky-arrival" : hero ? "mm-sky mm-sky-hero" : "mm-sky"
  const box = postbox ?? (arrival ? "arrive" : hero ? "home" : null)
  return (
    <div aria-hidden className={tone}>
      <div className="mm-sky-wash" />
      <div className="mm-stars mm-stars-far" style={{ backgroundImage: starLayer(FAR, 1.1, 0.5) }} />
      <div className="mm-stars mm-stars-mid" style={{ backgroundImage: starLayer(MID, 1.5, 0.62) }} />
      <div className="mm-stars mm-stars-near" style={{ backgroundImage: starLayer(NEAR, 2, 0.78) }} />
      <div className="mm-limb" />
      {hero || arrival ? <div className={arrival ? "mm-comet mm-comet-arrive" : "mm-comet"} /> : null}
      {arrival ? <div className="mm-flash" /> : null}
      {box ? <Postbox scale={box} /> : null}
    </div>
  )
}

function Postbox({ scale }: { scale: "home" | "start" | "arrive" }) {
  const tone = scale === "arrive" ? "mm-postbox mm-postbox-arrive" : scale === "start" ? "mm-postbox mm-postbox-start" : "mm-postbox"
  return (
    <div className={tone} aria-hidden>
      <svg viewBox="0 0 72 128" className="h-full w-full overflow-visible">
        <defs>
          <filter id="mm-card-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="mm-post-rim" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="-0.6" dy="-1.2" stdDeviation="1.1" floodColor="#8ef0ff" floodOpacity="0.65" />
          </filter>
        </defs>
        <g className="mm-post-card" filter="url(#mm-card-glow)">
          <rect x="27" y="48" width="16" height="10" rx="1.2" fill="#e7fbff" />
        </g>
        <g filter="url(#mm-post-rim)">
          <path
            fill="#071018"
            fillRule="evenodd"
            d="M24 108 V74 C24 48 48 48 48 74 V108 Z M29 78 H43 V81 H29 Z M33 108 H39 V124 H33 Z"
          />
        </g>
        <ellipse className="mm-post-pulse" cx="36" cy="84" rx="11" ry="3.5" fill="#7ee7ff" />
      </svg>
    </div>
  )
}
