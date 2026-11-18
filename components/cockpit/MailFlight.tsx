"use client"

import { useEffect, useState } from "react"

import {
  FLIGHT_MS,
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
    let flying = false
    let alive = true

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
      const time = animation?.currentTime
      if (typeof time !== "number") return false
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
      if (!marks) flying = false
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
      <svg className="mm-flight-trail" viewBox={`0 0 ${windowWidth()} ${windowHeight()}`} preserveAspectRatio="none">
        <path d={path} />
      </svg>
      <span className="mm-flight" style={{ offsetPath: `path('${path}')` }}>
        <span className="mm-flight-piece" />
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

function windowWidth(): number {
  return typeof window === "undefined" ? 1440 : window.innerWidth
}

function windowHeight(): number {
  return typeof window === "undefined" ? 900 : window.innerHeight
}
