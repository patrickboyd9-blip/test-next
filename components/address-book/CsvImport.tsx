"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { importCsvAction } from "@/lib/address-book/actions"
import type { AddressActionState } from "@/lib/address-book/action-state"
import { inspectCsv, type ColumnMapping, type CsvPreview } from "@/lib/address-book/csv"

import type { BookTone } from "./tone"

const FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: "first", label: "First name" },
  { key: "last", label: "Last name" },
  { key: "fullName", label: "Full name" },
  { key: "organization", label: "Company" },
  { key: "address1", label: "Street" },
  { key: "address2", label: "Apt, suite" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
]

export function CsvImport({
  tone,
  listId,
  campaignId,
  prepareFile,
  onImported,
}: {
  tone: BookTone
  listId: string | null
  campaignId?: string
  prepareFile?: (text: string) => string | null
  onImported?: (state: AddressActionState) => void
}) {
  const router = useRouter()
  const handled = useRef<AddressActionState>(null)
  const [state, action, pending] = useActionState(importCsvAction, null)
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [csv, setCsv] = useState("")
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [fileError, setFileError] = useState("")

  useEffect(() => {
    if (!state?.ok || handled.current === state) return
    handled.current = state
    onImported?.(state)
    router.refresh()
  }, [state, router, onImported])

  const sample = useMemo(() => {
    if (!preview || !mapping) return []
    return preview.sample.map((row) => ({
      row: row.row,
      line: mappedLine(row.cells, mapping),
    }))
  }, [preview, mapping])

  async function onFile(file: File | null) {
    setFileError("")
    setPreview(null)
    setMapping(null)
    setCsv("")
    if (!file) return
    const text = await file.text()
    if (text.length > 1_000_000) {
      setFileError("Use a spreadsheet under 1 MB.")
      return
    }
    const rejected = prepareFile?.(text)
    if (rejected) {
      setFileError(rejected)
      return
    }
    const inspected = inspectCsv(text)
    setCsv(text)
    setPreview(inspected)
    setMapping(inspected.mapping)
    if (inspected.error) setFileError(inspected.error)
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className={tone.muted}>Upload a spreadsheet (CSV)</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="block min-h-12 w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[#5ce1ff] file:px-3 file:font-semibold file:text-[#041018]"
          onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {fileError ? <p className={tone.error}>{fileError}</p> : null}
      {preview && mapping && !preview.error ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="csv" value={csv} />
          <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
          <input type="hidden" name="listId" value={listId ?? ""} />
          <input type="hidden" name="campaignId" value={campaignId ?? ""} />
          <p className={tone.body}>
            {preview.dataRows} {preview.dataRows === 1 ? "row" : "rows"} found. Match each column, then add the ones that look right.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <label key={field.key} className="block text-sm">
                <span className={tone.muted}>{field.label}</span>
                <select
                  className={tone.input}
                  value={mapping[field.key] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value
                    setMapping({ ...mapping, [field.key]: value === "" ? null : Number(value) })
                  }}
                >
                  <option value="">Not in the file</option>
                  {preview.headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {header || `Column ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {sample.length > 0 ? (
            <div className="overflow-x-auto">
              <p className={tone.muted}>First rows</p>
              <ul className="space-y-1">
                {sample.map((row) => (
                  <li key={row.row} className={tone.body}>
                    Row {row.row}: {row.line || "Blank row"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button type="submit" disabled={pending} className={tone.button}>
            {pending ? "Adding…" : "Add these addresses"}
          </button>
        </form>
      ) : null}
      {state?.message ? <p className={state.ok ? tone.body : tone.error}>{state.message}</p> : null}
      {state?.importResult?.messages.map((message) => (
        <p key={message} className={tone.error}>
          {message}
        </p>
      ))}
    </div>
  )
}

function mappedLine(cells: string[], mapping: ColumnMapping): string {
  const at = (index: number | null) => (index === null ? "" : (cells[index] ?? "").trim())
  const name = [at(mapping.first), at(mapping.last)].filter(Boolean).join(" ") || at(mapping.fullName)
  return [name, at(mapping.organization), at(mapping.address1), at(mapping.address2), at(mapping.city), at(mapping.state), at(mapping.zip)]
    .filter(Boolean)
    .join(", ")
}
