import assert from "node:assert/strict"
import { test } from "node:test"

import { readAudit } from "@/lib/ops/audit"

import { CARD_FONTS, CARD_INK_COLORS, MESSAGE_LIMIT } from "./note"
import { CARD_FORMAT, placeCardOrder } from "./product"
import { createMemoryCardStore } from "./store"
import {
  addPerson,
  chargeReminder,
  deleteUnlockedCard,
  lockDueCards,
  markCardPaid,
  openLockCheckout,
  queueUnpaid,
  setCardDestination,
  submitCardToPrinter,
  updateUnlockedCard,
} from "./service"

const ADDRESS = { address1: "123 Main St", city: "Austin", state: "TX", zip: "78701" }

test("the folded notecard is listed and no order is placed", () => {
  assert.equal(CARD_FORMAT.apiSupport, "to_confirm")
  assert.equal(CARD_FORMAT.widthInches, 4.25)
  assert.equal(CARD_FORMAT.heightInches, 5.5)
  assert.match(CARD_FORMAT.documentClass, /4\.25 x 5\.5/)
  assert.throws(() => placeCardOrder(), /to confirm/)
  assert.throws(() => submitCardToPrinter(), /No order was placed/)
  assert.equal(CARD_FONTS.length, 10)
  assert.equal(CARD_INK_COLORS.length, 8)
  assert.equal(MESSAGE_LIMIT, 300)
})

test("unlocked cards can change, a smaller list is re-priced, and a paid card keeps its price", async () => {
  const store = createMemoryCardStore()
  const ownerId = `ada-${Date.now()}`
  const today = "2026-01-01"
  const ids: string[] = []
  for (let index = 0; index < 5; index += 1) {
    const saved = await addPerson(
      { ownerId, audience: "personal", name: `Person ${index} One`, month: index === 0 ? 3 : 11, day: 15, ...ADDRESS, today },
      store,
    )
    ids.push(saved.card.id)
  }
  const fifth = await store.getCard(ownerId, ids[4]!)
  assert.equal(fifth?.priceCents, 450)
  await deleteUnlockedCard(ownerId, ids[4]!, store, today)
  const first = await store.getCard(ownerId, ids[0]!)
  assert.equal(first?.priceCents, 500)
  await lockDueCards(ownerId, first!.lockDate, store)
  await markCardPaid(ownerId, first!.id, 500, store)
  await deleteUnlockedCard(ownerId, ids[1]!, store, today)
  const kept = await store.getCard(ownerId, first!.id)
  assert.equal(kept?.priceCents, 500)
  assert.equal(kept?.status, "queued")
  assert.equal(kept?.charged, true)
  assert.equal(kept?.mailed, false)
  const later = await store.getCard(ownerId, ids[2]!)
  assert.equal(later?.priceCents, 500)
})

test("a locked card cannot be edited, cancelled, or queued unpaid", async () => {
  const store = createMemoryCardStore()
  const ownerId = `bea-${Date.now()}`
  const saved = await addPerson(
    { ownerId, audience: "personal", name: "Bea Owner", month: 8, day: 20, ...ADDRESS, today: "2026-01-01" },
    store,
  )
  await updateUnlockedCard(ownerId, saved.card.id, { note: { message: "Happy birthday", fontId: "serif", inkColorId: "navy" } }, store, "2026-01-01")
  assert.throws(() => queueUnpaid(), /unpaid/)
  await lockDueCards(ownerId, saved.card.lockDate, store)
  await assert.rejects(() => updateUnlockedCard(ownerId, saved.card.id, { name: "Changed Name" }, store, saved.card.lockDate), /locked/)
  await assert.rejects(() => deleteUnlockedCard(ownerId, saved.card.id, store, saved.card.lockDate), /locked/)
  await assert.rejects(() => markCardPaid(ownerId, saved.card.id, 1, store), /full price/)
  const unpaid = await store.getCard(ownerId, saved.card.id)
  assert.equal(unpaid?.status, "locked")
  assert.equal(unpaid?.charged, false)
  const reminder = chargeReminder(unpaid!, saved.person.name)
  assert.equal(reminder.sent, false)
  assert.match(reminder.text, /not emailed/)
})

test("checkout stays in test mode and another account cannot see the card", async () => {
  const store = createMemoryCardStore()
  const ownerId = `cy-${Date.now()}`
  const saved = await addPerson(
    { ownerId, audience: "personal", name: "Cy Owner", month: 9, day: 2, ...ADDRESS, today: "2026-01-01" },
    store,
  )
  const link = await setCardDestination(ownerId, saved.card.id, "https://example.com/note", store)
  assert.match(link.href, /\/api\/cards\/go\//)
  await lockDueCards(ownerId, saved.card.lockDate, store)
  await assert.rejects(() => setCardDestination(ownerId, saved.card.id, "https://example.com/other", store), /locks/)
  let called = false
  const opened = await openLockCheckout({
    ownerId,
    cardId: saved.card.id,
    origin: "https://example.com",
    store,
    env: { ...process.env, STRIPE_SECRET_KEY: "sk_test_123" },
    fetchImpl: async (_url, init) => {
      called = true
      const body = String(init?.body ?? "")
      const form = decodeURIComponent(body)
      assert.match(form, /postage_only\]=false/)
      assert.match(form, /unit_amount\]=500/)
      assert.doesNotMatch(form, /postage_only\]=true/)
      return new Response(JSON.stringify({ id: "cs_test", url: "https://example.com/pay" }), { status: 200 })
    },
  })
  assert.equal(called, true)
  assert.equal(opened.charged, false)
  assert.equal(opened.mailed, false)
  await assert.rejects(
    () =>
      openLockCheckout({
        ownerId,
        cardId: saved.card.id,
        origin: "https://example.com",
        store,
        env: { ...process.env, STRIPE_SECRET_KEY: "sk_live_x", STRIPE_LIVE_ENABLED: "" },
        fetchImpl: async () => {
          throw new Error("live checkout should not run")
        },
      }),
    /Nothing was charged/,
  )
  assert.equal(await store.getCard("someone-else", saved.card.id), null)
  const events = await readAudit()
  assert.equal(events.some((event) => event.subjectId === saved.card.id && event.action === "charge"), true)
})

test("a company card is not charged from the personal tiers", async () => {
  const store = createMemoryCardStore()
  const saved = await addPerson(
    {
      ownerId: `hr-${Date.now()}`,
      audience: "company",
      name: "Pat Manager",
      month: 4,
      day: 4,
      ...ADDRESS,
      today: "2026-01-01",
    },
    store,
  )
  assert.equal(saved.person.yearlyRepeat, true)
  assert.equal(saved.card.priceCents, null)
  await lockDueCards(saved.person.ownerId, saved.card.lockDate, store)
  await assert.rejects(
    () => openLockCheckout({ ownerId: saved.person.ownerId, cardId: saved.card.id, origin: "https://example.com", store, env: { ...process.env, STRIPE_SECRET_KEY: "sk_test_123" } }),
    /not set/,
  )
})
