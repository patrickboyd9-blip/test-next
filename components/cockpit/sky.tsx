const STARS: Array<[number, number, number, number]> = [
  [72, 54, 0.7, 0.28],
  [168, 128, 0.45, 0.16],
  [286, 36, 1.5, 0.38],
  [410, 160, 0.5, 0.14],
  [548, 72, 1.3, 0.34],
  [690, 148, 0.45, 0.12],
  [824, 42, 1.6, 0.32],
  [980, 120, 0.5, 0.16],
  [1124, 64, 1.2, 0.28],
  [140, 280, 0.45, 0.12],
  [360, 340, 0.7, 0.14],
  [640, 260, 0.5, 0.12],
  [900, 310, 1.3, 0.22],
  [1088, 240, 0.45, 0.12],
  [220, 480, 0.55, 0.1],
  [520, 520, 0.4, 0.1],
  [780, 460, 0.6, 0.12],
  [1040, 500, 0.5, 0.1],
  [96, 640, 0.4, 0.1],
  [460, 680, 0.55, 0.1],
]

/** Deep navy field, a few still stars, one soft glow. Sits behind the cards. */
export function SpaceSky() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 42% 36% at 100% 0%, rgba(88, 140, 176, 0.16), transparent 64%), radial-gradient(ellipse 55% 40% at 0% 100%, rgba(18, 36, 64, 0.55), transparent 70%), linear-gradient(180deg, #070c16 0%, #05080f 46%, #04060c 100%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        {STARS.map(([cx, cy, r, opacity]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#d7eefe" opacity={opacity} />
        ))}
      </svg>
    </div>
  )
}

function Postcard({ className, atRest = false }: { className: string; atRest?: boolean }) {
  return (
    <g className={className} transform={atRest ? "translate(286 76) rotate(4)" : undefined}>
      <rect width="36" height="22" rx="1.5" fill="#f4f7fb" />
      <rect width="36" height="22" rx="1.5" fill="none" stroke="#b7d4e4" strokeWidth="0.6" />
      <path d="M5 7h16M5 12h11" stroke="#1c3d52" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

/**
 * A postcard and a line-art mailbox.
 * drift loops on the home and start screens. arrive plays once after Approve & mail.
 * prefers-reduced-motion shows the still: postcard at the box, flag down or up.
 */
export function MailFlight({ mode }: { mode: "drift" | "arrive" }) {
  const arrive = mode === "arrive"
  return (
    <div className={arrive ? "mx-auto w-full max-w-md" : "ml-auto w-full max-w-[220px] sm:max-w-xs"}>
      <svg
        viewBox="0 0 360 150"
        className={`h-16 w-full sm:h-20 ${arrive ? "mm-flight mm-flight-arrive h-28 sm:h-36" : "mm-flight mm-flight-drift"}`}
        aria-hidden
      >
        <path
          className="mm-trail"
          d="M28 100C96 100 128 36 186 40c58 4 78 62 112 54"
          fill="none"
          stroke="#7ee7ff"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.12"
        />
        <path
          className="mm-trail"
          d="M28 100C96 100 128 36 186 40c58 4 78 62 112 54"
          fill="none"
          stroke="#9fe7ff"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeDasharray="7 9"
          opacity="0.45"
        />
        <g fill="none" stroke="#9fdfff" strokeWidth="1.25" strokeLinejoin="round">
          <path d="M300 132V86" />
          <path d="M258 86h64v28H258z" />
          <path d="M256 86c10-16 52-16 68 0" />
          <path d="M274 98h28" opacity="0.7" />
        </g>
        <g className="mm-flag" fill="none" stroke="#9fdfff" strokeWidth="1.25">
          <path d="M332 78V62" />
          <path d="M332 58h20v7h-20z" />
        </g>
        <Postcard className="mm-card-rest" atRest />
        <Postcard className="mm-card-move" />
      </svg>
    </div>
  )
}
