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
      <svg viewBox="0 0 140 200" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="mm-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1a2836" />
            <stop offset="0.45" stopColor="#0c141c" />
            <stop offset="1" stopColor="#070b12" />
          </linearGradient>
          <linearGradient id="mm-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bff6ff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#7ee7ff" stopOpacity="0" />
          </linearGradient>
          <filter id="mm-haze" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id="mm-slot-glow" x="-80%" y="-200%" width="260%" height="500%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ellipse className="mm-post-haze" cx="70" cy="168" rx="48" ry="10" fill="#7ee7ff" filter="url(#mm-haze)" />
        <g className="mm-post-card">
          <path className="mm-post-trail" d="M8 78 C28 86 46 96 62 104" fill="none" stroke="#d8fbff" strokeWidth="1.4" strokeLinecap="round" />
          <rect x="58" y="98" width="22" height="8" rx="1.4" fill="#e9fbff" />
        </g>
        <path d="M36 158 H104 L112 174 H28 Z" fill="#080d14" />
        <path d="M52 156 L58 52 Q70 34 82 52 L88 156 Z" fill="url(#mm-metal)" />
        <path d="M58 54 Q70 38 82 54" fill="none" stroke="url(#mm-rim)" strokeWidth="1.8" />
        <rect x="80" y="58" width="2.5" height="92" fill="#1b2836" />
        <g filter="url(#mm-slot-glow)">
          <rect x="58" y="100" width="28" height="2.6" rx="1" fill="#e7fdff" />
        </g>
        <ellipse className="mm-post-pulse" cx="72" cy="106" rx="20" ry="5" fill="#7ee7ff" />
      </svg>
    </div>
  )
}
