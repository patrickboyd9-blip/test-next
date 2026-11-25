import { randomUUID } from "node:crypto"

import type { Recipient } from "@/lib/click2mail/recipients"
import { reviewCustomerList } from "@/lib/mail-journey/list-import"
import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { ADDRESS_CHECK_NOTE } from "./cass"
import { entriesToCsv } from "./csv"
import { exactAddressKey } from "./dedupe"
import { ensureAddressBookTables } from "./schema"
import {
  asRecipient,
  MAX_ADDRESSES_PER_LIST,
  type AddressEntry,
  type AddressListSummary,
  type CustomerList,
  type PublicList,
} from "./types"

export type { CustomerList, PublicList }

interface MemoryLink {
  ownerId: string
  campaignId: string
  listId: string
  jobId: string | null
  updatedAt: string
}

const lists: CustomerList[] = []
const entries: AddressEntry[] = []
const links: MemoryLink[] = []

export function resetCustomerLists(): void {
  lists.length = 0
  entries.length = 0
  links.length = 0
}

export function addressCheckNote(): string {
  return ADDRESS_CHECK_NOTE
}

function envOf(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return env ?? process.env
}

async function executor(env: NodeJS.ProcessEnv): Promise<SqlExecutor | null> {
  const url = postgresUrl(env)
  if (!url) return null
  const sql = createNeonExecutor(url)
  await ensureAddressBookTables(sql)
  return sql
}

function stamp(): string {
  return new Date().toISOString()
}

function listName(name: string, fallback: boolean): string {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 80)
  if (clean) return clean
  return fallback ? "Address list" : ""
}

export async function saveCustomerList(input: {
  ownerId: string
  name: string
  csv: string
  env?: NodeJS.ProcessEnv
}): Promise<CustomerList> {
  const review = reviewCustomerList(input.csv)
  return createAddressList({
    ownerId: input.ownerId,
    name: input.name,
    recipients: review.accepted,
    fallbackName: true,
    env: input.env,
  })
}

