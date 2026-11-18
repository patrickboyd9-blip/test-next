import { randomBytes } from "node:crypto"

import { normalizeRecipient } from "@/lib/click2mail/recipients"
import { appendAudit } from "@/lib/ops/audit"
import { stripeSecretDecision, openStripeCheckout } from "@/lib/ops/stripe"

import { isoDate, parseIsoDate, addDays, validMonthDay } from "./calendar"
import { DEFAULT_NOTE, parseCardNote, type CardNote } from "./note"
import { placeCardOrder } from "./product"
import { priceForAudience, type CardAudience } from "./pricing"
import { scheduleCard } from "./schedule"
import { getCardStore, newId, type CardStore } from "./store"
import { cardIsLocked, type CardPerson, type GreetingCard } from "./types"

const WINDOW_DAYS = 365

export class CardRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CardRuleError"
  }
}

export async function addPerson(
  input: {
    ownerId: string
    audience: CardAudience
    name: string
    month: number
    day: number
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    yearlyRepeat?: boolean
    note?: Partial<CardNote>
    today?: string
  },
  store: CardStore = getCardStore(),
): Promise<{ person: CardPerson; card: GreetingCard }> {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  if (!validMonthDay(input.month, input.day, 2024) && !validMonthDay(input.month, input.day, 2023)) {
    throw new CardRuleError("That birthday is not a real date.")
  }
  const address = normalizeRecipient({
    first: input.name.trim().split(/\s+/).slice(0, -1).join(" "),
    last: input.name.trim().split(/\s+/).at(-1) ?? "",
    address1: input.address1,
    address2: input.address2,
    city: input.city,
    state: input.state,
    zip: input.zip,
  })
  if (!address.recipient || input.name.trim().split(/\s+/).length < 2) {
    throw new CardRuleError(address.errors[0] ?? "Add a first and last name and a mailing address.")
  }
  const person: CardPerson = {
    id: newId(),
    ownerId: input.ownerId,
    audience: input.audience,
    name: input.name.trim(),
    month: input.month,
    day: input.day,
    address1: address.recipient.address1,
    address2: address.recipient.address2,
    city: address.recipient.city,
    state: address.recipient.state,
    zip: address.recipient.zip,
    yearlyRepeat: input.yearlyRepeat ?? input.audience === "company",
    createdAt: new Date().toISOString(),
  }
  await store.savePerson(person)
  const card = await createCardForPerson(person, today, input.note, store)
  await appendAudit({
    actorId: input.ownerId,
    action: "create",
    subjectId: card.id,
    before: null,
    after: { personId: person.id, mailed: false, charged: false },
  })
  return { person, card }
}

export async function updateUnlockedCard(
  ownerId: string,
  cardId: string,
  patch: { name?: string; month?: number; day?: number; address1?: string; city?: string; state?: string; zip?: string; note?: { message?: string; fontId?: string; inkColorId?: string }; yearlyRepeat?: boolean },
  store: CardStore = getCardStore(),
  today = new Date().toISOString().slice(0, 10),
): Promise<GreetingCard> {
  const card = await requireCard(store, ownerId, cardId)
  if (cardIsLocked(card)) throw new CardRuleError("This card is locked. It cannot be edited.")
  const person = await requirePerson(store, ownerId, card.personId)
  if (patch.name !== undefined) person.name = patch.name.trim()
  if (patch.month !== undefined) person.month = patch.month
  if (patch.day !== undefined) person.day = patch.day
  if (patch.address1 !== undefined) person.address1 = patch.address1
  if (patch.city !== undefined) person.city = patch.city
  if (patch.state !== undefined) person.state = patch.state
  if (patch.zip !== undefined) person.zip = patch.zip
  if (patch.yearlyRepeat !== undefined) person.yearlyRepeat = patch.yearlyRepeat
  await store.savePerson(person)
  const schedule = scheduleCard({ month: person.month, day: person.day, today: parseIsoDate(today) })
  const note = patch.note ? parseCardNote({ ...card.note, ...patch.note }) : card.note
  const next = { ...card, ...scheduleFields(schedule), note, year: Number(schedule.birthdayOn.slice(0, 4)), updatedAt: new Date().toISOString() }
  await store.saveCard(next)
  await repriceUnlocked(ownerId, today, store)
  return (await store.getCard(ownerId, cardId)) ?? next
}

export async function deleteUnlockedCard(ownerId: string, cardId: string, store: CardStore = getCardStore(), today = new Date().toISOString().slice(0, 10)): Promise<void> {
  const card = await requireCard(store, ownerId, cardId)
  if (cardIsLocked(card)) throw new CardRuleError("This card is locked. It cannot be deleted or refunded.")
  await store.deleteCard(ownerId, cardId)
  await repriceUnlocked(ownerId, today, store)
  await appendAudit({
    actorId: ownerId,
    action: "create",
    subjectId: cardId,
    before: { status: card.status },
    after: { deleted: true, mailed: false, charged: false },
  })
}

