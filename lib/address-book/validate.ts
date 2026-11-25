import { normalizeState, normalizeZip, type Recipient } from "@/lib/click2mail/recipients"

import type { AddressFieldErrors, AddressInput } from "./types"

const TOO_LONG = "Use 80 characters or fewer."

function clean(value: string | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim()
}

/**
 * Friendly checks for one address typed into the form.
 * This checks shape only. It does not ask the post office if the address exists.
 */
export function validateAddress(
  input: AddressInput
): { ok: true; recipient: Recipient } | { ok: false; errors: AddressFieldErrors } {
  const errors: AddressFieldErrors = {}
  const first = clean(input.first)
  const last = clean(input.last)
  const organization = clean(input.organization)
  const address1 = clean(input.address1)
  const address2 = clean(input.address2)
  const city = clean(input.city)
  const state = normalizeState(input.state ?? "")
  const zip = normalizeZip(input.zip ?? "")

  if (!first) errors.first = "Add a first name."
  else if (first.length > 80) errors.first = `First name is too long. ${TOO_LONG}`
  if (!last) errors.last = "Add a last name."
  else if (last.length > 80) errors.last = `Last name is too long. ${TOO_LONG}`
  if (organization.length > 80) errors.organization = `Company name is too long. ${TOO_LONG}`
  if (!address1) errors.address1 = "Add the street address."
  else if (address1.length > 80) errors.address1 = `Street address is too long. ${TOO_LONG}`
  if (address2.length > 80) errors.address2 = `Address line 2 is too long. ${TOO_LONG}`
  if (!city) errors.city = "Add the city."
  else if (city.length > 80) errors.city = `City is too long. ${TOO_LONG}`
  if (!state) errors.state = "Choose a U.S. state."
  if (!zip) errors.zip = "Use a 5-digit ZIP, or ZIP+4 like 78701-1234."

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    recipient: {
      first,
      last,
      organization,
      address1,
      address2,
      city,
      state: state as string,
      zip: zip as string,
    },
  }
}

export function rowMessages(errors: AddressFieldErrors, row: number): string[] {
  const order = ["first", "last", "organization", "address1", "address2", "city", "state", "zip"] as const
  return order.flatMap((field) => {
    const message = errors[field]
    return message ? [`Row ${row}: ${message}`] : []
  })
}
