import type { Recipient } from "@/lib/click2mail/recipients"

export interface VerificationReport {
  status: "not_checked"
  note: string
}

/**
 * Postal verification seam.
 *
 * TODO: When Click2Mail CASS/USPS address verification is approved, implement
 * this interface with that provider call and record deliverable vs undeliverable
 * on each entry. Do not call a paid verification API from the address book.
 * Callers must keep working while verification is not configured.
 */
export interface AddressVerifier {
  readonly configured: false
  verify(entries: readonly Recipient[]): Promise<VerificationReport>
}

const NOTE =
  "Checked that each address has a name, street, city, a U.S. state, and a ZIP. This is not a postal delivery check."

export function unverifiedAddressCheck(): AddressVerifier {
  return {
    configured: false,
    async verify(entries) {
      void entries
      return { status: "not_checked", note: NOTE }
    },
  }
}

export const ADDRESS_CHECK_NOTE = NOTE
