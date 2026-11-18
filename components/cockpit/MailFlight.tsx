"use client"

import { useEffect, useState } from "react"

import { FlightEnvelope } from "./FlightEnvelope"
import {
  DOOR_LAG_MS,
  DOOR_OPEN_MS,
  DOOR_SHUT_MS,
  ENTER_MS,
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
 * This one takes the long curve, slides into the mouth, and the door shuts and opens.
 */
export function MailFlight() {
  const [path, setPath] = useState<string | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let idle = 0
    let retry = 0
    const later: number[] = []
    let flying = false
    let doorBusy = false
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
      if (!animation || typeof animation.currentTime !== "number") return false
      const time = animation.currentTime
      const duration = animation.effect?.getComputedTiming().duration
      const span = typeof duration === "number" && duration > 0 ? duration : 18000
      return glideOccupies(time / span)
    }

    const launch = () => {
      if (!alive || flying || doorBusy) return
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
      handed = false
      setPath(flightPath(marks))
      setRun((value) => value + 1)
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(watchArrival)
      })
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
      const flightEl = document.querySelector(".mm-flight")
      const mouth = box?.querySelector(".mm-mouth")
      const insert = box?.querySelector(".mm-flight-insert")
      if (
        box &&
        mouth instanceof HTMLElement &&
        insert instanceof HTMLElement &&
        flightEl instanceof HTMLElement &&
        flightAllowed(window.innerWidth, reduced.matches)
      ) {
        const mouthRect = mouth.getBoundingClientRect()
        const flightRect = flightEl.getBoundingClientRect()
        insert.style.left = `${flightRect.left - mouthRect.left}px`
        insert.style.top = `${flightRect.top - mouthRect.top}px`
        insert.style.width = `${flightRect.width}px`
        insert.style.height = `${flightRect.height}px`
        doorBusy = true
        flightEl.style.visibility = "hidden"
        box.classList.add("mm-flight-enter", "mm-door-live")
        const shutAt = ENTER_MS + DOOR_LAG_MS
        later.push(window.setTimeout(() => {
          box.classList.remove("mm-flight-enter")
          box.classList.add("mm-door-shut")
        }, shutAt))
        later.push(window.setTimeout(() => {
          box.classList.remove("mm-door-shut")
          box.classList.add("mm-door-open")
        }, shutAt + DOOR_SHUT_MS))
        later.push(window.setTimeout(() => {
          box.classList.remove("mm-door-live", "mm-door-open")
          doorBusy = false
        }, shutAt + DOOR_SHUT_MS + DOOR_OPEN_MS))
      }
      setPath(null)
    }
    let handed = false
    const handoff = () => {
      if (handed) return
      handed = true
      const flightEl = document.querySelector(".mm-flight")
      if (flightEl instanceof HTMLElement) {
        flightEl.getAnimations().forEach((animation) => {
          if (animation.animationName === "mm-flight-move") animation.pause()
        })
      }
      finish()
    }
    const watchArrival = () => {
      if (!alive || !flying || handed) return
      const flightEl = document.querySelector(".mm-flight")
      const mouth = visibleMailbox()?.querySelector(".mm-mouth")
      if (flightEl instanceof HTMLElement && mouth instanceof HTMLElement) {
        const piece = flightEl.getBoundingClientRect()
        const hole = mouth.getBoundingClientRect()
        const cx = piece.left + piece.width / 2
        const cy = piece.top + piece.height / 2
        if (cx >= hole.left && cx <= hole.right && cy >= hole.top && cy <= hole.bottom) handoff()
      }
      if (!handed) frame = window.requestAnimationFrame(watchArrival)
    }
    const layer = () => document.querySelector("[data-mail-flight]")
    const onEnd = (event: Event) => {
      if ((event as AnimationEvent).animationName === "mm-flight-move") handoff()
    }
    document.addEventListener("animationend", onEnd)

    return () => {
      alive = false
      window.cancelAnimationFrame(frame)
      window.clearTimeout(idle)
      window.clearTimeout(retry)
      for (const id of later) window.clearTimeout(id)
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
        <FlightEnvelope className="mm-flight-piece" style={{ animationDuration: `${FLIGHT_MS}ms` }} />
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

