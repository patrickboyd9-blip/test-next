import { randomUUID } from "node:crypto"

import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { ensureCardTables } from "./schema"
import type { CardPerson, CardRedirect, GreetingCard } from "./types"

export interface CardStore {
  savePerson(person: CardPerson): Promise<void>
  listPeople(ownerId: string): Promise<CardPerson[]>
  getPerson(ownerId: string, id: string): Promise<CardPerson | null>
  deletePerson(ownerId: string, id: string): Promise<void>
  saveCard(card: GreetingCard): Promise<void>
  listCards(ownerId: string): Promise<GreetingCard[]>
  getCard(ownerId: string, id: string): Promise<GreetingCard | null>
  deleteCard(ownerId: string, id: string): Promise<void>
  saveRedirect(redirect: CardRedirect): Promise<void>
  getRedirect(code: string): Promise<CardRedirect | null>
}

export function createMemoryCardStore(): CardStore {
  const people = new Map<string, CardPerson>()
  const cards = new Map<string, GreetingCard>()
  const redirects = new Map<string, CardRedirect>()
  return {
    async savePerson(person) {
      people.set(person.id, person)
    },
    async listPeople(ownerId) {
      return [...people.values()].filter((person) => person.ownerId === ownerId)
    },
    async getPerson(ownerId, id) {
      const person = people.get(id)
      return person && person.ownerId === ownerId ? person : null
    },
    async deletePerson(ownerId, id) {
      const person = people.get(id)
      if (person?.ownerId === ownerId) people.delete(id)
    },
    async saveCard(card) {
      cards.set(card.id, card)
    },
    async listCards(ownerId) {
      return [...cards.values()].filter((card) => card.ownerId === ownerId)
    },
    async getCard(ownerId, id) {
      const card = cards.get(id)
      return card && card.ownerId === ownerId ? card : null
    },
    async deleteCard(ownerId, id) {
      const card = cards.get(id)
      if (card?.ownerId === ownerId) cards.delete(id)
    },
    async saveRedirect(redirect) {
      redirects.set(redirect.code, redirect)
    },
    async getRedirect(code) {
      return redirects.get(code) ?? null
    },
  }
}

let memory: CardStore | null = null

export function getCardStore(): CardStore {
  const url = postgresUrl()
  if (!url) {
    if (!memory) memory = createMemoryCardStore()
    return memory
  }
  return createSqlCardStore(createNeonExecutor(url))
}

export function resetMemoryCardStore(): void {
  memory = createMemoryCardStore()
}

function createSqlCardStore(sql: SqlExecutor): CardStore {
  const ready = ensureCardTables(sql)
  return {
    async savePerson(person) {
      await ready
      await sql.query(
        `INSERT INTO card_people (id, owner_id, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, owner_id = EXCLUDED.owner_id`,
        [person.id, person.ownerId, JSON.stringify(person)],
      )
    },
    async listPeople(ownerId) {
      await ready
      const rows = await sql.query<{ data: unknown }>(`SELECT data FROM card_people WHERE owner_id = $1`, [ownerId])
      return rows.map((row) => parse<CardPerson>(row.data))
    },
    async getPerson(ownerId, id) {
      await ready
      const rows = await sql.query<{ data: unknown }>(`SELECT data FROM card_people WHERE id = $1 AND owner_id = $2`, [id, ownerId])
      return rows[0] ? parse<CardPerson>(rows[0].data) : null
    },
    async deletePerson(ownerId, id) {
      await ready
      await sql.query(`DELETE FROM card_people WHERE id = $1 AND owner_id = $2`, [id, ownerId])
    },
    async saveCard(card) {
      await ready
      await sql.query(
        `INSERT INTO greeting_cards (id, owner_id, person_id, data) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, owner_id = EXCLUDED.owner_id, person_id = EXCLUDED.person_id`,
        [card.id, card.ownerId, card.personId, JSON.stringify(card)],
      )
    },
    async listCards(ownerId) {
      await ready
      const rows = await sql.query<{ data: unknown }>(`SELECT data FROM greeting_cards WHERE owner_id = $1`, [ownerId])
      return rows.map((row) => parse<GreetingCard>(row.data))
    },
    async getCard(ownerId, id) {
      await ready
      const rows = await sql.query<{ data: unknown }>(`SELECT data FROM greeting_cards WHERE id = $1 AND owner_id = $2`, [id, ownerId])
      return rows[0] ? parse<GreetingCard>(rows[0].data) : null
    },
    async deleteCard(ownerId, id) {
      await ready
      await sql.query(`DELETE FROM greeting_cards WHERE id = $1 AND owner_id = $2`, [id, ownerId])
    },
    async saveRedirect(redirect) {
      await ready
      await sql.query(
        `INSERT INTO card_redirects (code, owner_id, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data`,
        [redirect.code, redirect.ownerId, JSON.stringify(redirect)],
      )
    },
    async getRedirect(code) {
      await ready
      const rows = await sql.query<{ data: unknown }>(`SELECT data FROM card_redirects WHERE code = $1`, [code])
      return rows[0] ? parse<CardRedirect>(rows[0].data) : null
    },
  }
}

function parse<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T
  return value as T
}

export function newId(): string {
  return randomUUID()
}
