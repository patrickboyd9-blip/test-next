import type { PageParts } from "./store"

/** The recommended card. It only mentions the pieces the customer turned on. */
export function pageOfferCopy(parts: Pick<PageParts, "call" | "form" | "booking">): string {
  const shows: string[] = []
  const counts = ["how many people scanned"]
  if (parts.call) {
    shows.push("a big button to call you")
    counts.push("how many tapped to call you")
  }
  if (parts.form) {
    shows.push("a short form")
    counts.push("who filled out the form")
  }
  if (parts.booking) {
    shows.push("a button to pick a time")
    counts.push("how many tapped that booking button")
  }
  const see = shows.length === 0 ? "your offer" : `your offer and ${joinAnd(shows)}`
  return `When someone scans your QR code, they see a page with ${see}. We can tell you ${joinAnd(counts)}. Nothing to set up. Already have a booking page you love? You can use it here too.`
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}
