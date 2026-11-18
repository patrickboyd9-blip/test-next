"use client"

import { useEffect, useState } from "react"

import { limbTint, type LimbTint } from "@/lib/cockpit/moments"

/** A quiet wash on the planet limb. It does not move the comet, the mailbox, or the glide. */
export function LimbHour({ hour }: { hour?: number }) {
  const [tint, setTint] = useState<LimbTint>(() => limbTint(hour ?? 12))

  useEffect(() => {
    if (typeof hour === "number") {
      setTint(limbTint(hour))
      return
    }
    const read = () => {
      const now = new Date()
      setTint(limbTint(now.getHours() + now.getMinutes() / 60))
    }
    read()
    const timer = window.setInterval(read, 60_000)
    return () => window.clearInterval(timer)
  }, [hour])

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
