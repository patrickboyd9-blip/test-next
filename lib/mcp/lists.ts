import { randomUUID } from "node:crypto"

import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { ensureMcpTables } from "./schema"

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

const memory: CustomerList[] = []

export function resetCustomerLists(): void {
  memory.length = 0
}

export async function saveCustomerList(input: {
  ownerId: string
  name: string
  csv: string
  env?: NodeJS.ProcessEnv
}): Promise<CustomerList> {
  const record: CustomerList = {
    id: randomUUID(),
    ownerId: input.ownerId,
    name: input.name.trim().slice(0, 80) || "Address list",
    csv: input.csv,
    createdAt: new Date().toISOString(),
  }
  const env = input.env ?? process.env
  if (!postgresUrl(env)) {
    memory.push(record)
    return record
  }
  const sql = neon(env)
  await ensureMcpTables(sql)
  await sql.query(
    `INSERT INTO customer_lists (id, owner_id, name, csv, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [record.id, record.ownerId, record.name, record.csv, record.createdAt]
  )
  return record
}

export async function listCustomerLists(ownerId: string, env: NodeJS.ProcessEnv = process.env): Promise<PublicList[]> {
  const rows = await owned(ownerId, env)
  return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.createdAt }))
}

export async function readOwnedList(ownerId: string, listId: string, env: NodeJS.ProcessEnv = process.env): Promise<CustomerList | null> {
  const rows = await owned(ownerId, env)
  return rows.find((row) => row.id === listId) ?? null
}

async function owned(ownerId: string, env: NodeJS.ProcessEnv): Promise<CustomerList[]> {
  if (!postgresUrl(env)) return memory.filter((row) => row.ownerId === ownerId)
  const sql = neon(env)
  await ensureMcpTables(sql)
  const rows = await sql.query<{
    id: string
    owner_id: string
    name: string
    csv: string
    created_at: string | Date
  }>(`SELECT id, owner_id, name, csv, created_at FROM customer_lists WHERE owner_id = $1`, [ownerId])
  return rows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    csv: row.csv,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }))
}

function neon(env: NodeJS.ProcessEnv): SqlExecutor {
  const url = postgresUrl(env)
  if (!url) throw new Error("Postgres is not configured.")
  return createNeonExecutor(url)
}
