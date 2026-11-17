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

export function SpaceSky({ hero = false, arrival = false }: { hero?: boolean; arrival?: boolean }) {
  const tone = arrival ? "mm-sky mm-sky-hero mm-sky-arrival" : hero ? "mm-sky mm-sky-hero" : "mm-sky"
  return (
    <div aria-hidden className={tone}>
      <div className="mm-sky-wash" />
      <div className="mm-stars mm-stars-far" style={{ backgroundImage: starLayer(FAR, 1.1, 0.5) }} />
      <div className="mm-stars mm-stars-mid" style={{ backgroundImage: starLayer(MID, 1.5, 0.62) }} />
      <div className="mm-stars mm-stars-near" style={{ backgroundImage: starLayer(NEAR, 2, 0.78) }} />
      <div className="mm-limb" />
      {hero || arrival ? <div className={arrival ? "mm-comet mm-comet-arrive" : "mm-comet"} /> : null}
      {arrival ? <div className="mm-flash" /> : null}
    </div>
  )
}
