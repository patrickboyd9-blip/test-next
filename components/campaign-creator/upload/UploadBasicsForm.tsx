"use client"

import { useState, type FormEvent } from "react"

import { parseUploadPathBasics, type UploadPathBasics } from "@/lib/bring-your-own-design/upload-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface UploadBasicsFormProps {
  initial?: Partial<UploadPathBasics>
  submitLabel?: string
  onSubmit: (basics: UploadPathBasics) => Promise<void>
  onBack?: () => void
}

const EMPTY: UploadPathBasics = {
  campaignName: "",
  businessName: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
}

export function UploadBasicsForm({
  initial,
  submitLabel = "Continue to upload",
  onSubmit,
  onBack,
}: UploadBasicsFormProps) {
  const [values, setValues] = useState<UploadPathBasics>({ ...EMPTY, ...initial })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function setField(field: keyof UploadPathBasics, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseUploadPathBasics(values)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setError(null)
    setPending(true)
    try {
      await onSubmit(parsed.value)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Those details could not be saved.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5 text-left">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">A name and a return address</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          The printer needs these on the mail. Then you can upload the front and the back.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <LabeledInput
          label="Campaign name"
          value={values.campaignName}
          autoComplete="off"
          onChange={(value) => setField("campaignName", value)}
        />
        <LabeledInput
          label="Business name"
          value={values.businessName}
          autoComplete="organization"
          onChange={(value) => setField("businessName", value)}
        />
        <LabeledInput
          label="Street address"
          value={values.street}
          autoComplete="address-line1"
          onChange={(value) => setField("street", value)}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_5rem_7rem]">
          <LabeledInput
            label="City"
            value={values.city}
            autoComplete="address-level2"
            onChange={(value) => setField("city", value)}
          />
          <LabeledInput
            label="State"
            value={values.state}
            autoComplete="address-level1"
            maxLength={2}
            onChange={(value) => setField("state", value)}
          />
          <LabeledInput
            label="ZIP"
            value={values.postalCode}
            autoComplete="postal-code"
            inputMode="numeric"
            onChange={(value) => setField("postalCode", value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
            Back
          </Button>
        )}
      </div>
    </form>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  autoComplete,
  maxLength,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  maxLength?: number
  inputMode?: "numeric" | "text"
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-")
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