export async function refuseRefund(ownerId: string, cardId: string, store: CardStore = getCardStore()): Promise<never> {
  const card = await requireCard(store, ownerId, cardId)
  if (cardIsLocked(card)) throw new CardRuleError("A locked card cannot be cancelled or refunded.")
  throw new CardRuleError("Cancel the card before it locks. Nothing was refunded.")
}

export async function repriceUnlocked(ownerId: string, today: string, store: CardStore = getCardStore()): Promise<GreetingCard[]> {
  const cards = await store.listCards(ownerId)
  const count = cardsInWindow(cards, today).length
  const audience = cards[0]?.audience ?? "personal"
  const price = priceForAudience(audience, Math.max(count, 1))
  const next: GreetingCard[] = []
  for (const card of cards) {
    if (cardIsLocked(card) || card.charged) {
      next.push(card)
      continue
    }
    const updated = { ...card, priceCents: price.perCardCents, updatedAt: new Date().toISOString() }
    await store.saveCard(updated)
    next.push(updated)
  }
  await appendAudit({
    actorId: ownerId,
    action: "price",
    subjectId: ownerId,
    before: null,
    after: { count, perCardCents: price.perCardCents, postageOnly: false, configured: price.configured },
  })
  return next
}

export async function lockDueCards(ownerId: string, today: string, store: CardStore = getCardStore()): Promise<GreetingCard[]> {
  const cards = await store.listCards(ownerId)
  const locked: GreetingCard[] = []
  for (const card of cards) {
    if (card.status !== "scheduled" || today < card.lockDate) continue
    const next = { ...card, status: "locked" as const, updatedAt: new Date().toISOString() }
    await store.saveCard(next)
    locked.push(next)
    await appendAudit({
      actorId: ownerId,
      action: "charge",
      subjectId: card.id,
      before: { status: "scheduled" },
      after: { status: "locked", charged: false, queued: false, mailed: false, postageOnly: false },
    })
  }
  return locked
}

export async function openLockCheckout(input: {
  ownerId: string
  cardId: string
  origin: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  store?: CardStore
}): Promise<{ charged: false; queued: false; mailed: false; url: string }> {
  const store = input.store ?? getCardStore()
  const card = await requireCard(store, input.ownerId, input.cardId)
  if (card.status !== "locked") throw new CardRuleError("This card is not locked yet. Nothing was charged.")
  if (card.charged) throw new CardRuleError("This card is already paid. Nothing new was charged.")
  if (card.priceCents == null) throw new CardRuleError("Company pricing is not set yet. Nothing was charged.")
  const env = input.env ?? process.env
  const key = stripeSecretDecision(env)
  if (!key.ok) throw new CardRuleError(key.message)
  const session = await openStripeCheckout(key.secret, cardCheckoutForm(input, card), input.fetchImpl)
  await appendAudit({
    actorId: input.ownerId,
    action: "charge",
    subjectId: card.id,
    before: { status: "locked", charged: false },
    after: { charged: false, queued: false, mailed: false, postageOnly: false, amountCents: card.priceCents, sessionId: session.id },
  })
  return { charged: false, queued: false, mailed: false, url: session.url }
}

export async function markCardPaid(ownerId: string, cardId: string, amountCents: number, store: CardStore = getCardStore()): Promise<GreetingCard> {
  const card = await requireCard(store, ownerId, cardId)
  if (card.status !== "locked") throw new CardRuleError("Nothing is queued before the card locks.")
  if (card.priceCents == null || amountCents !== card.priceCents) {
    throw new CardRuleError("The amount is not the full price. Nothing was queued.")
  }
  const next: GreetingCard = { ...card, charged: true, status: "queued", mailed: false, updatedAt: new Date().toISOString() }
  await store.saveCard(next)
  await appendAudit({
    actorId: ownerId,
    action: "charge",
    subjectId: card.id,
    before: { charged: false },
    after: { charged: true, queued: true, mailed: false, postageOnly: false, amountCents },
  })
  return next
}

export function queueUnpaid(): never {
  throw new CardRuleError("Nothing is mailed unpaid. No order was placed.")
}

export function submitCardToPrinter(): never {
  placeCardOrder()
}