export async function createAddressList(input: {
  ownerId: string
  name: string
  recipients?: readonly Recipient[]
  fallbackName?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<CustomerList> {
  const name = listName(input.name, input.fallbackName === true)
  if (!name) throw new Error("Give this list a name.")
  const recipients = input.recipients ?? []
  if (recipients.length > MAX_ADDRESSES_PER_LIST) {
    throw new Error(`A list can hold ${MAX_ADDRESSES_PER_LIST.toLocaleString("en-US")} addresses. Split the rest into another list.`)
  }
  const now = stamp()
  const record: CustomerList = {
    id: randomUUID(),
    ownerId: input.ownerId,
    name,
    csv: entriesToCsv(recipients),
    createdAt: now,
  }
  const rows = recipients.map((recipient) => entryFrom(record, recipient, now))
  const sql = await executor(envOf(input.env))
  if (!sql) {
    lists.push(record)
    entries.push(...rows)
    return record
  }
  await sql.query(
    `INSERT INTO customer_lists (id, owner_id, name, csv, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [record.id, record.ownerId, record.name, record.csv, record.createdAt]
  )
  await insertEntryRows(sql, rows)
  return record
}

export async function listCustomerLists(ownerId: string, env: NodeJS.ProcessEnv = process.env): Promise<PublicList[]> {
  const rows = await listAddressLists(ownerId, env)
  return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.createdAt }))
}

export async function listAddressLists(ownerId: string, env: NodeJS.ProcessEnv = process.env): Promise<AddressListSummary[]> {
  const sql = await executor(env)
  if (!sql) {
    return lists
      .filter((row) => row.ownerId === ownerId)
      .map((row) => ({
        id: row.id,
        name: row.name,
        count: entries.filter((entry) => entry.listId === row.id && entry.ownerId === ownerId).length,
        createdAt: row.createdAt,
      }))
  }
  const rows = await sql.query<{ id: string; name: string; created_at: string | Date; count: string | number }>(
    `SELECT lists.id, lists.name, lists.created_at, COUNT(entries.id) AS count
     FROM customer_lists lists
     LEFT JOIN customer_list_entries entries ON entries.list_id = lists.id AND entries.owner_id = lists.owner_id
     WHERE lists.owner_id = $1
     GROUP BY lists.id, lists.name, lists.created_at
     ORDER BY lists.created_at ASC`,
    [ownerId]
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    count: Number(row.count) || 0,
    createdAt: iso(row.created_at),
  }))
}

export async function readOwnedList(ownerId: string, listId: string, env: NodeJS.ProcessEnv = process.env): Promise<CustomerList | null> {
  const sql = await executor(env)
  if (!sql) return lists.find((row) => row.ownerId === ownerId && row.id === listId) ?? null
  const rows = await sql.query<{ id: string; owner_id: string; name: string; csv: string; created_at: string | Date }>(
    `SELECT id, owner_id, name, csv, created_at FROM customer_lists WHERE owner_id = $1 AND id = $2`,
    [ownerId, listId]
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    csv: row.csv,
    createdAt: iso(row.created_at),
  }
}

export async function readAddressEntries(ownerId: string, listId: string, env: NodeJS.ProcessEnv = process.env): Promise<AddressEntry[]> {
  const owned = await readOwnedList(ownerId, listId, env)
  if (!owned) return []
  const sql = await executor(env)
  const current = sql ? await selectEntries(sql, ownerId, listId) : entries.filter((entry) => entry.ownerId === ownerId && entry.listId === listId)
  if (current.length > 0) return current
  const recovered = reviewCustomerList(owned.csv).accepted
  if (recovered.length === 0) return []
  const now = stamp()
  const rows = recovered.map((recipient) => entryFrom(owned, recipient, now))
  if (!sql) {
    entries.push(...rows)
    return rows
  }
  await insertEntryRows(sql, rows)
  return rows
}

export async function renameAddressList(input: {
  ownerId: string
  listId: string
  name: string
  env?: NodeJS.ProcessEnv
}): Promise<boolean> {
  const name = listName(input.name, false)
  if (!name) return false
  const env = envOf(input.env)
  const sql = await executor(env)
  if (!sql) {
    const row = lists.find((item) => item.ownerId === input.ownerId && item.id === input.listId)
    if (!row) return false
    row.name = name
    return true
  }
  const rows = await sql.query<{ id: string }>(
    `UPDATE customer_lists SET name = $1 WHERE owner_id = $2 AND id = $3 RETURNING id`,
    [name, input.ownerId, input.listId]
  )
  return rows.length > 0
}

export async function deleteAddressList(ownerId: string, listId: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const sql = await executor(env)
  if (!sql) {
    const index = lists.findIndex((item) => item.ownerId === ownerId && item.id === listId)
    if (index < 0) return false
    lists.splice(index, 1)
    for (let cursor = entries.length - 1; cursor >= 0; cursor -= 1) {
      if (entries[cursor]?.ownerId === ownerId && entries[cursor]?.listId === listId) entries.splice(cursor, 1)
    }
    for (let cursor = links.length - 1; cursor >= 0; cursor -= 1) {
      if (links[cursor]?.ownerId === ownerId && links[cursor]?.listId === listId) links.splice(cursor, 1)
    }
    return true
  }
  const rows = await sql.query<{ id: string }>(
    `DELETE FROM customer_lists WHERE owner_id = $1 AND id = $2 RETURNING id`,
    [ownerId, listId]
  )
  if (rows.length === 0) return false
  await sql.query(`DELETE FROM customer_list_entries WHERE owner_id = $1 AND list_id = $2`, [ownerId, listId])
  await sql.query(`DELETE FROM campaign_address_lists WHERE owner_id = $1 AND list_id = $2`, [ownerId, listId])
  return true
}

export type AddressWrite =
  | { ok: true; entry: AddressEntry; count: number }
  | { ok: false; message: string }

export async function addAddress(input: {
  ownerId: string
  listId: string
  recipient: Recipient
  env?: NodeJS.ProcessEnv
}): Promise<AddressWrite> {
  const env = envOf(input.env)
  const owned = await readOwnedList(input.ownerId, input.listId, env)
  if (!owned) return { ok: false, message: "That list was not found on this account." }
  const current = await readAddressEntries(input.ownerId, input.listId, env)
  if (current.length >= MAX_ADDRESSES_PER_LIST) {
    return { ok: false, message: `A list can hold ${MAX_ADDRESSES_PER_LIST.toLocaleString("en-US")} addresses.` }
  }
  if (current.some((entry) => exactAddressKey(entry) === exactAddressKey(input.recipient))) {
    return { ok: false, message: "This address is already in the list." }
  }
  const now = stamp()
  const entry = entryFrom(owned, input.recipient, now)
  const next = [...current.map(asRecipient), input.recipient]
  const sql = await executor(env)
  if (!sql) {
    entries.push(entry)
    const row = lists.find((item) => item.id === owned.id)
    if (row) row.csv = entriesToCsv(next)
    return { ok: true, entry, count: current.length + 1 }
  }
  await insertEntryRows(sql, [entry])
  await sql.query(`UPDATE customer_lists SET csv = $1 WHERE owner_id = $2 AND id = $3`, [entriesToCsv(next), input.ownerId, input.listId])
  return { ok: true, entry, count: current.length + 1 }
}

export async function updateAddress(input: {
  ownerId: string
  listId: string
  entryId: string
  recipient: Recipient
  env?: NodeJS.ProcessEnv
}): Promise<AddressWrite> {
  const env = envOf(input.env)
  const current = await readAddressEntries(input.ownerId, input.listId, env)
  const existing = current.find((entry) => entry.id === input.entryId)
  if (!existing) return { ok: false, message: "That address was not found on this list." }
  const key = exactAddressKey(input.recipient)
  if (current.some((entry) => entry.id !== input.entryId && exactAddressKey(entry) === key)) {
    return { ok: false, message: "This address is already in the list." }
  }
  const now = stamp()
  const updated: AddressEntry = { ...existing, ...input.recipient, updatedAt: now }
  const next = current.map((entry) => (entry.id === updated.id ? asRecipient(updated) : asRecipient(entry)))
  const sql = await executor(env)
  if (!sql) {
    const index = entries.findIndex((entry) => entry.id === updated.id && entry.ownerId === input.ownerId)
    if (index < 0) return { ok: false, message: "That address was not found on this list." }
    entries[index] = updated
    const row = lists.find((item) => item.ownerId === input.ownerId && item.id === input.listId)
    if (row) row.csv = entriesToCsv(next)
    return { ok: true, entry: updated, count: current.length }
  }
  const rows = await sql.query<{ id: string }>(
    `UPDATE customer_list_entries
     SET first_name = $1, last_name = $2, organization = $3, address1 = $4, address2 = $5,
         city = $6, state = $7, zip = $8, updated_at = $9
     WHERE id = $10 AND list_id = $11 AND owner_id = $12
     RETURNING id`,
    [
      updated.first,
      updated.last,
      updated.organization,
      updated.address1,
      updated.address2,
      updated.city,
      updated.state,
      updated.zip,
      updated.updatedAt,
      updated.id,
      input.listId,
      input.ownerId,
    ]
  )
  if (rows.length === 0) return { ok: false, message: "That address was not found on this list." }
  await sql.query(`UPDATE customer_lists SET csv = $1 WHERE owner_id = $2 AND id = $3`, [entriesToCsv(next), input.ownerId, input.listId])
  return { ok: true, entry: updated, count: current.length }
}

export async function deleteAddress(input: {
  ownerId: string
  listId: string
  entryId: string
  env?: NodeJS.ProcessEnv
}): Promise<boolean> {
  const env = envOf(input.env)
  const current = await readAddressEntries(input.ownerId, input.listId, env)
  if (!current.some((entry) => entry.id === input.entryId)) return false
  const next = current.filter((entry) => entry.id !== input.entryId).map(asRecipient)
  const sql = await executor(env)
  if (!sql) {
    const index = entries.findIndex((entry) => entry.id === input.entryId && entry.ownerId === input.ownerId && entry.listId === input.listId)
    if (index < 0) return false
    entries.splice(index, 1)
    const row = lists.find((item) => item.ownerId === input.ownerId && item.id === input.listId)
    if (row) row.csv = entriesToCsv(next)
    return true
  }
  const rows = await sql.query<{ id: string }>(
    `DELETE FROM customer_list_entries WHERE id = $1 AND list_id = $2 AND owner_id = $3 RETURNING id`,
    [input.entryId, input.listId, input.ownerId]
  )
  if (rows.length === 0) return false
  await sql.query(`UPDATE customer_lists SET csv = $1 WHERE owner_id = $2 AND id = $3`, [entriesToCsv(next), input.ownerId, input.listId])
  return true
}

export async function importRecipients(input: {
  ownerId: string
  listId: string
  recipients: readonly Recipient[]
  env?: NodeJS.ProcessEnv
}): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const env = envOf(input.env)
  const owned = await readOwnedList(input.ownerId, input.listId, env)
  if (!owned) return { ok: false, message: "That list was not found on this account." }
  if (input.recipients.length === 0) {
    const current = await readAddressEntries(input.ownerId, input.listId, env)
    return { ok: true, count: current.length }
  }
  const current = await readAddressEntries(input.ownerId, input.listId, env)
  const seen = new Set(current.map((entry) => exactAddressKey(entry)))
  const fresh = input.recipients.filter((recipient) => {
    const key = exactAddressKey(recipient)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (current.length + fresh.length > MAX_ADDRESSES_PER_LIST) {
    return { ok: false, message: `A list can hold ${MAX_ADDRESSES_PER_LIST.toLocaleString("en-US")} addresses. Split the rest into another list.` }
  }
  const now = stamp()
  const rows = fresh.map((recipient) => entryFrom(owned, recipient, now))
  const next = [...current.map(asRecipient), ...fresh]
  const sql = await executor(env)
  if (!sql) {
    entries.push(...rows)
    const row = lists.find((item) => item.id === owned.id)
    if (row) row.csv = entriesToCsv(next)
    return { ok: true, count: next.length }
  }
  await insertEntryRows(sql, rows)
  await sql.query(`UPDATE customer_lists SET csv = $1 WHERE owner_id = $2 AND id = $3`, [entriesToCsv(next), input.ownerId, input.listId])
  return { ok: true, count: next.length }
}

export async function attachListToCampaign(input: {
  ownerId: string
  campaignId: string
  listId: string
  env?: NodeJS.ProcessEnv
}): Promise<boolean> {
  const env = envOf(input.env)
  const owned = await readOwnedList(input.ownerId, input.listId, env)
  if (!owned) return false
  const now = stamp()
  const sql = await executor(env)
  if (!sql) {
    const existing = links.find((link) => link.ownerId === input.ownerId && link.campaignId === input.campaignId)
    if (existing) {
      existing.listId = input.listId
      existing.jobId = null
      existing.updatedAt = now
    } else {
      links.push({ ownerId: input.ownerId, campaignId: input.campaignId, listId: input.listId, jobId: null, updatedAt: now })
    }
    return true
  }
  await sql.query(
    `INSERT INTO campaign_address_lists (owner_id, campaign_id, list_id, job_id, updated_at)
     VALUES ($1, $2, $3, NULL, $4)
     ON CONFLICT (owner_id, campaign_id) DO UPDATE SET list_id = EXCLUDED.list_id, job_id = NULL, updated_at = EXCLUDED.updated_at`,
    [input.ownerId, input.campaignId, input.listId, now]
  )
  return true
}

export async function readCampaignList(
  ownerId: string,
  campaignId: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ list: CustomerList; entries: AddressEntry[]; jobId: string | null } | null> {
  const sql = await executor(env)
  if (!sql) {
    const link = links.find((item) => item.ownerId === ownerId && item.campaignId === campaignId)
    if (!link) return null
    const list = lists.find((item) => item.ownerId === ownerId && item.id === link.listId)
    if (!list) return null
    const rows = await readAddressEntries(ownerId, list.id, env)
    return { list, entries: rows, jobId: link.jobId }
  }
  const rows = await sql.query<{ list_id: string; job_id: string | null }>(
    `SELECT list_id, job_id FROM campaign_address_lists WHERE owner_id = $1 AND campaign_id = $2`,
    [ownerId, campaignId]
  )
  const link = rows[0]
  if (!link) return null
  const list = await readOwnedList(ownerId, link.list_id, env)
  if (!list) return null
  const stored = await readAddressEntries(ownerId, list.id, env)
  return { list, entries: stored, jobId: link.job_id }
}

export async function readCampaignRecipientCount(ownerId: string, campaignId: string, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const attached = await readCampaignList(ownerId, campaignId, env)
  return attached?.entries.length ?? 0
}

export async function rememberCampaignJob(input: {
  ownerId: string
  campaignId: string
  jobId: string
  env?: NodeJS.ProcessEnv
}): Promise<void> {
  const env = envOf(input.env)
  const sql = await executor(env)
  if (!sql) {
    const link = links.find((item) => item.ownerId === input.ownerId && item.campaignId === input.campaignId)
    if (link) link.jobId = input.jobId
    return
  }
  await sql.query(
    `UPDATE campaign_address_lists SET job_id = $1, updated_at = $2 WHERE owner_id = $3 AND campaign_id = $4`,
    [input.jobId, stamp(), input.ownerId, input.campaignId]
  )
}

function entryFrom(list: CustomerList, recipient: Recipient, now: string): AddressEntry {
  return {
    id: randomUUID(),
    listId: list.id,
    ownerId: list.ownerId,
    first: recipient.first,
    last: recipient.last,
    organization: recipient.organization,
    address1: recipient.address1,
    address2: recipient.address2,
    city: recipient.city,
    state: recipient.state,
    zip: recipient.zip,
    createdAt: now,
    updatedAt: now,
  }
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

async function selectEntries(sql: SqlExecutor, ownerId: string, listId: string): Promise<AddressEntry[]> {
  const rows = await sql.query<{
    id: string
    list_id: string
    owner_id: string
    first_name: string
    last_name: string
    organization: string
    address1: string
    address2: string
    city: string
    state: string
    zip: string
    created_at: string | Date
    updated_at: string | Date
  }>(
    `SELECT id, list_id, owner_id, first_name, last_name, organization, address1, address2, city, state, zip, created_at, updated_at
     FROM customer_list_entries
     WHERE owner_id = $1 AND list_id = $2
     ORDER BY created_at ASC, id ASC`,
    [ownerId, listId]
  )
  return rows.map((row) => ({
    id: row.id,
    listId: row.list_id,
    ownerId: row.owner_id,
    first: row.first_name,
    last: row.last_name,
    organization: row.organization,
    address1: row.address1,
    address2: row.address2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }))
}

async function insertEntryRows(sql: SqlExecutor, rows: readonly AddressEntry[]): Promise<void> {
  const chunk = 40
  for (let start = 0; start < rows.length; start += chunk) {
    const slice = rows.slice(start, start + chunk)
    const params: unknown[] = []
    const values = slice.map((row) => {
      const marks: string[] = []
      for (const value of [
        row.id,
        row.listId,
        row.ownerId,
        row.first,
        row.last,
        row.organization,
        row.address1,
        row.address2,
        row.city,
        row.state,
        row.zip,
        row.createdAt,
        row.updatedAt,
      ]) {
        params.push(value)
        marks.push(`$${params.length}`)
      }
      return `(${marks.join(", ")})`
    })
    await sql.query(
      `INSERT INTO customer_list_entries (
        id, list_id, owner_id, first_name, last_name, organization, address1, address2, city, state, zip, created_at, updated_at
      ) VALUES ${values.join(", ")}`,
      params
    )
  }
}
