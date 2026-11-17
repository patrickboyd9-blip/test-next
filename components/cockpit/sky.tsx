/**
 * Cinematic night sky. Stars and an Earth limb are CSS only.
 * The comet is a thin light streak, not an illustrated object.
 */

const FAR = [
  [8, 12], [18, 28], [31, 8], [44, 22], [57, 6], [69, 18], [82, 9], [91, 24],
  [14, 46], [27, 38], [48, 44], [63, 36], [77, 48], [88, 40],
]
const MID = [
  [12, 16], [36, 11], [52, 27], [71, 14], [86, 32], [22, 58], [46, 52], [64, 62], [90, 56],
]
const NEAR = [
  [16, 20], [41, 34], [58, 18], [74, 42], [28, 70], [84, 68],
]

function starLayer(points: number[][], size: number, alpha: number) {
  return points
    .map(([x, y]) => `radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgba(226,244,255,${alpha}), transparent 70%)`)
    .join(",")
}

export function SpaceSky({ hero = false }: { hero?: boolean }) {
  return (
    <div aria-hidden className={hero ? "mm-sky mm-sky-hero" : "mm-sky"}>
      <div className="mm-sky-wash" />
      <div className="mm-stars mm-stars-far" style={{ backgroundImage: starLayer(FAR, 1, 0.45) }} />
      <div className="mm-stars mm-stars-mid" style={{ backgroundImage: starLayer(MID, 1.4, 0.55) }} />
      <div className="mm-stars mm-stars-near" style={{ backgroundImage: starLayer(NEAR, 1.8, 0.7) }} />
      <div className="mm-limb" />
      {hero ? <div className="mm-comet" /> : null}
    </div>
  )
}

/** Stronger horizon for the home and start heroes, and the send confirmation. */
export function Horizon({ mode }: { mode: "hero" | "arrive" }) {
  return (
    <div aria-hidden className={mode === "arrive" ? "mm-horizon mm-horizon-arrive" : "mm-horizon"}>
      <div className="mm-limb" />
      <div className={mode === "arrive" ? "mm-comet mm-comet-arrive" : "mm-comet"} />
      {mode === "arrive" ? <div className="mm-flash" /> : null}
    </div>
  )
}
