import { formatDollars } from "@/lib/click2mail/cost"

import { DEFAULT_PRICING_CONFIG, isMailClassId, isPricingProductId } from "./defaults"
import type {
  CustomerPrice,
  CustomerRate,
  MailClassId,
  PricingConfig,
  PricingProductId,
  ProductPrice,
} from "./types"

const STRIPE_MINIMUM_CENTS = 50

export function stripeMinimumCents(): number {
  return STRIPE_MINIMUM_CENTS
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : ""
  const abs = Math.abs(Math.round(cents))
  const dollars = Math.floor(abs / 100)
  const fraction = abs % 100
  return `${sign}$${dollars}.${String(fraction).padStart(2, "0")}`
}

export function isProductionDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  const vercel = env.VERCEL_ENV?.trim()
  if (vercel) return vercel === "production"
  return env.NODE_ENV === "production"
}

/** Banner for screens customers see, while the owner still has placeholder prices. */
export function showPricingNotFinalBanner(
  config: PricingConfig,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return config.pricesArePlaceholders && !isProductionDeploy(env)
}

/**
 * All-in price for one product and mail class.
 * per card = print + postage + percent markup on that sum + per-piece markup.
 * The total is that price times the piece count, raised to the minimum order
 * when the pieces cost less. The returned labels are the only numbers a
 * customer should see.
 */
export function customerRate(
  config: PricingConfig,
  productId: PricingProductId,
  mailClass: MailClassId
): CustomerRate | null {
  const product = config.products[productId]
  const postage = product?.postage[mailClass]
  if (!product || !postage) return null
  const printMills = dollarsToMills(product.printCostDollars ?? 0)
  const postageMills = dollarsToMills(postage.dollars ?? 0)
  const base = printMills + postageMills
  const percentMills = Math.round(base * (config.markupPercent / 100))
  const perCardMills = base + percentMills + dollarsToMills(config.markupPerPieceDollars)
  return {
    productId,
    mailClass,
    perCardMills,
    minimumOrderCents: Math.max(0, Math.round(config.minimumOrderDollars * 100)),
    pricingNotFinal: config.pricesArePlaceholders,
  }
}

export function priceForCount(rate: CustomerRate, pieceCount: number): CustomerPrice {
  const count = Math.max(0, Math.floor(pieceCount))
  if (count === 0) {
    return {
      pieceCount: 0,
      perCardMills: rate.perCardMills,
      totalCents: 0,
      perCardLabel: formatDollars(rate.perCardMills / 1000),
      totalLabel: "—",
      pricingNotFinal: rate.pricingNotFinal,
      minimumApplied: false,
    }
  }
  const rawMills = rate.perCardMills * count
  const minimumMills = rate.minimumOrderCents * 10
  const minimumApplied = minimumMills > rawMills
  const totalMills = minimumApplied ? minimumMills : rawMills
  const totalCents = Math.round(totalMills / 10)
  const effectiveMills = totalMills / count
  return {
    pieceCount: count,
    perCardMills: effectiveMills,
    totalCents,
    perCardLabel: formatDollars(effectiveMills / 1000),
    totalLabel: formatCents(totalCents),
    pricingNotFinal: rate.pricingNotFinal,
    minimumApplied,
  }
}

export function quoteMailing(
  config: PricingConfig,
  input: { productId: PricingProductId; mailClass: MailClassId; pieceCount: number }
): CustomerPrice | null {
  const rate = customerRate(config, input.productId, input.mailClass)
  if (!rate) return null
  return priceForCount(rate, input.pieceCount)
}

/** One-card preview for the owner page. Still a customer-facing total, not a split. */
export function ownerPreviewLine(config: PricingConfig, productId: PricingProductId): string | null {
  const product = config.products[productId]
  if (!product) return null
  const mailClass = (Object.keys(product.postage) as MailClassId[]).find((key) => product.postage[key])
  if (!mailClass) return null
  const price = quoteMailing(config, { productId, mailClass, pieceCount: 1 })
  if (!price) return null
  const rate = product.postage[mailClass]
  const placeholder = product.printCostIsPlaceholder || Boolean(rate?.isPlaceholder)
  const mark = placeholder ? " PLACEHOLDER." : ""
  return `${product.label}: a customer pays ${price.perCardLabel} per card before the minimum order.${mark}`
}

