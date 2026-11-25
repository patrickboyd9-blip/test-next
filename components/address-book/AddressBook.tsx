"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { attachCampaignListAction, createListAction, deleteAddressAction, deleteListAction, loadListEntriesAction, renameListAction } from "@/lib/address-book/actions"
import { ADDRESS_CHECK_NOTE } from "@/lib/address-book/cass"
import type { AddressEntry } from "@/lib/address-book/types"

import { AddressForm } from "./AddressForm"
import { CsvImport } from "./CsvImport"
import { bookTone } from "./tone"

export interface AddressListChoice {
  id: string
  name: string
  count: number
}

export function AddressBook({
  tone: toneName,
  lists,
  selectedId,
  entries,
  campaignId,
  onSelect,
  prepareFile,
}: {
  tone: "cockpit" | "paper"
  lists: AddressListChoice[]
  selectedId: string | null
  entries: AddressEntry[]
  campaignId?: string
  onSelect?: (list: AddressListChoice) => void
  prepareFile?: (text: string) => string | null
}) {
  const tone = bookTone(toneName)
  const router = useRouter()
  const entryKey = entries.map((entry) => `${entry.id}:${entry.updatedAt}`).join("|")
  const signature = `${selectedId ?? ""}|${entryKey}`
  const [syncKey, setSyncKey] = useState(signature)
  const [activeId, setActiveId] = useState(selectedId)
  const [rows, setRows] = useState(entries)
  if (syncKey !== signature) {
    setSyncKey(signature)
    const incomingFits = entries.length === 0 || entries.every((entry) => entry.listId === selectedId)
    const knownEmpty = entries.length === 0 && (selectedId === null || (lists.find((list) => list.id === selectedId)?.count ?? 0) === 0)
    if (incomingFits && (entries.length > 0 || knownEmpty)) {
      setActiveId(selectedId)
      setRows(entries)
    } else {
      setActiveId(selectedId)
    }
  }
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [chooseError, setChooseError] = useState("")
  const [created, createAction, creating] = useActionState(createListAction, null)
  const handledCreate = useRef<string | null>(null)

  useEffect(() => {
    if (!created?.ok || !created.listId || handledCreate.current === created.listId) return
    handledCreate.current = created.listId
    const choice = { id: created.listId, name: created.listName || "Address list", count: created.count ?? 0 }
    onSelect?.(choice)
    if (!onSelect) router.push(`/app/lists?list=${created.listId}`)
    router.refresh()
  }, [created, onSelect, router])

  const active = lists.find((list) => list.id === activeId) ?? null
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((entry) =>
      [entry.first, entry.last, entry.organization, entry.address1, entry.address2, entry.city, entry.state, entry.zip]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    )
  }, [query, rows])

  async function choose(list: AddressListChoice) {
    setChooseError("")
    setEditing(null)
    setActiveId(list.id)
    onSelect?.(list)
    const loaded = await loadListEntriesAction(list.id)
    setRows(loaded)
    if (!campaignId) return
    const result = await attachCampaignListAction(campaignId, list.id)
    if (!result.ok) {
      setChooseError(result.message ?? "That list could not be used.")
      return
    }
    router.refresh()
  }

  async function saved(choice: { listId?: string; listName?: string; count?: number } | null) {
    if (!choice?.listId) return
    const loaded = await loadListEntriesAction(choice.listId)
    setRows(loaded)
    setActiveId(choice.listId)
    onSelect?.({ id: choice.listId, name: choice.listName || active?.name || "Address list", count: choice.count ?? loaded.length })
  }

  return (
    <div className="space-y-4">
      <section className={`${tone.panel} space-y-4`}>
        <div>
          <h2 className={tone.title}>Address book</h2>
          <p className={`mt-1 ${tone.body}`}>Your customers stay here. Add one person, or a spreadsheet. Nothing is mailed from this screen.</p>
          <p className={`mt-2 ${tone.body}`}>{ADDRESS_CHECK_NOTE}</p>
        </div>
        <form action={createAction} className="flex flex-col gap-2 sm:flex-row">
          <label className="block flex-1 text-sm">
            <span className={tone.muted}>New list name</span>
            <input name="listName" placeholder="Spring customers" className={tone.input} />
          </label>
          <button type="submit" disabled={creating} className={`${tone.secondary} sm:self-end`}>
            {creating ? "Saving…" : "Create list"}
          </button>
        </form>
        {created && !created.ok && created.message ? <p className={tone.error}>{created.message}</p> : null}
        {lists.length === 0 ? <p className={tone.body}>No lists yet. Create one, then add an address.</p> : null}
        <ul className="space-y-2">
          {lists.map((list) => {
            const selected = list.id === activeId
            const label = (
              <>
                <span>{list.name}</span>
                <span className="text-sm opacity-80">
                  {list.count} {list.count === 1 ? "address" : "addresses"}
                </span>
              </>
            )
            return (
              <li key={list.id}>
                {onSelect || campaignId ? (
                  <button
                    type="button"
                    onClick={() => void choose(list)}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left ${selected ? tone.selected : tone.idle}`}
                  >
                    {label}
                  </button>
                ) : (
                  <Link
                    href={`/app/lists?list=${list.id}`}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 ${selected ? tone.selected : tone.idle}`}
                  >
                    {label}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
        {chooseError ? <p className={tone.error}>{chooseError}</p> : null}
      </section>

      <section className={`${tone.panel} space-y-4`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className={tone.title}>{active ? active.name : "Add an address"}</h2>
            <p className={tone.body}>{active ? `${rows.length} ${rows.length === 1 ? "address" : "addresses"}` : "These addresses are saved to your account."}</p>
          </div>
          {active ? (
            <form action={renameListAction} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="listId" value={active.id} />
              <input type="hidden" name="campaignId" value={campaignId ?? ""} />
              <input name="listName" defaultValue={active.name} aria-label="List name" className={tone.input} />
              <button type="submit" className={tone.secondary}>
                Rename
              </button>
            </form>
          ) : null}
        </div>
        {active ? (
          <label className="block text-sm">
            <span className={tone.muted}>Search this list</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, street, or ZIP" className={tone.input} />
          </label>
        ) : null}
        {query && active ? (
          <p className={tone.body}>
            Showing {filtered.length} of {rows.length}
          </p>
        ) : null}
        <ul>
          {filtered.map((entry) => (
            <li key={entry.id} className={tone.row}>
              {editing === entry.id ? (
                <AddressForm
                  tone={tone}
                  listId={activeId}
                  campaignId={campaignId}
                  entry={entry}
                  onSaved={() => setEditing(null)}
                />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {entry.first} {entry.last}
                    </p>
                    {entry.organization ? <p className={tone.body}>{entry.organization}</p> : null}
                    <p className={tone.body}>
                      {entry.address1}
                      {entry.address2 ? `, ${entry.address2}` : ""}
                    </p>
                    <p className={tone.body}>
                      {entry.city}, {entry.state} {entry.zip}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={tone.secondary} onClick={() => setEditing(entry.id)}>
                      Edit
                    </button>
                    <form
                      action={async (formData) => {
                        await deleteAddressAction(formData)
                        router.refresh()
                      }}
                    >
                      <input type="hidden" name="listId" value={entry.listId} />
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input type="hidden" name="campaignId" value={campaignId ?? ""} />
                      <button type="submit" className={tone.quiet}>
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {active && rows.length === 0 ? <p className={tone.body}>No addresses yet. Add one below, or upload a spreadsheet.</p> : null}
        <AddressForm tone={tone} listId={activeId ?? lists[0]?.id ?? null} campaignId={campaignId} onSaved={saved} />
        <CsvImport tone={tone} listId={activeId ?? lists[0]?.id ?? null} campaignId={campaignId} prepareFile={prepareFile} onImported={saved} />
        {active ? (
          <form
            action={async (formData) => {
              await deleteListAction(formData)
              if (!onSelect && !campaignId) router.push("/app/lists")
              router.refresh()
            }}
          >
            <input type="hidden" name="listId" value={active.id} />
            <input type="hidden" name="campaignId" value={campaignId ?? ""} />
            <button type="submit" className={tone.quiet}>
              Delete this list
            </button>
          </form>
        ) : null}
      </section>
    </div>
  )
}
