import assert from "node:assert/strict"
import { test } from "node:test"

import type { Recipient } from "@/lib/click2mail/recipients"

import { importMappedCsv, inspectCsv } from "./csv"
import {
  addAddress,
  attachListToCampaign,
  createAddressList,
  deleteAddress,
  deleteAddressList,
  importRecipients,
  listAddressLists,
  readAddressEntries,
  readCampaignList,
  readOwnedList,
  renameAddressList,
  saveCustomerList,
  updateAddress,
} from "./store"

const env = {} as NodeJS.ProcessEnv

function person(first: string, address1 = "1 Main St", address2 = ""): Recipient {
  return {
    first,
    last: "Lee",
    organization: "",
    address1,
    address2,
    city: "Austin",
    state: "TX",
    zip: "78701",
  }
}

test("an owner can create lists, edit one address, and delete it", async () => {
  const owner = "ada-crud"
  const list = await createAddressList({ ownerId: owner, name: "  Spring customers  ", env })
  assert.equal(list.name, "Spring customers")
  const added = await addAddress({ ownerId: owner, listId: list.id, recipient: person("Ada"), env })
  assert.equal(added.ok, true)
  if (!added.ok) return
  const renamed = await updateAddress({
    ownerId: owner,
    listId: list.id,
    entryId: added.entry.id,
    recipient: person("Ada", "9 Oak St"),
    env,
  })
  assert.equal(renamed.ok, true)
  if (!renamed.ok) return
  assert.equal(renamed.entry.address1, "9 Oak St")
  assert.equal(await deleteAddress({ ownerId: owner, listId: list.id, entryId: added.entry.id, env }), true)
  assert.equal((await readAddressEntries(owner, list.id, env)).length, 0)
  assert.equal(await renameAddressList({ ownerId: owner, listId: list.id, name: "Fall customers", env }), true)
  const summaries = await listAddressLists(owner, env)
  assert.equal(summaries.find((item) => item.id === list.id)?.name, "Fall customers")
  assert.equal(await deleteAddressList(owner, list.id, env), true)
  assert.equal(await readOwnedList(owner, list.id, env), null)
})

test("manual addresses and a spreadsheet share one list, and exact copies are skipped", async () => {
  const owner = "ada-mix"
  const list = await createAddressList({ ownerId: owner, name: "Neighbors", env })
  const first = await addAddress({ ownerId: owner, listId: list.id, recipient: person("Ada"), env })
  assert.equal(first.ok, true)
  const again = await addAddress({ ownerId: owner, listId: list.id, recipient: person("ada"), env })
  assert.equal(again.ok, false)
  if (again.ok) return
  assert.match(again.message, /already in the list/)
  const csv = ["First,Last,Street,City,State,ZIP", "Ada,Lee,1 Main St,Austin,TX,78701", "Bea,Lee,2 Main St,Austin,TX,78702"].join("\n")
  const imported = importMappedCsv(csv, inspectCsv(csv).mapping, [person("Ada")])
  const stored = await importRecipients({ ownerId: owner, listId: list.id, recipients: imported.accepted, env })
  assert.equal(stored.ok, true)
  if (!stored.ok) return
  assert.equal(stored.count, 2)
  const rows = await readAddressEntries(owner, list.id, env)
  assert.deepEqual(rows.map((row) => row.first).sort(), ["Ada", "Bea"])
})

test("another account cannot read, change, or attach the list", async () => {
  const list = await createAddressList({ ownerId: "ada-wall", name: "Private", recipients: [person("Ada")], env })
  assert.equal(await readOwnedList("bea-wall", list.id, env), null)
  assert.equal((await readAddressEntries("bea-wall", list.id, env)).length, 0)
  const edited = await updateAddress({
    ownerId: "bea-wall",
    listId: list.id,
    entryId: "missing",
    recipient: person("Bea"),
    env,
  })
  assert.equal(edited.ok, false)
  assert.equal(await deleteAddressList("bea-wall", list.id, env), false)
  assert.equal(await attachListToCampaign({ ownerId: "bea-wall", campaignId: "camp-bea", listId: list.id, env }), false)
  assert.equal(await attachListToCampaign({ ownerId: "ada-wall", campaignId: "camp-ada", listId: list.id, env }), true)
  const ada = await readCampaignList("ada-wall", "camp-ada", env)
  assert.equal(ada?.entries.length, 1)
  assert.equal(await readCampaignList("bea-wall", "camp-ada", env), null)
  const still = await readOwnedList("ada-wall", list.id, env)
  assert.equal(still?.name, "Private")
})

test("a saved CSV becomes address rows on the same list", async () => {
  const csv = ["first,last,address,city,state,zip", "Ada,Lee,1 Main St,Austin,TX,78701", "Bea,Lee,2 Main St,Austin,TX,78702"].join("\n")
  const saved = await saveCustomerList({ ownerId: "ada-csv", name: "Upload", csv, env })
  const rows = await readAddressEntries("ada-csv", saved.id, env)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.address1, "1 Main St")
  assert.match(saved.csv, /Bea/)
})
