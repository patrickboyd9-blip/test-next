import type { FollowUpEvent } from "./import"
import { eventKey } from "./import"
import type { FollowUpPolicy } from "./policy"

export interface SelectionRow {
  externalId: string
  decision: "included" | "excluded"
  reason: string
}

export interface Selection {
  included: FollowUpEvent[]
  rows: SelectionRow[]
}

export function selectEvents(events: readonly FollowUpEvent[], policy: FollowUpPolicy, nowIso: string): Selection {
  const included: FollowUpEvent[] = []
  const rows: SelectionRow[] = []
  const now = Date.parse(nowIso)
  const ordered = [...events].sort((a, b) => (eventKey(a) < eventKey(b) ? -1 : 1))
  for (const event of ordered) {
    const reason = excludeReason(event, policy, now)
    if (reason) {
      rows.push({ externalId: event.externalId, decision: "excluded", reason })
      continue
    }
    if (policy.cap != null && included.length >= policy.cap) {
      rows.push({ externalId: event.externalId, decision: "excluded", reason: "Over the cap you set." })
      continue
    }
    included.push(event)
    rows.push({ externalId: event.externalId, decision: "included", reason: "Open, permitted, and inside the cap you set." })
  }
  return { included, rows }
}

function excludeReason(event: FollowUpEvent, policy: FollowUpPolicy, now: number): string | null {
  if (!event.permission) return "This row says permission is no."
  if (!event.first || !event.address1 || !event.city || !event.state || !event.zip) return "Name or address is incomplete."
  if (policy.excludeConverted === true && event.status === "converted") return "Converted, and you chose to exclude converted jobs."
  if (policy.excludeOptOut === true && event.status === "opt-out") return "Opt-out, and you chose to exclude opt-outs."
  if (policy.recentContactDays != null && policy.recentContactDays > 0 && event.lastContact) {
    const touched = Date.parse(event.lastContact)
    if (!Number.isNaN(touched) && !Number.isNaN(now)) {
      const days = (now - touched) / (24 * 60 * 60 * 1000)
      if (days >= 0 && days < policy.recentContactDays) return `Contacted within ${policy.recentContactDays} days, the window you set.`
    }
  }
  return null
}

export function selectionKey(events: readonly FollowUpEvent[]): string {
  return events.map(eventKey).sort().join("\n")
}