export function normalizePricingConfig(value: unknown): PricingConfig {
  const record = value && typeof value === "object" ? (value as Partial<PricingConfig>) : {}
  const base = DEFAULT_PRICING_CONFIG
  const products = {} as PricingConfig["products"]
  for (const id of Object.keys(base.products) as PricingProductId[]) {
    const incoming = record.products?.[id]
    products[id] = normalizeProduct(base.products[id], incoming)
  }
  return {
    version: 1,
    pricesArePlaceholders:
      typeof record.pricesArePlaceholders === "boolean"
        ? record.pricesArePlaceholders
        : base.pricesArePlaceholders,
    markupPercent: nonNegative(record.markupPercent, base.markupPercent),
    markupPerPieceDollars: nonNegative(record.markupPerPieceDollars, base.markupPerPieceDollars),
    minimumOrderDollars: nonNegative(record.minimumOrderDollars, base.minimumOrderDollars),
    products,
  }
}

export function pricingConfigFromForm(form: FormData): PricingConfig {
  const current = DEFAULT_PRICING_CONFIG
  const confirming = form.get("pricesArePlaceholders") !== "on"
  const products = {} as PricingConfig["products"]
  for (const id of Object.keys(current.products) as PricingProductId[]) {
    const base = current.products[id]
    const printRaw = String(form.get(`print__${id}`) ?? "").trim()
    const postage = { ...base.postage }
    for (const mailClass of Object.keys(base.postage) as MailClassId[]) {
      const postageRaw = String(form.get(`postage__${id}__${mailClass}`) ?? "").trim()
      const parsed = postageRaw === "" ? null : Number(postageRaw)
      const fallback = base.postage[mailClass]?.dollars ?? null
      const dollars =
        parsed === null || !Number.isFinite(parsed) || parsed < 0 ? fallback : parsed
      const wasPlaceholder = base.postage[mailClass]?.isPlaceholder ?? true
      const unchanged = dollars === base.postage[mailClass]?.dollars
      postage[mailClass] = {
        dollars,
        isPlaceholder: dollars === null ? true : confirming ? false : wasPlaceholder && unchanged,
      }
    }
    const printParsed = printRaw === "" ? null : Number(printRaw)
    const printCostDollars =
      printParsed === null || !Number.isFinite(printParsed) || printParsed < 0 ? null : printParsed
    products[id] = {
      label: base.label,
      printCostDollars,
      printCostIsPlaceholder: printCostDollars === null,
      postage,
    }
  }
  return normalizePricingConfig({
    version: 1,
    pricesArePlaceholders: form.get("pricesArePlaceholders") === "on",
    markupPercent: Number(form.get("markupPercent") ?? 0),
    markupPerPieceDollars: Number(form.get("markupPerPieceDollars") ?? 0),
    minimumOrderDollars: Number(form.get("minimumOrderDollars") ?? 0),
    products,
  })
}

export function mailClassLabel(mailClass: MailClassId): string {
  if (mailClass === "first_class") return "First Class"
  return "EDDM"
}

export function knownProductId(value: string | undefined): PricingProductId | null {
  if (!value || !isPricingProductId(value)) return null
  return value
}

export function knownMailClass(value: string | undefined): MailClassId | null {
  if (!value || !isMailClassId(value)) return null
  return value
}

function normalizeProduct(base: ProductPrice, incoming: ProductPrice | undefined): ProductPrice {
  const postage = { ...base.postage }
  if (incoming?.postage) {
    for (const key of Object.keys(incoming.postage) as MailClassId[]) {
      const rate = incoming.postage[key]
      if (!rate || !base.postage[key]) continue
      const dollars = rate.dollars === null ? null : nonNegative(rate.dollars, base.postage[key]?.dollars ?? 0)
      postage[key] = {
        dollars: rate.dollars === null ? null : dollars,
        isPlaceholder: Boolean(rate.isPlaceholder),
      }
    }
  }
  const print =
    incoming?.printCostDollars === null || incoming?.printCostDollars === undefined
      ? incoming?.printCostDollars === null
        ? null
        : base.printCostDollars
      : nonNegative(incoming.printCostDollars, 0)
  return {
    label: base.label,
    printCostDollars: print,
    printCostIsPlaceholder:
      typeof incoming?.printCostIsPlaceholder === "boolean"
        ? incoming.printCostIsPlaceholder
        : base.printCostIsPlaceholder,
    postage,
  }
}

function nonNegative(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function dollarsToMills(dollars: number): number {
  return Math.round(dollars * 1000)
}
