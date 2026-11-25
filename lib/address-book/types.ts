import type { Recipient } from "@/lib/click2mail/recipients"

/** One saved address. Company is optional and stored as an empty string when omitted. */
export interface AddressEntry {
  id: string
  listId: string
  ownerId: string
  first: string
  last: string
  organization: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  createdAt: string
  updatedAt: string
}

export interface AddressListSummary {
  id: string
  name: string
  count: number
  createdAt: string
}

export interface CustomerList {
  id: string
  ownerId: string
  name: string
  csv: string
  createdAt: string
}

export interface PublicList {
  id: string
  name: string
  createdAt: string
}

export interface AddressInput {
  first?: string
  last?: string
  organization?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
}

export type AddressField = "first" | "last" | "organization" | "address1" | "address2" | "city" | "state" | "zip"

export type AddressFieldErrors = Partial<Record<AddressField, string>>

export const MAX_ADDRESSES_PER_LIST = 5000

export function asRecipient(entry: Pick<AddressEntry, AddressField>): Recipient {
  return {
    first: entry.first,
    last: entry.last,
    organization: entry.organization,
    address1: entry.address1,
    address2: entry.address2,
    city: entry.city,
    state: entry.state,
    zip: entry.zip,
  }
}
