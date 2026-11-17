/**
 * Cinematic night sky. Stars are CSS. The limb is a dark planet with a soft atmosphere.
 * The comet is a thin light streak, not an illustrated object.
 */

import Image from "next/image"

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
      <div className="mm-limb">
        <div className="mm-limb-ground" />
        <div className="mm-limb-texture" />
        <div className="mm-limb-air" />
        <div className="mm-limb-sun" />
      </div>
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
      <svg className="mm-outcrop" viewBox="0 0 480 160" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="mm-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7eb4c8" />
            <stop offset="0.16" stopColor="#2d5e78" />
            <stop offset="0.42" stopColor="#143044" />
            <stop offset="1" stopColor="#05090f" />
          </linearGradient>
          <radialGradient id="mm-rock-spill" cx="54%" cy="22%" r="42%">
            <stop offset="0" stopColor="rgba(90,196,255,0.42)" />
            <stop offset="1" stopColor="rgba(90,196,255,0)" />
          </radialGradient>
          <filter id="mm-rock-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.6  0 0 0 0 0.7  0 0 0 0.35 0" result="grain" />
          </filter>
          <clipPath id="mm-rock-clip">
            <path d="M0 118 C 48 110 92 96 132 102 C 168 78 198 44 236 36 C 278 28 312 58 352 70 C 396 84 440 98 480 112 L 480 160 L 0 160 Z" />
          </clipPath>
        </defs>
        <ellipse cx="250" cy="148" rx="190" ry="16" fill="rgba(0,0,0,0.55)" />
        <path
          d="M0 118 C 48 110 92 96 132 102 C 168 78 198 44 236 36 C 278 28 312 58 352 70 C 396 84 440 98 480 112 L 480 160 L 0 160 Z"
          fill="url(#mm-rock)"
        />
        <rect width="480" height="160" filter="url(#mm-rock-grain)" clipPath="url(#mm-rock-clip)" opacity="0.55" />
        <path
          d="M132 102 C 168 78 198 44 236 36 C 278 28 312 58 352 70 C 396 84 440 98 470 110"
          fill="none"
          stroke="rgba(214,246,255,0.72)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <ellipse cx="248" cy="62" rx="78" ry="26" fill="url(#mm-rock-spill)" />
      </svg>
      <span className="mm-post-glow" />
      <Image
        src="/brand/mailbox/mailbox.webp"
        alt=""
        fill
        sizes={scale === "start" ? "(max-width: 640px) 120px, 210px" : "(max-width: 640px) 148px, 300px"}
        className="mm-post-photo"
      />
      <span className="mm-post-spill" aria-hidden />
      <span className="mm-mailer" />
    </div>
  )
}
