import type { EddmSize } from "@/lib/eddm/geometry"
import { childText, type XmlElement } from "@/lib/click2mail/xml"

const FIELDS = [
  "documentClass",
  "layout",
  "productionTime",
  "envelope",
  "color",
  "paperType",
  "printOption",
  "mailClass",
] as const

export type ProductOptionField = (typeof FIELDS)[number]

/** One valid combination returned by GET /productOptions/advanced. */
export interface ProductOptionRow {
  documentClass: string
  layout: string
  productionTime: string
  envelope: string
  color: string
  paperType: string
  printOption: string
  mailClass: string
}

/**
 * Click2Mail (Mahesh, Oct 27) said a hand-typed mail class is why job 1304272
 * returned "Sku not found". These strings are taken from the lookup.
 * Full Service is preferred only when that exact text is in the response.
 */
export function selectEddmProduct(
  rows: readonly ProductOptionRow[],
  size: EddmSize,
  preferred?: { documentClass?: string; mailClass?: string }
): ProductOptionRow {
  const sized = rows.filter((row) => matchesEddmSize(row.documentClass, size))
  if (sized.length === 0) {
    const label = size === "6.5x9" ? "6.5×9" : "6.25×11"
    throw new Error(
      `Click2Mail did not return a product option for a ${label} Every Door card. Save a job template in the staging site and set C2M_EDDM_JOB_TEMPLATE.`
    )
  }
  const documentClass = preferred?.documentClass?.trim()
  const pool = documentClass
    ? sized.filter((row) => row.documentClass === documentClass)
    : sized
  if (documentClass && pool.length === 0) {
    throw new Error(
      `That document class is not one Click2Mail returned for this card. Leave the override unset, or copy the value from the product options list.`
    )
  }
  const mailClass = preferred?.mailClass?.trim()
  if (mailClass) {
    const exact = pool.find((row) => row.mailClass === mailClass)
    if (!exact) {
      throw new Error(
        `C2M_EDDM_MAIL_CLASS is not a mail class Click2Mail returned for this card. Leave it unset, or copy the value from the product options list.`
      )
    }
    return exact
  }
  return [...pool].sort((a, b) => score(b) - score(a))[0] as ProductOptionRow
}

export function parseProductOptions(root: XmlElement): ProductOptionRow[] {
  const rows: ProductOptionRow[] = []
  const seen = new Set<string>()
  const add = (row: ProductOptionRow) => {
    if (!row.documentClass || !row.mailClass) return
    const key = JSON.stringify(row)
    if (seen.has(key)) return
    seen.add(key)
    rows.push(row)
  }
  const walk = (element: XmlElement, context: Partial<ProductOptionRow>) => {
    const flat = directRow(element)
    if (flat) {
      add(flat)
      return
    }
    const field = FIELDS.find((name) => name.toLowerCase() === element.name.toLowerCase())
    let next = context
    if (field) {
      const named = childText(element, "name") ?? childText(element, "value")
      const own = element.children.length === 0 ? element.text : ""
      const raw = named ?? own
      if (raw.trim() || raw === " ") {
        next = { ...context, [field]: raw.trim() ? raw.trim() : " " }
      }
    }
    if (field === "mailClass" && next.documentClass && next.mailClass) add(fill(next))
    for (const child of element.children) {
      if (field && child.name.toLowerCase() === "name") continue
      if (field && child.name.toLowerCase() === "value") continue
      walk(child, next)
    }
  }
  walk(root, {})
  return rows
}

function directRow(element: XmlElement): ProductOptionRow | null {
  const values: Partial<ProductOptionRow> = {}
  for (const field of FIELDS) {
    const raw = childText(element, field)
    if (raw === undefined) continue
    values[field] = raw.trim() ? raw.trim() : " "
  }
  if (!values.documentClass || !values.mailClass) return null
  return fill(values)
}

function fill(values: Partial<ProductOptionRow>): ProductOptionRow {
  return {
    documentClass: values.documentClass ?? "",
    layout: values.layout ?? "",
    productionTime: values.productionTime ?? "",
    envelope: values.envelope && values.envelope.length > 0 ? values.envelope : " ",
    color: values.color ?? "",
    paperType: values.paperType ?? "",
    printOption: values.printOption ?? "",
    mailClass: values.mailClass ?? "",
  }
}

function matchesEddmSize(documentClass: string, size: EddmSize): boolean {
  const text = documentClass.toLowerCase()
  if (!/eddm|every door/.test(text)) return false
  if (size === "6.5x9") return /6\.5/.test(text) && /\b9\b/.test(text)
  return /6\.25/.test(text) && /\b11\b/.test(text)
}

function score(row: ProductOptionRow): number {
  let points = 0
  if (/full service/i.test(row.mailClass)) points += 100
  else if (/postage paid/i.test(row.mailClass)) points += 40
  if (/we prep/i.test(row.layout)) points += 20
  if (/next day/i.test(row.productionTime)) points += 10
  if (/full color/i.test(row.color)) points += 5
  if (/both sides/i.test(row.printOption)) points += 5
  if (/white matte/i.test(row.paperType)) points += 5
  return points
}
