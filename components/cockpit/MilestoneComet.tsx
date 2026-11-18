"use client"

import { useEffect, useState } from "react"

import { milestoneLabel, milestoneToShow, type MailMilestone } from "@/lib/cockpit/moments"

const SEEN_KEY = "mm-milestones-seen"

/** One brighter pass when a real mailed total first crosses a milestone. */
export function MilestoneComet({
  total,
  ownerId,
  sample,
  preview = false,
  force,
}: {
  total: number
  ownerId: string
  sample: boolean
  preview?: boolean
  force?: number
}) {
  const [mark, setMark] = useState<MailMilestone | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const seen = readSeen(ownerId)
    const forced = force === 100 || force === 1000 || force === 10000 ? force : null
    const next = forced && (preview || !sample)
      ? forced
      : milestoneToShow({ total, seen, sample, preview })
    if (!next) return
    setMark(next)
    setShow(true)
    if (!preview) writeSeen(ownerId, [...seen, next])
    const timer = window.setTimeout(() => setShow(false), 6400)
    return () => window.clearTimeout(timer)
  }, [total, ownerId, sample, preview, force])

  if (!show || !mark) return null
  return (
    <div className="mm-milestone" aria-hidden={false}>
      <span className="mm-milestone-comet" />
      <p className="mm-milestone-note">{milestoneLabel(mark, preview || sample)}</p>
    </div>
  )
}

function readSeen(ownerId: string): number[] {
  try {
    const raw = window.localStorage.getItem(`${SEEN_KEY}:${ownerId}`)
    const parsed = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "number") : []
  } catch {
    return []
  }
}

function writeSeen(ownerId: string, seen: number[]) {
  try {
    window.localStorage.setItem(`${SEEN_KEY}:${ownerId}`, JSON.stringify([...new Set(seen)]))
  } catch {
    /* The pass still plays. The next refresh may show it again. */
  }
}
