"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { submitDesignRequest } from "@/lib/design-requests/actions"
import type { DesignRequest } from "@/lib/design-requests/types"
import { RESPONSE_METHODS, RESPONSE_METHOD_LABELS, type ResponseMethod } from "@/lib/design-requests/types"

interface DesignRequestFormProps {
  onBack: () => void
}

const METHOD_HINT: Record<ResponseMethod, string> = {
  qr: "A code they can scan",
  phone: "A number they can call",
  website: "A page they can open",
  other: "Something else you will describe",
}

export function DesignRequestForm({ onBack }: DesignRequestFormProps) {
  const [companyName, setCompanyName] = useState("")
  const [address, setAddress] = useState("")
  const [vibe, setVibe] = useState("")
  const [offer, setOffer] = useState("")
  const [methods, setMethods] = useState<ResponseMethod[]>([])
  const [qrUrl, setQrUrl] = useState("")
  const [phone, setPhone] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [otherResponse, setOtherResponse] = useState("")
  const [notes, setNotes] = useState("")
  const [size, setSize] = useState("")
  const [logoName, setLogoName] = useState("")
  const [imageCount, setImageCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState<DesignRequest | null>(null)

  function toggleMethod(method: ResponseMethod) {
    setMethods((current) =>
      current.includes(method) ? current.filter((item) => item !== method) : [...current, method]
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const data = new FormData(event.currentTarget)
      const result = await submitDesignRequest(data)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved(result.request)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That request could not be saved.")
    } finally {
      setPending(false)
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-4 py-6" role="status" data-slot="design-request-confirmation">
        <h1 className="text-xl font-semibold tracking-tight">We have your request</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          A designer will build a custom postcard for {saved.companyName} from the logo, offer,
          and style you shared. Nothing was emailed.
        </p>
        <Button type="button" variant="outline" className="w-fit" onClick={onBack}>
          Back to choices
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-5 py-6 text-left"
      data-slot="design-request-form"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Have our team design it</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Share your logo, offer, and style. Our designers build a custom postcard for you.
        </p>
      </div>

      <Field id="company-name" label="Company name" required>
        <Input
          id="company-name"
          name="companyName"
          value={companyName}
          autoComplete="organization"
          required
          onChange={(event) => setCompanyName(event.target.value)}
        />
      </Field>
      <Field id="address" label="Address" required>
        <Textarea
          id="address"
          name="address"
          value={address}
          autoComplete="street-address"
          required
          onChange={(event) => setAddress(event.target.value)}
        />
      </Field>
      <Field id="vibe" label="Desired vibe or style" required>
        <Textarea
          id="vibe"
          name="vibe"
          value={vibe}
          required
          placeholder="Calm and local, with room for a photograph"
          onChange={(event) => setVibe(event.target.value)}
        />
      </Field>
      <Field id="offer" label="The specific offer" required>
        <Input
          id="offer"
          name="offer"
          value={offer}
          required
          placeholder="Free inspection this month"
          onChange={(event) => setOffer(event.target.value)}
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs text-muted-foreground">How should people respond?</legend>
        {RESPONSE_METHODS.map((method) => {
          const checked = methods.includes(method)
          return (
            <label key={method} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="responseMethod"
                value={method}
                checked={checked}
                onChange={() => toggleMethod(method)}
                className="mt-0.5 size-4 accent-foreground"
              />
              <span>
                <span className="font-medium">{RESPONSE_METHOD_LABELS[method]}</span>
                <span className="block text-muted-foreground">{METHOD_HINT[method]}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {methods.includes("qr") && (
        <Field id="qr-url" label="QR code link" required>
          <Input
            id="qr-url"
            name="qrUrl"
            type="url"
            inputMode="url"
            value={qrUrl}
            placeholder="https://"
            required
            onChange={(event) => setQrUrl(event.target.value)}
          />
        </Field>
      )}
      {methods.includes("phone") && (
        <Field id="phone" label="Phone number" required>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            required
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
      )}
      {methods.includes("website") && (
        <Field id="website-url" label="Website" required>
          <Input
            id="website-url"
            name="websiteUrl"
            type="url"
            inputMode="url"
            value={websiteUrl}
            placeholder="https://"
            required
            onChange={(event) => setWebsiteUrl(event.target.value)}
          />
        </Field>
      )}
      {methods.includes("other") && (
        <Field id="other-response" label="Other response" required>
          <Input
            id="other-response"
            name="otherResponse"
            value={otherResponse}
            required
            placeholder="Reply by mail, or visit the shop"
            onChange={(event) => setOtherResponse(event.target.value)}
          />
        </Field>
      )}

      <Field id="notes" label="Notes">
        <Textarea
          id="notes"
          name="notes"
          value={notes}
          placeholder="Anything the designer should know"
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      <Field id="size" label="Size">
        <select
          id="size"
          name="size"
          value={size}
          onChange={(event) => setSize(event.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">No preference</option>
          <option value="5x8">5×8</option>
          <option value="6x9">6×9</option>
        </select>
        <p className="text-xs leading-5 text-muted-foreground">
          Both sizes keep a quarter inch of bleed and a safe area inside the cut.
        </p>
      </Field>

      <Field id="logo" label="Logo">
        <Input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setLogoName(event.target.files?.[0]?.name ?? "")}
        />
        {logoName && <p className="text-xs text-muted-foreground">{logoName}</p>}
      </Field>
      <Field id="images" label="Other images">
        <Input
          id="images"
          name="images"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event) => setImageCount(event.target.files?.length ?? 0)}
        />
        {imageCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {imageCount} {imageCount === 1 ? "image" : "images"} selected
          </p>
        )}
      </Field>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending request…" : "Send to the design team"}
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  required = false,
  children,
}: {
  id: string
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="sr-only"> required</span> : null}
      </label>
      {children}
    </div>
  )
}
