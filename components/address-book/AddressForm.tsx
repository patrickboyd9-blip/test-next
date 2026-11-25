"use client"

import { useActionState, useEffect, useRef, useState, type InputHTMLAttributes } from "react"
import { useRouter } from "next/navigation"

import { saveAddressAction } from "@/lib/address-book/actions"
import type { AddressActionState } from "@/lib/address-book/action-state"
import { US_STATES } from "@/lib/address-book/states"
import type { AddressEntry, AddressField } from "@/lib/address-book/types"

import type { BookTone } from "./tone"

interface Draft {
  listName: string
  first: string
  last: string
  organization: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
}

export function AddressForm({
  tone,
  listId,
  listName,
  campaignId,
  entry,
  onSaved,
}: {
  tone: BookTone
  listId: string | null
  listName?: string
  campaignId?: string
  entry?: AddressEntry | null
  onSaved?: (state: AddressActionState) => void
}) {
  const router = useRouter()
  const handled = useRef<AddressActionState>(null)
  const [state, action, pending] = useActionState(saveAddressAction, null)
  const [dismissed, setDismissed] = useState<AddressActionState>(null)
  const [values, setValues] = useState<Draft>(() => draftFrom(entry, listName))
  const sourceId = entry?.id ?? "new"
  const [source, setSource] = useState(sourceId)
  const [clearedFor, setClearedFor] = useState<AddressActionState>(null)
  if (source !== sourceId) {
    setSource(sourceId)
    setValues(draftFrom(entry, listName))
  }
  if (state?.ok && !entry && clearedFor !== state) {
    setClearedFor(state)
    setValues(draftFrom(null, listName))
  }

  useEffect(() => {
    if (!state?.ok || handled.current === state) return
    handled.current = state
    onSaved?.(state)
    router.refresh()
  }, [state, router, onSaved])

  const visible = state && state !== dismissed ? state : null

  function setField(field: keyof Draft, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setDismissed(state)
  }

  return (
    <form action={action} className="space-y-3" key={entry?.id ?? "new"}>
      <input type="hidden" name="listId" value={listId ?? ""} />
      <input type="hidden" name="entryId" value={entry?.id ?? ""} />
      <input type="hidden" name="campaignId" value={campaignId ?? ""} />
      {listId ? null : (
        <Field tone={tone} name="listName" label="List name" value={values.listName} onValue={(value) => setField("listName", value)} autoComplete="off" />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field tone={tone} name="first" label="First name" value={values.first} onValue={(value) => setField("first", value)} autoComplete="given-name" error={visible?.errors?.first} />
        <Field tone={tone} name="last" label="Last name" value={values.last} onValue={(value) => setField("last", value)} autoComplete="family-name" error={visible?.errors?.last} />
        <Field
          tone={tone}
          name="organization"
          label="Company"
          optional
          value={values.organization}
          onValue={(value) => setField("organization", value)}
          autoComplete="organization"
          error={visible?.errors?.organization}
        />
        <Field tone={tone} name="address1" label="Street address" value={values.address1} onValue={(value) => setField("address1", value)} autoComplete="address-line1" error={visible?.errors?.address1} />
        <Field
          tone={tone}
          name="address2"
          label="Apt, suite"
          optional
          value={values.address2}
          onValue={(value) => setField("address2", value)}
          autoComplete="address-line2"
          error={visible?.errors?.address2}
        />
        <Field tone={tone} name="city" label="City" value={values.city} onValue={(value) => setField("city", value)} autoComplete="address-level2" error={visible?.errors?.city} />
        <label className="block text-sm">
          <span className={tone.muted}>State</span>
          <select
            name="state"
            value={values.state}
            autoComplete="address-level1"
            aria-invalid={visible?.errors?.state ? true : undefined}
            className={tone.input}
            onChange={(event) => setField("state", event.target.value)}
          >
            <option value="">State</option>
            {US_STATES.map((stateOption) => (
              <option key={stateOption.code} value={stateOption.code}>
                {stateOption.name}
              </option>
            ))}
          </select>
          {visible?.errors?.state ? <span className={tone.error}>{visible.errors.state}</span> : null}
        </label>
        <Field tone={tone} name="zip" label="ZIP" value={values.zip} onValue={(value) => setField("zip", value)} autoComplete="postal-code" inputMode="numeric" error={visible?.errors?.zip} />
      </div>
      {visible && !visible.ok && visible.message ? <p className={tone.error}>{visible.message}</p> : null}
      {visible?.ok && visible.message ? <p className={tone.body}>{visible.message}</p> : null}
      <button type="submit" disabled={pending} className={tone.button}>
        {pending ? "Saving…" : entry ? "Save address" : "Add address"}
      </button>
    </form>
  )
}

function draftFrom(entry: AddressEntry | null | undefined, listName: string | undefined): Draft {
  return {
    listName: listName || "My customers",
    first: entry?.first ?? "",
    last: entry?.last ?? "",
    organization: entry?.organization ?? "",
    address1: entry?.address1 ?? "",
    address2: entry?.address2 ?? "",
    city: entry?.city ?? "",
    state: entry?.state ?? "",
    zip: entry?.zip ?? "",
  }
}

function Field({
  tone,
  name,
  label,
  optional,
  error,
  value,
  onValue,
  ...rest
}: {
  tone: BookTone
  name: AddressField | "listName"
  label: string
  optional?: boolean
  error?: string
  value: string
  onValue: (value: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "name">) {
  return (
    <label className="block text-sm">
      <span className={tone.muted}>
        {label}
        {optional ? " (optional)" : ""}
      </span>
      <input name={name} value={value} aria-invalid={error ? true : undefined} className={tone.input} onChange={(event) => onValue(event.target.value)} {...rest} />
      {error ? <span className={tone.error}>{error}</span> : null}
    </label>
  )
}
