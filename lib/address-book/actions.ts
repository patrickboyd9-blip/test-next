"use server"

import { revalidatePath } from "next/cache"

import { CampaignAccessError, requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"

import type { AddressActionResult, AddressActionState } from "./action-state"
import { importMappedCsv, parseMapping } from "./csv"
import {
  addAddress,
  attachListToCampaign,
  createAddressList,
  deleteAddress,
  deleteAddressList,
  importRecipients,
  readAddressEntries,
  readOwnedList,
  renameAddressList,
  updateAddress,
} from "./store"
import { asRecipient, type AddressEntry } from "./types"
import { validateAddress } from "./validate"

function clean(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "")
}

async function owner(): Promise<{ userId: string } | { ok: false; message: string }> {
  const session = await getSession()
  if (!session) return { ok: false, message: "Sign in required." }
  return { userId: session.userId }
}

function signedOut(value: { userId: string } | { ok: false; message: string }): value is { ok: false; message: string } {
  return "ok" in value
}

function refresh(campaignId: string) {
  revalidatePath("/app/lists")
  revalidatePath("/app/mail")
  if (campaignId) revalidatePath(`/app/campaigns/${campaignId}/order`)
}

async function ownCampaign(campaignId: string): Promise<string | null> {
  if (!campaignId) return null
  try {
    await requireOwnedCampaign(campaignId)
    return null
  } catch (error) {
    if (error instanceof CampaignAccessError) {
      return error.status === 401 ? "Sign in required." : "That mailer was not found."
    }
    throw error
  }
}

export async function saveAddressAction(_prev: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const session = await owner()
  if (signedOut(session)) return session
  const campaignId = clean(formData, "campaignId")
  const blocked = await ownCampaign(campaignId)
  if (blocked) return { ok: false, message: blocked }
  const parsed = validateAddress({
    first: clean(formData, "first"),
    last: clean(formData, "last"),
    organization: clean(formData, "organization"),
    address1: clean(formData, "address1"),
    address2: clean(formData, "address2"),
    city: clean(formData, "city"),
    state: clean(formData, "state"),
    zip: clean(formData, "zip"),
  })
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  let listId = clean(formData, "listId")
  let listName = clean(formData, "listName")
  if (!listId) {
    try {
      const created = await createAddressList({ ownerId: session.userId, name: listName || "My customers" })
      listId = created.id
      listName = created.name
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "The list could not be saved." }
    }
  }

  const entryId = clean(formData, "entryId")
  const written = entryId
    ? await updateAddress({ ownerId: session.userId, listId, entryId, recipient: parsed.recipient })
    : await addAddress({ ownerId: session.userId, listId, recipient: parsed.recipient })
  if (!written.ok) return { ok: false, message: written.message }
  if (campaignId) {
    const attached = await attachListToCampaign({ ownerId: session.userId, campaignId, listId })
    if (!attached) return { ok: false, message: "That list was not found on this account." }
  }
  refresh(campaignId)
  const named = listName || "Address list"
  return { ok: true, message: entryId ? "Address updated." : "Address saved.", listId, listName: named, count: written.count }
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session) return
  const listId = clean(formData, "listId")
  const entryId = clean(formData, "entryId")
  const campaignId = clean(formData, "campaignId")
  await deleteAddress({ ownerId: session.userId, listId, entryId })
  refresh(campaignId)
}

export async function createListAction(_prev: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const session = await owner()
  if (signedOut(session)) return session
  try {
    const created = await createAddressList({ ownerId: session.userId, name: clean(formData, "listName") })
    refresh("")
    return { ok: true, message: "List saved.", listId: created.id, listName: created.name, count: 0 }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The list could not be saved." }
  }
}

export async function renameListAction(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session) return
  await renameAddressList({ ownerId: session.userId, listId: clean(formData, "listId"), name: clean(formData, "listName") })
  refresh(clean(formData, "campaignId"))
}

export async function deleteListAction(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session) return
  await deleteAddressList(session.userId, clean(formData, "listId"))
  refresh(clean(formData, "campaignId"))
}

export async function importCsvAction(_prev: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const session = await owner()
  if (signedOut(session)) return session
  const campaignId = clean(formData, "campaignId")
  const blocked = await ownCampaign(campaignId)
  if (blocked) return { ok: false, message: blocked }
  const csv = clean(formData, "csv")
  if (csv.length > 1_000_000) return { ok: false, message: "Use a spreadsheet under 1 MB." }
  let mapping
  try {
    mapping = parseMapping(JSON.parse(clean(formData, "mapping") || "null"))
  } catch {
    mapping = null
  }
  if (!mapping) return { ok: false, message: "Match the columns, then add the addresses." }

  let listId = clean(formData, "listId")
  let listName = clean(formData, "listName")
  if (listId) {
    const list = await readOwnedList(session.userId, listId)
    if (!list) return { ok: false, message: "That list was not found on this account." }
    if (!listName) listName = list.name
  }
  const existing = listId ? (await readAddressEntries(session.userId, listId)).map(asRecipient) : []
  const result = importMappedCsv(csv, mapping, existing)
  if (result.headerError) return { ok: false, message: result.headerError, importResult: summarize(result) }
  if (!listId) {
    if (result.accepted.length === 0) {
      return {
        ok: false,
        message: result.invalid.length > 0 ? "None of those rows could be added." : "Nothing new to add.",
        importResult: summarize(result),
      }
    }
    try {
      const created = await createAddressList({
        ownerId: session.userId,
        name: listName || "My customers",
        recipients: result.accepted,
      })
      listId = created.id
      listName = created.name
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "The list could not be saved." }
    }
  } else {
    const imported = await importRecipients({ ownerId: session.userId, listId, recipients: result.accepted })
    if (!imported.ok) return { ok: false, message: imported.message, importResult: summarize(result) }
  }
  if (campaignId) await attachListToCampaign({ ownerId: session.userId, campaignId, listId })
  const stored = await readAddressEntries(session.userId, listId)
  refresh(campaignId)
  const summary = summarize(result)
  const correction = summary.invalid === 1 ? "needs a correction" : "need a correction"
  return {
    ok: true,
    message: `${summary.added} added. ${summary.duplicates} already in the list. ${summary.invalid} ${correction}.`,
    listId,
    listName: listName || "Address list",
    count: stored.length,
    importResult: summary,
  }
}

function summarize(result: { accepted: unknown[]; duplicates: unknown[]; invalid: { row: number; messages: string[] }[] }) {
  return {
    added: result.accepted.length,
    duplicates: result.duplicates.length,
    invalid: result.invalid.length,
    messages: result.invalid.slice(0, 8).flatMap((row) => row.messages),
  }
}

export async function loadListEntriesAction(listId: string): Promise<AddressEntry[]> {
  const session = await getSession()
  if (!session || !listId) return []
  return readAddressEntries(session.userId, listId)
}

export async function attachCampaignListAction(campaignId: string, listId: string): Promise<AddressActionResult> {
  const session = await owner()
  if (signedOut(session)) return session
  const blocked = await ownCampaign(campaignId)
  if (blocked) return { ok: false, message: blocked }
  const attached = await attachListToCampaign({ ownerId: session.userId, campaignId, listId })
  if (!attached) return { ok: false, message: "That list was not found on this account." }
  const stored = await readAddressEntries(session.userId, listId)
  refresh(campaignId)
  return { ok: true, listId, count: stored.length }
}
