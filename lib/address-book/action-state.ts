import type { AddressFieldErrors } from "./types"

export interface AddressImportSummary {
  added: number
  duplicates: number
  invalid: number
  messages: string[]
}

export type AddressActionResult = {
  ok: boolean
  message?: string
  errors?: AddressFieldErrors
  listId?: string
  listName?: string
  count?: number
  importResult?: AddressImportSummary
}

export type AddressActionState = AddressActionResult | null
