/**
 * Cinematic night sky. Stars are CSS. The limb is a dark planet with a soft atmosphere.
 * The comet is chosen in comet.tsx. The classic streak stays available.
 */

import Image from "next/image"

import { SkyComet } from "./comet"
import { LimbHour } from "./LimbHour"
import { MailFlight } from "./MailFlight"

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
  hour,
}: {
  hero?: boolean
  arrival?: boolean
  postbox?: "home" | "start" | "arrive"
  hour?: number
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
        <LimbHour hour={hour} />
      </div>
      {hero || arrival ? <SkyComet arrival={arrival} /> : null}
      {arrival ? <div className="mm-flash" /> : null}
      {box ? <Postbox scale={box} /> : null}
      {box === "home" ? <MailFlight /> : null}
    </div>
  )
}

/** In-flow copy of the home mailbox, shown only on small screens. */
export function HomeMailbox() {
  return (
    <div className="mm-postbox-slot">
      <Postbox scale="home" />
    </div>
  )
}

function Postbox({ scale }: { scale: "home" | "start" | "arrive" }) {
  const tone = scale === "arrive" ? "mm-postbox mm-postbox-arrive" : scale === "start" ? "mm-postbox mm-postbox-start" : "mm-postbox"
  return (
    <div className={tone} aria-hidden>
      <span className="mm-post-glow" />
      <Image
        src="/brand/mailbox/mailbox.webp"
        alt=""
        fill
        sizes={scale === "start" ? "(max-width: 640px) 120px, 210px" : "(max-width: 640px) 148px, 300px"}
        className="mm-post-photo"
      />
      <picture className="mm-terrain">
        <source srcSet="/brand/mailbox/terrain.webp" type="image/webp" />
        <Image
          src="/brand/mailbox/terrain.png"
          alt=""
          fill
          sizes={scale === "start" ? "(max-width: 640px) 220px, 380px" : "(max-width: 640px) 280px, 500px"}
          className="mm-terrain-photo"
        />
      </picture>
      <span className="mm-mailer" />
    </div>
  )
}
