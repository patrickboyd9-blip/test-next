"use client"

import { useEffect, useState } from "react"

import { limbTint, type LimbTint } from "@/lib/cockpit/moments"

/** A quiet wash on the planet limb. It does not move the comet, the mailbox, or the glide. */
export function LimbHour({ hour }: { hour?: number }) {
  const fixed = typeof hour === "number" ? limbTint(hour) : null
  const [liveTint, setLiveTint] = useState<LimbTint | null>(null)

  useEffect(() => {
    if (typeof hour === "number") return
    const read = () => {
      const now = new Date()
      setLiveTint(limbTint(now.getHours() + now.getMinutes() / 60))
    }
    const kick = window.setTimeout(read, 0)
    const timer = window.setInterval(read, 60_000)
    return () => {
      window.clearTimeout(kick)
      window.clearInterval(timer)
    }
  }, [hour])

  const tint = fixed ?? liveTint
  if (!tint) return null

  return (
    <div
      className="mm-limb-hour"
      data-sky-phase={tint.phase}
      style={{
        ["--limb-amber" as string]: String(tint.amber),
        ["--limb-violet" as string]: String(tint.violet),
        ["--limb-night" as string]: String(tint.night),
      }}
    />
  )
}