export async function setCardDestination(ownerId: string, cardId: string, destination: string, store: CardStore = getCardStore()): Promise<{ code: string; href: string }> {
  const card = await requireCard(store, ownerId, cardId)
  if (cardIsLocked(card)) throw new CardRuleError("The link cannot change after the card locks.")
  const url = checkedDestination(destination)
  const code = card.qrCode ?? randomBytes(5).toString("hex")
  await store.saveRedirect({ code, ownerId, cardId, destination: url, scans: (await store.getRedirect(code))?.scans ?? 0 })
  const next = { ...card, qrCode: code, updatedAt: new Date().toISOString() }
  await store.saveCard(next)
  return { code, href: `/api/cards/go/${code}` }
}

export async function recordCardScan(code: string, store: CardStore = getCardStore()): Promise<{ destination: string } | null> {
  const redirect = await store.getRedirect(code)
  if (!redirect) return null
  const next = { ...redirect, scans: redirect.scans + 1 }
  await store.saveRedirect(next)
  await appendAudit({
    actorId: redirect.ownerId,
    action: "scan",
    subjectId: redirect.cardId,
    before: { scans: redirect.scans },
    after: { scans: next.scans, mailed: false },
  })
  return { destination: redirect.destination }
}

export function chargeReminder(card: GreetingCard, personName: string): { sent: false; subject: string; text: string } {
  return {
    sent: false,
    subject: `A card for ${personName} locks on ${card.lockDate}`,
    text: `The card for ${personName} locks on ${card.lockDate}. That is when it is charged. Nothing is mailed until it is paid. This reminder was not emailed.`,
  }
}

function cardsInWindow(cards: GreetingCard[], today: string): GreetingCard[] {
  const start = isoDate(addDays(parseIsoDate(today), -WINDOW_DAYS))
  const end = isoDate(addDays(parseIsoDate(today), WINDOW_DAYS))
  return cards.filter((card) => card.mailDate >= start && card.mailDate <= end)
}

async function createCardForPerson(person: CardPerson, today: string, note: Partial<CardNote> | undefined, store: CardStore): Promise<GreetingCard> {
  const schedule = scheduleCard({ month: person.month, day: person.day, today: parseIsoDate(today) })
  const existing = await store.listCards(person.ownerId)
  const count = cardsInWindow([...existing, { mailDate: schedule.mailDate } as GreetingCard], today).length
  const price = priceForAudience(person.audience, count)
  const card: GreetingCard = {
    id: newId(),
    ownerId: person.ownerId,
    personId: person.id,
    audience: person.audience,
    year: Number(schedule.birthdayOn.slice(0, 4)),
    ...scheduleFields(schedule),
    mayArriveLate: schedule.mayArriveLate,
    status: "scheduled",
    priceCents: price.perCardCents,
    charged: false,
    mailed: false,
    note: note ? parseCardNote({ ...DEFAULT_NOTE, ...note }) : DEFAULT_NOTE,
    qrCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await store.saveCard(card)
  await repriceUnlocked(person.ownerId, today, store)
  return (await store.getCard(person.ownerId, card.id)) ?? card
}

function scheduleFields(schedule: ReturnType<typeof scheduleCard>) {
  return {
    birthdayOn: schedule.birthdayOn,
    mailDate: schedule.mailDate,
    recommendedOrderDate: schedule.recommendedOrderDate,
    lockDate: schedule.lockDate,
  }
}

function checkedDestination(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new CardRuleError("Use a full web address for the code.")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new CardRuleError("Use a web address for the code.")
  return url.toString()
}

function cardCheckoutForm(
  input: { ownerId: string; origin: string },
  card: GreetingCard,
): string {
  const amount = String(card.priceCents)
  const fields: Record<string, string> = {
    mode: "payment",
    success_url: `${input.origin}/api/cards/checkout/return?card=${card.id}`,
    cancel_url: `${input.origin}/api/cards/checkout/return?card=${card.id}&cancelled=1`,
    client_reference_id: card.id,
    "metadata[subject_id]": card.id,
    "metadata[actor_id]": input.ownerId,
    "metadata[amount_cents]": amount,
    "metadata[postage_only]": "false",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": amount,
    "line_items[0][price_data][product_data][name]": "Full price",
    "line_items[0][price_data][product_data][description]": "The card, the envelope, and postage. Not postage by itself.",
    "payment_method_types[0]": "card",
  }
  return new URLSearchParams(fields).toString()
}

async function requireCard(store: CardStore, ownerId: string, cardId: string): Promise<GreetingCard> {
  const card = await store.getCard(ownerId, cardId)
  if (!card) throw new CardRuleError("That card was not found.")
  return card
}

async function requirePerson(store: CardStore, ownerId: string, personId: string): Promise<CardPerson> {
  const person = await store.getPerson(ownerId, personId)
  if (!person) throw new CardRuleError("That person was not found.")
  return person
}
