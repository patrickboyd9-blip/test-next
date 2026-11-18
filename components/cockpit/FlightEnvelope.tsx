import type { CSSProperties } from "react"

/** The long-flight envelope. The slot slip is a separate element and stays as it is. */
export function FlightEnvelope({ className, style, paperId = "mm-flight-paper" }: { className?: string; style?: CSSProperties; paperId?: string }) {
  return (
    <svg className={className} viewBox="0 0 68 42" style={style} aria-hidden>
      <defs>
        <pattern id={paperId} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="#f4efe6" />
          <path d="M0 3 L3 0" stroke="#e6ddd1" strokeWidth="0.35" />
        </pattern>
      </defs>
      <rect x="1.2" y="1.2" width="65.6" height="39.6" rx="1.4" fill={`url(#${paperId})`} />
      <path d="M2 2 L34 24 L66 2" fill="none" stroke="#d8cfc2" strokeWidth="0.7" />
      <path d="M2 40 L34 24 L66 40" fill="none" stroke="#e4dcd0" strokeWidth="0.45" />
      <rect x="50" y="4.2" width="13" height="9.2" rx="0.4" fill="#b85a49" stroke="#8c4034" strokeWidth="0.45" strokeDasharray="0.7 0.55" />
    </svg>
  )
}
