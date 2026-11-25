import type { Recipient } from "@/lib/click2mail/recipients"

/** Exact match after trimming and ignoring letter case. Apartment lines count. */
export function exactAddressKey(recipient: Pick<Recipient, "first" | "last" | "organization" | "address1" | "address2" | "city" | "state" | "zip">): string {
  return [
    recipient.first,
    recipient.last,
    recipient.organization,
    recipient.address1,
    recipient.address2,
    recipient.city,
    recipient.state,
    recipient.zip,
  ]
    .map((part) => part.trim().toUpperCase())
    .join("|")
}
