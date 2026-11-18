/** Local-time sky tint and mailed-piece milestones. Neither one invents a count. */

export const MAIL_MILESTONES = [100, 1_000, 10_000] as const
export type MailMilestone = (typeof MAIL_MILESTONES)[number]

export type DayPhase = "night" | "dawn" | "day" | "dusk"

export interface LimbTint {
  phase: DayPhase
  amber: number
  violet: number
  night: number
}

/** Hour is local time in [0, 24). Boundaries ease across about an hour. */
export function limbTint(hour: number): LimbTint {
  const h = ((hour % 24) + 24) % 24
  const dawn = bell(h, 4.5, 8)
  const day = plateau(h, 7.5, 16.5)
  const dusk = bell(h, 16.5, 20.5)
  const night = Math.max(0, 1 - day * 0.82 - dawn * 0.45 - dusk * 0.35)
  const phase: DayPhase = dawn > day && dawn > dusk && dawn > 0.35
    ? "dawn"
    : dusk > day && dusk > dawn && dusk > 0.35
      ? "dusk"
      : day > 0.55
        ? "day"
        : "night"
  return {
    phase,
    amber: round(dawn * 0.62 + day * 0.04),
    violet: round(dusk * 0.55),
    night: round(0.15 + night * 0.5),
  }
}

export function pendingMilestone(total: number, seen: readonly number[]): MailMilestone | null {
  if (!Number.isFinite(total)) return null
  for (const mark of MAIL_MILESTONES) {
    if (total >= mark && !seen.includes(mark)) return mark
  }
  return null
}

/**
 * Sample lists never celebrate. A labeled preview may show one milestone on purpose.
 */
export function milestoneToShow(input: {
  total: number
  seen: readonly number[]
  sample: boolean
  preview: boolean
}): MailMilestone | null {
  if (input.sample && !input.preview) return null
  return pendingMilestone(input.total, input.seen)
}

export function milestoneLabel(mark: number, preview: boolean): string {
  const count = mark.toLocaleString("en-US")
  const line = `${count} pieces mailed`
  return preview ? `Preview · ${line}` : line
}

function bell(hour: number, start: number, end: number): number {
  if (hour < start || hour > end) return 0
  return Math.sin(((hour - start) / (end - start)) * Math.PI)
}

function plateau(hour: number, start: number, end: number): number {
  if (hour < start - 0.8 || hour > end + 0.8) return 0
  if (hour < start) return smooth((hour - (start - 0.8)) / 0.8)
  if (hour > end) return smooth(1 - (hour - end) / 0.8)
  return 1
}

function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
