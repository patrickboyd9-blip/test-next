import { STATUS_LABEL, statusNeedsYou, type InFlightMailer } from "@/lib/mailer-compose/flow"

import { ASSISTANT_NAME } from "./comet"

export interface CometHomeNote {
  name: string
  sample: boolean
  snapshot: string
  recommendations: string[]
}

/** Uses only the mailers passed in. It does not invent replies or rates. */
export function cometHomeNote(
  mailers: readonly Pick<InFlightMailer, "name" | "status">[],
  sample: boolean,
): CometHomeNote {
  const waiting = mailers.filter((item) => statusNeedsYou(item.status))
  const counts = new Map<string, number>()
  for (const item of mailers) {
    const label = STATUS_LABEL[item.status]
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const parts = [...counts.entries()].map(([label, count]) => `${count} ${label.toLowerCase()}`)
  const snapshot = mailers.length === 0
    ? "No mailers are on this screen."
    : `${mailers.length} mailer${mailers.length === 1 ? "" : "s"}: ${parts.join(", ")}. No reply count is on this screen.`
  const recommendations: string[] = []
  if (waiting[0]) recommendations.push(`Approve ${waiting[0].name}. It is waiting on you.`)
  if (mailers.some((item) => item.status === "delivered")) {
    recommendations.push("No reply list is attached, so there is no follow-up to send.")
  } else if (recommendations.length === 0 && mailers.length > 0) {
    recommendations.push("Nothing is waiting. Start the next mailer when you are ready.")
  }
  return { name: ASSISTANT_NAME, sample, snapshot, recommendations: recommendations.slice(0, 2) }
}
