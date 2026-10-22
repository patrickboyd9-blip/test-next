/**
 * Click2Mail's same-day mailing cutoff is 8:00 PM Eastern.
 * API jobs are queued and run in arrival order, so a job submitted near the
 * cutoff can still miss that day's batch.
 */
export const SAME_DAY_CUTOFF_TIME_ZONE = "America/New_York"
export const SAME_DAY_CUTOFF_HOUR = 20
export const SAME_DAY_CUTOFF_MINUTE = 0
/** How long before 8:00 PM ET we warn that the queue may miss the batch. */
export const SAME_DAY_CUTOFF_WARNING_MINUTES = 120

const CLOSE_MESSAGE =
  "This is close to Click2Mail’s 8:00 PM ET cutoff. Jobs wait in a batch queue and can miss same-day mailing when they arrive this late, so this one may go out the next business day."

const PAST_MESSAGE =
  "This is past Click2Mail’s 8:00 PM ET cutoff. It will wait in the batch queue and mail the next business day."

const CLOSED_MESSAGE =
  "Click2Mail mails on business days, before 8:00 PM ET. This will wait for the next business-day batch."

export function mailingCutoffWarning(now: Date): string | null {
  const parts = easternParts(now)
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return CLOSED_MESSAGE
  const minutes = parts.hour * 60 + parts.minute
  const cutoff = SAME_DAY_CUTOFF_HOUR * 60 + SAME_DAY_CUTOFF_MINUTE
  if (minutes >= cutoff) return PAST_MESSAGE
  if (cutoff - minutes <= SAME_DAY_CUTOFF_WARNING_MINUTES) return CLOSE_MESSAGE
  return null
}

/**
 * The last moment a submitted job can still be cancelled: the next
 * business-day 8:00 PM ET cutoff strictly after it was submitted.
 * A Tuesday afternoon job can be cancelled until Tuesday at 8:00 PM ET.
 * A job submitted after that, or on a weekend, can be cancelled until the
 * next business day's 8:00 PM ET cutoff.
 */
export function cancellationDeadline(submittedAt: Date): Date {
  const start = easternParts(submittedAt)
  for (let offset = 0; offset < 14; offset += 1) {
    const day = addCalendarDays(start.year, start.month, start.day, offset)
    const noon = zonedToUtc(day.year, day.month, day.day, 12, 0)
    const weekday = easternParts(noon).weekday
    if (weekday === "Sat" || weekday === "Sun") continue
    const cutoff = zonedToUtc(day.year, day.month, day.day, SAME_DAY_CUTOFF_HOUR, SAME_DAY_CUTOFF_MINUTE)
    if (cutoff.getTime() > submittedAt.getTime()) return cutoff
  }
  return zonedToUtc(start.year, start.month, start.day + 14, SAME_DAY_CUTOFF_HOUR, SAME_DAY_CUTOFF_MINUTE)
}

export function isBeforeCancellationDeadline(submittedAt: Date, now: Date): boolean {
  return now.getTime() < cancellationDeadline(submittedAt).getTime()
}

function easternParts(now: Date): {
  weekday: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: SAME_DAY_CUTOFF_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    formatted.find((part) => part.type === type)?.value ?? ""
  return {
    weekday: read("weekday"),
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  }
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const utc = new Date(Date.UTC(year, month - 1, day))
  utc.setUTCDate(utc.getUTCDate() + days)
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

/** UTC instant whose clock in America/New_York matches the given calendar time. */
function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = easternParts(new Date(utc))
    const got = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    const want = Date.UTC(year, month - 1, day, hour, minute)
    const diff = got - want
    if (diff === 0) return new Date(utc)
    utc -= diff
  }
  return new Date(utc)
}
