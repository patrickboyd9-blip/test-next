"use client"

import { useEffect, useState, type ReactNode } from "react"

/** A card turning in the hand. Reduced motion shows the front and still allows a click. */
export function ProofReveal({
  front,
  back,
}: {
  front: ReactNode
  back: ReactNode
}) {
  const [turned, setTurned] = useState(false)
  const [intro, setIntro] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 1900)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <button
      type="button"
      className="mm-proof-scene"
      aria-label={turned ? "Show the front of the postcard" : "Show the back of the postcard"}
      onClick={() => {
        setIntro(false)
        setTurned((value) => !value)
      }}
    >
      <span className={`mm-proof-card${intro ? " mm-proof-intro" : ""}${turned ? " mm-proof-back" : ""}`}>
        <span className="mm-proof-face mm-proof-front">{front}</span>
        <span className="mm-proof-face mm-proof-rear">{back}</span>
        <span className="mm-proof-glint" />
      </span>
    </button>
  )
}
