"use client"

import { useEffect, useRef, useState } from "react"

import { mergeAddressSide } from "@/lib/campaign-creator/address-side"
import type { AddressSideFallbacks } from "@/lib/campaign-creator/address-side"
import { updateAddressSide } from "@/lib/campaign-creator/actions"
import type { AddressSideEdit, AddressSideSections, Campaign, CreativeSpec } from "@/lib/campaign-creator/types"

const SECTIONS: Array<{ id: keyof AddressSideSections; label: string }> = [
  { id: "offer", label: "Offer" },
  { id: "benefits", label: "Benefits" },
  { id: "proof", label: "Proof" },
  { id: "license", label: "License" },
  { id: "contact", label: "Phone and website" },
  { id: "returnAddress", label: "Return address" },
  { id: "qr", label: "QR code" },
  { id: "photo", label: "Photo" },
]

interface AddressSideEditorProps {
  spec: CreativeSpec
  campaignId?: string
  fallbacks: AddressSideFallbacks
  onPreview: (edit: AddressSideEdit) => void
  onSaved?: (campaign: Campaign) => void
}

export function AddressSideEditor({
  spec,
  campaignId,
  fallbacks,
  onPreview,
  onSaved,
}: AddressSideEditorProps) {
  const edit = spec.addressSide
  const sections = {
    offer: false,
    benefits: false,
    proof: true,
    license: false,
    contact: true,
    returnAddress: false,
    qr: false,
    photo: false,
    ...edit?.sections,
  }
  const [note, setNote] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const latest = useRef(edit)
  useEffect(() => {
    latest.current = edit
  }, [edit])

  function preview(patch: AddressSideEdit) {
    const next = mergeAddressSide(latest.current, patch)
    latest.current = next
    onPreview(next)
    return next
  }

  async function commit(patch: AddressSideEdit) {
    let next: AddressSideEdit
    try {
      next = preview(patch)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That photo could not be used.")
      return
    }
    if (!campaignId) return
    setNote("Saving…")
    try {
      const saved = await updateAddressSide(campaignId, next)
      setNote("Saved")
      onSaved?.(saved)
    } catch {
      setNote("Couldn’t save the back. Try again.")
    }
  }

  function toggle(id: keyof AddressSideSections) {
    setPhotoError(null)
    void commit({ sections: { [id]: !sections[id] } })
  }

  return (
    <form
      data-address-editor="back"
      className="flex w-full max-w-lg flex-col gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Back of the postcard</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Postage, the delivery address, and the barcode are reserved. They stay blank so the mailer can print them.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Business name</span>
        <TextControl
          label="Business name"
          stored={edit?.businessName}
          fallback={fallbacks.businessName ?? ""}
          onPreview={(value) => preview({ businessName: value })}
          onCommit={(value) => void commit({ businessName: value })}
        />
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id} className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sections[section.id]}
              onChange={() => toggle(section.id)}
            />
            {section.label}
          </label>
          {sections[section.id] ? (
            <SectionFields
              id={section.id}
              edit={edit}
              fallbacks={fallbacks}
              preview={preview}
              commit={commit}
            />
          ) : null}
          {section.id === "photo" && sections.photo ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={quietButton} onClick={() => fileRef.current?.click()}>
                Replace photo
              </button>
              <button
                type="button"
                className={quietButton}
                onClick={() => {
                  setPhotoError(null)
                  void commit({ photoSrc: "none" })
                }}
              >
                Remove photo
              </button>
              <button
                type="button"
                className={quietButton}
                onClick={() => {
                  setPhotoError(null)
                  void commit({ photoSrc: null })
                }}
              >
                Use campaign photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                aria-label="Replacement photo"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (!file) return
                  if (file.size > 400 * 1024) {
                    setPhotoError("That photo is too large. Use an image under 400 KB.")
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : ""
                    setPhotoError(null)
                    void commit({ photoSrc: result, sections: { photo: true } })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </div>
          ) : null}
        </div>
      ))}

      {photoError ? <p className="text-sm text-destructive">{photoError}</p> : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </form>
  )
}

function SectionFields({
  id,
  edit,
  fallbacks,
  preview,
  commit,
}: {
  id: keyof AddressSideSections
  edit: AddressSideEdit | undefined
  fallbacks: AddressSideFallbacks
  preview: (patch: AddressSideEdit) => void
  commit: (patch: AddressSideEdit) => void
}) {
  if (id === "offer") {
    return (
      <TextControl
        label="Offer"
        stored={edit?.offer}
        fallback={fallbacks.offer ?? ""}
        onPreview={(value) => preview({ offer: value })}
        onCommit={(value) => void commit({ offer: value })}
      />
    )
  }
  if (id === "benefits") {
    return (
      <TextControl
        label="Benefits"
        stored={edit?.benefits}
        fallback=""
        rows={3}
        placeholder="One benefit per line"
        onPreview={(value) => preview({ benefits: value })}
        onCommit={(value) => void commit({ benefits: value })}
      />
    )
  }
  if (id === "proof") {
    return (
      <TextControl
        label="Proof"
        stored={edit?.proof}
        fallback={fallbacks.proof ?? ""}
        onPreview={(value) => preview({ proof: value })}
        onCommit={(value) => void commit({ proof: value })}
      />
    )
  }
  if (id === "license") {
    return (
      <TextControl
        label="License"
        stored={edit?.license}
        fallback={fallbacks.license ?? ""}
        onPreview={(value) => preview({ license: value })}
        onCommit={(value) => void commit({ license: value })}
      />
    )
  }
  if (id === "contact") {
    return (
      <div className="flex flex-col gap-2">
        <TextControl
          label="Phone"
          stored={edit?.phone}
          fallback={fallbacks.phone ?? ""}
          onPreview={(value) => preview({ phone: value })}
          onCommit={(value) => void commit({ phone: value })}
        />
        <TextControl
          label="Website"
          stored={edit?.website}
          fallback={fallbacks.website ?? ""}
          onPreview={(value) => preview({ website: value })}
          onCommit={(value) => void commit({ website: value })}
        />
      </div>
    )
  }
  if (id === "returnAddress") {
    return (
      <TextControl
        label="Return address"
        stored={edit?.returnAddress}
        fallback={fallbacks.returnAddress ?? ""}
        rows={2}
        onPreview={(value) => preview({ returnAddress: value })}
        onCommit={(value) => void commit({ returnAddress: value })}
      />
    )
  }
  if (id === "qr") {
    return (
      <TextControl
        label="QR code link"
        stored={edit?.qrDestination}
        fallback={fallbacks.qrDestination ?? ""}
        onPreview={(value) => preview({ qrDestination: value })}
        onCommit={(value) => void commit({ qrDestination: value })}
      />
    )
  }
  return null
}

function TextControl({
  label,
  stored,
  fallback,
  rows,
  placeholder,
  onPreview,
  onCommit,
}: {
  label: string
  stored: string | undefined
  fallback: string
  rows?: number
  placeholder?: string
  onPreview: (value: string) => void
  onCommit: (value: string) => void
}) {
  const value = stored ?? fallback
  const props = {
    "aria-label": label,
    className: fieldClass,
    placeholder,
    value,
    onChange: (event: { target: { value: string } }) => onPreview(event.target.value),
    onBlur: (event: { target: { value: string } }) => {
      if (stored === undefined && event.target.value === fallback) return
      onCommit(event.target.value)
    },
  }
  if (rows) return <textarea {...props} rows={rows} />
  return <input {...props} />
}

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"

const quietButton =
  "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
