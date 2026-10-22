import { cookies } from "next/headers"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { savePricing, unlockPricing } from "@/lib/pricing/actions"
import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/defaults"
import { ownerCookieMatches, PRICING_OWNER_COOKIE, pricingOwnerKey } from "@/lib/pricing/owner-gate"
import { mailClassLabel, ownerPreviewLine } from "@/lib/pricing/quote"
import { getPricingConfig } from "@/lib/pricing/store"
import type { MailClassId, PricingProductId } from "@/lib/pricing/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string; saved?: string }>
}) {
  const query = await searchParams
  const jar = await cookies()
  const unlocked = ownerCookieMatches(jar.get(PRICING_OWNER_COOKIE)?.value)
  if (!unlocked) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
        <Header />
        <section className="rounded-lg border p-5">
          <h1 className="text-xl font-semibold">Pricing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only the owner of Modern Mail can change prices. Customers never see this page.
          </p>
          {!pricingOwnerKey() ? (
            <p className="mt-4 text-sm">
              Pricing is locked until the owner key is added on the server. The setting is named PRICING_OWNER_KEY.
            </p>
          ) : (
            <form action={unlockPricing} className="mt-4 flex flex-col gap-3">
              <label className="text-sm font-medium" htmlFor="owner-key">
                Owner key
              </label>
              <Input id="owner-key" name="key" type="password" autoComplete="current-password" required />
              {query.locked === "mismatch" && (
                <p className="text-sm text-destructive">That key does not match.</p>
              )}
              <Button type="submit">Continue</Button>
            </form>
          )}
        </section>
      </main>
    )
  }

  const config = await getPricingConfig()
  const productIds = Object.keys(DEFAULT_PRICING_CONFIG.products) as PricingProductId[]

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <Header />
      <form action={savePricing} className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Pricing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A customer pays print plus postage, plus your markup. They see one price per card and a total.
            They do not see this split.
          </p>
          {query.saved === "1" && (
            <p className="mt-3 text-sm" role="status">
              Saved.
            </p>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="pricesArePlaceholders"
            defaultChecked={config.pricesArePlaceholders}
            className="mt-1"
          />
          <span>
            Prices are still placeholders. While this is checked, preview and local sites show “Pricing not final.”
            Uncheck it when these are the prices customers should trust.
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            name="markupPercent"
            label="Markup percent"
            defaultValue={String(config.markupPercent)}
            hint="Added on top of print plus postage."
          />
          <NumberField
            name="markupPerPieceDollars"
            label="Markup per card ($)"
            defaultValue={String(config.markupPerPieceDollars)}
            hint="Added to every card after the percent."
          />
          <NumberField
            name="minimumOrderDollars"
            label="Minimum order ($)"
            defaultValue={String(config.minimumOrderDollars)}
            hint="The total is raised to this amount when the cards cost less. 0 means no minimum."
          />
        </div>

        {productIds.map((id) => {
          const product = config.products[id]
          return (
            <section key={id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{product.label}</h2>
                {product.printCostIsPlaceholder && <Badge variant="secondary">PLACEHOLDER</Badge>}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <NumberField
                  name={`print__${id}`}
                  label="Print cost per card ($)"
                  defaultValue={product.printCostDollars === null ? "" : String(product.printCostDollars)}
                  placeholder={product.printCostIsPlaceholder ? "PLACEHOLDER" : undefined}
                  hint={
                    id === "eddm_6_5x9" || id === "eddm_6_25x11"
                      ? "PLACEHOLDER. This size is being added. Leave it blank until the print cost is known."
                      : product.printCostIsPlaceholder
                        ? "PLACEHOLDER. Fill this in when the print cost is known."
                        : undefined
                  }
                />
                {(Object.keys(product.postage) as MailClassId[]).map((mailClass) => {
                  const rate = product.postage[mailClass]
                  return (
                    <div key={mailClass} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium" htmlFor={`postage__${id}__${mailClass}`}>
                          {mailClassLabel(mailClass)} postage per card ($)
                        </label>
                        {rate?.isPlaceholder && <Badge variant="secondary">PLACEHOLDER</Badge>}
                      </div>
                      <Input
                        id={`postage__${id}__${mailClass}`}
                        name={`postage__${id}__${mailClass}`}
                        type="number"
                        min="0"
                        step="0.001"
                        defaultValue={rate?.dollars === null || rate?.dollars === undefined ? "" : String(rate.dollars)}
                        placeholder={rate?.isPlaceholder ? "PLACEHOLDER" : undefined}
                      />
                      {rate?.isPlaceholder && (
                        <p className="text-xs text-muted-foreground">
                          {mailClass === "eddm"
                            ? "Estimate, about $0.26. Replace it when the real EDDM rate is confirmed."
                            : "PLACEHOLDER. This postage rate is not confirmed yet."}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{ownerPreviewLine(config, id)}</p>
            </section>
          )
        })}

        <div className="flex justify-end">
          <Button type="submit">Save prices</Button>
        </div>
      </form>
    </main>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <SidebarTrigger />
    </div>
  )
}

function NumberField({
  name,
  label,
  defaultValue,
  hint,
  placeholder,
}: {
  name: string
  label: string
  defaultValue: string
  hint?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <Input id={name} name={name} type="number" min="0" step="0.001" defaultValue={defaultValue} placeholder={placeholder} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
