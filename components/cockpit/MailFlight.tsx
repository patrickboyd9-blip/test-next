"use client"

import { useEffect, useState } from "react"

import {
  FLIGHT_MS,
  GLIDE_AFTER_FLIGHT_MS,
  IDLE_MS,
  flightAllowed,
  flightPath,
  glideOccupies,
  slotPoint,
  type FlightMarks,
} from "@/lib/cockpit/flight-path"

/**
 * A second piece of mail. The small slip already inside the mailbox is left alone.
 * This one takes the long curve and only then borrows the same slot fade.
 */
export function MailFlight() {
  const [path, setPath] = useState<string | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let idle = 0
    let retry = 0
    let glideHold = 0
    let flying = false
    let alive = true

    const slipAnimations = () => {
      const mailer = visibleMailbox()?.querySelector(".mm-mailer")
      if (!(mailer instanceof HTMLElement)) return []
      return mailer.getAnimations().filter((animation) => animation instanceof CSSAnimation && animation.animationName === "mm-slip")
    }

    const pauseGlide = () => {
      window.clearTimeout(glideHold)
      visibleMailbox()?.classList.add("mm-glide-hold")
      for (const animation of slipAnimations()) animation.currentTime = 0
    }

    const releaseGlide = () => {
      window.clearTimeout(glideHold)
      glideHold = window.setTimeout(() => {
        const box = visibleMailbox()
        box?.classList.remove("mm-glide-hold")
        for (const animation of slipAnimations()) {
          animation.currentTime = 0
          animation.play()
        }
      }, GLIDE_AFTER_FLIGHT_MS)
    }

    const measure = (): FlightMarks | null => {
      if (!flightAllowed(window.innerWidth, reduced.matches)) return null
      const copy = document.querySelector("[data-flight-copy]")
      const box = visibleMailbox()
      if (!copy || !box) return null
      const copyRect = copy.getBoundingClientRect()
      const boxRect = box.getBoundingClientRect()
      if (copyRect.width < 40 || boxRect.width < 40) return null
      const slot = slotPoint(boxRect)
      const dipY = Math.max(slot.y + 36, copyRect.top + copyRect.height * 0.7)
      return {
        start: { x: -40, y: Math.max(window.innerHeight - 24, copyRect.bottom + 80) },
        rise: { x: Math.max(28, copyRect.left - 56), y: copyRect.top + 8 },
        crest: { x: copyRect.left + Math.min(copyRect.width * 0.46, 280), y: Math.max(16, copyRect.top - 34) },
        dip: { x: copyRect.right + 24, y: dipY },
        slot,
      }
    }

    const glideBusy = () => {
      const mailer = visibleMailbox()?.querySelector(".mm-mailer")
      const animation = mailer instanceof HTMLElement ? mailer.getAnimations()[0] : undefined
      if (!animation || typeof animation.currentTime !== "number") return false
      const time = animation.currentTime
      const duration = animation.effect?.getComputedTiming().duration
      const span = typeof duration === "number" && duration > 0 ? duration : 18000
      return glideOccupies(time / span)
    }

    const launch = () => {
      if (!alive || flying) return
      if (!flightAllowed(window.innerWidth, reduced.matches)) {
        setPath(null)
        return
      }
      if (glideBusy()) {
        window.clearTimeout(retry)
        retry = window.setTimeout(launch, 700)
        return
      }
      const marks = measure()
      if (!marks) return
      flying = true
      pauseGlide()
      setPath(flightPath(marks))
      setRun((value) => value + 1)
    }

    const armIdle = () => {
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        launch()
        armIdle()
      }, IDLE_MS)
    }

    const onResize = () => {
      if (!flying) return
      const marks = measure()
      setPath(marks ? flightPath(marks) : null)
      if (!marks) {
        flying = false
        releaseGlide()
      }
    }

    const onActivity = () => armIdle()

    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(launch)
    })
    armIdle()
    window.addEventListener("resize", onResize)
    for (const name of ["mousemove", "keydown", "scroll", "touchstart", "pointerdown"] as const) {
      window.addEventListener(name, onActivity, { passive: true })
    }

    const finish = () => {
      flying = false
      const box = visibleMailbox()
      box?.classList.add("mm-flight-arrive")
      window.setTimeout(() => box?.classList.remove("mm-flight-arrive"), 1200)
      releaseGlide()
      setPath(null)
    }
    const layer = () => document.querySelector("[data-mail-flight]")
    const onEnd = (event: Event) => {
      if ((event as AnimationEvent).animationName === "mm-flight-move") finish()
    }
    document.addEventListener("animationend", onEnd)

    return () => {
      alive = false
      window.cancelAnimationFrame(frame)
      window.clearTimeout(idle)
      window.clearTimeout(retry)
      window.clearTimeout(glideHold)
      visibleMailbox()?.classList.remove("mm-glide-hold")
      window.removeEventListener("resize", onResize)
      for (const name of ["mousemove", "keydown", "scroll", "touchstart", "pointerdown"] as const) {
        window.removeEventListener(name, onActivity)
      }
      document.removeEventListener("animationend", onEnd)
      layer()
    }
  }, [])

  if (!path) return null
  return (
    <div key={run} className="mm-flight-layer" data-mail-flight aria-hidden>
      <span className="mm-flight" style={{ offsetPath: `path('${path}')`, animationDuration: `${FLIGHT_MS}ms` }}>
        <span className="mm-flight-glow" />
        <svg className="mm-flight-piece" viewBox="0 0 68 42" style={{ animationDuration: `${FLIGHT_MS}ms` }}>
          <defs>
            <pattern id="mm-flight-paper" width="3" height="3" patternUnits="userSpaceOnUse">
              <rect width="3" height="3" fill="#f4efe6" />
              <path d="M0 3 L3 0" stroke="#e6ddd1" strokeWidth="0.35" />
            </pattern>
          </defs>
          <rect x="1.2" y="1.2" width="65.6" height="39.6" rx="1.4" fill="url(#mm-flight-paper)" />
          <path d="M2 2 L34 24 L66 2" fill="none" stroke="#d8cfc2" strokeWidth="0.7" />
          <path d="M2 40 L34 24 L66 40" fill="none" stroke="#e4dcd0" strokeWidth="0.45" />
          <rect x="50" y="4.2" width="13" height="9.2" rx="0.4" fill="#b85a49" stroke="#8c4034" strokeWidth="0.45" strokeDasharray="0.7 0.55" />
        </svg>
      </span>
    </div>
  )
}

function visibleMailbox(): HTMLElement | null {
  const boxes = document.querySelectorAll(".mm-sky-hero:not(.mm-sky-arrival) .mm-postbox")
  for (const box of boxes) {
    if (!(box instanceof HTMLElement)) continue
    const rect = box.getBoundingClientRect()
    if (rect.width > 40 && rect.height > 40) return box
  }
  return null
}

