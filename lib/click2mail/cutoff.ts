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

function easternParts(now: Date): { weekday: string; hour: number; minute: number } {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: SAME_DAY_CUTOFF_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    formatted.find((part) => part.type === type)?.value ?? ""
  return {
    weekday: read("weekday"),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  }
}
