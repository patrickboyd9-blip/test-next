"use client"

import { Button } from "@/components/ui/button"
import type { AudienceDefinition, AudienceListType } from "@/lib/campaign-creator/types"
import { cn } from "@/lib/utils"

import { Field } from "./BriefSummaryCard"

const LIST_OPTIONS: Array<{ id: AudienceListType; label: string }> = [
  { id: "house", label: "House list" },
  { id: "prospect", label: "Prospect list" },
  { id: "every_door", label: "Every Door" },
]

interface AudienceCardProps {
  audience: AudienceDefinition
  editable?: boolean
  onChange?: (draft: AudienceDefinition) => void
  onOpenRoutes?: () => void
  routesBusy?: boolean
}

export function AudienceCard({
  audience,
  editable = false,
  onChange,
  onOpenRoutes,
  routesBusy = false,
}: AudienceCardProps) {
  const readOnly = !editable
  const quantity =
    audience.quantityKind === "unavailable" || !audience.quantity ? "" : String(audience.quantity)

  function commit(next: AudienceDefinition) {
    onChange?.(next)
  }

  return (
    <section
      aria-label="Audience"
      data-testid="audience-card"
      className="flex flex-col gap-3 rounded-xl bg-card px-3 py-3 text-card-foreground ring-1 ring-foreground/10"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Audience</h3>
        {editable ? <span className="text-xs text-muted-foreground">You can edit this</span> : null}
      </div>
      {audience.fairHousingNote ? (
        <p className="text-sm text-foreground" role="status">
          {audience.fairHousingNote}
        </p>
      ) : null}
      <Field
        key={`who:${audience.description}`}
        label="Who"
        value={audience.description}
        readOnly={readOnly}
        multiline
        placeholder="Who should receive this?"
        onCommit={(value) => commit({ ...audience, description: value })}
      />
      {audience.geography || editable ? (
        <Field
          key={`where:${audience.geography?.label ?? ""}`}
          label="Where"
          value={audience.geography?.label ?? ""}
          readOnly={readOnly}
          placeholder="City, ZIP, or radius"
          onCommit={(value) =>
            commit({
              ...audience,
              geography: value.trim()
                ? {
                    kind: audience.geography?.kind ?? "city",
                    ...audience.geography,
                    label: value.trim(),
                  }
                : undefined,
            })
          }
        />
      ) : null}
      {audience.filters && audience.filters.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Filters</span>
          <ul className="flex flex-wrap gap-2">
            {audience.filters.map((filter) => (
              <li key={filter.id}>
                {readOnly ? (
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">{filter.label}</span>
                ) : (
                  <button
                    type="button"
                    className="rounded-full bg-muted px-2 py-1 text-xs hover:bg-muted/70"
                    onClick={() =>
                      commit({
                        ...audience,
                        filters: audience.filters?.filter((item) => item.id !== filter.id),
                      })
                    }
                  >
                    {filter.label}
                    <span className="sr-only">, remove</span>
                    <span aria-hidden="true"> ×</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">List</span>
        {readOnly ? (
          <span className="text-sm">
            {LIST_OPTIONS.find((option) => option.id === audience.listType)?.label ?? "Not chosen"}
          </span>
        ) : (
          <div role="radiogroup" aria-label="List type" className="flex flex-wrap gap-2">
            {LIST_OPTIONS.map((option) => {
              const selected = audience.listType === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs ring-1 ring-foreground/15",
                    selected ? "bg-primary text-primary-foreground" : "bg-background"
                  )}
                  onClick={() => commit({ ...audience, listType: option.id })}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <Field
        key={`quantity:${quantity}:${audience.quantityKind ?? ""}`}
        label="Quantity"
        value={quantity}
        readOnly={readOnly}
        type="number"
        placeholder="How many pieces?"
        onCommit={(value) => {
          const parsed = value.trim() ? Number(value) : undefined
          const next =
            parsed !== undefined && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
          commit({
            ...audience,
            quantity: next,
            quantityKind: next ? "requested" : "unavailable",
          })
        }}
      />
      <p className="text-xs text-muted-foreground">
        {audience.quantityKind === "from_upload"
          ? "This count is the number of names in your file."
          : audience.quantityKind === "requested"
            ? "You asked for this many. It is not a counted list."
            : "Count unavailable."}
      </p>
      {audience.provider?.message ? <p className="text-sm">{audience.provider.message}</p> : null}
      {editable && audience.provider?.hook === "eddm.routeMap" && onOpenRoutes ? (
        <Button type="button" variant="outline" onClick={onOpenRoutes} disabled={routesBusy}>
          {routesBusy ? "Saving…" : "Save for the route map"}
        </Button>
      ) : null}
    </section>
  )
}
