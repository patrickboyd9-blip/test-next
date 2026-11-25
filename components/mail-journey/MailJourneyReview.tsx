import { AddressBook, type AddressListChoice } from "@/components/address-book/AddressBook"
import { payFullPriceAction, startCheckoutAction } from "@/lib/mail-journey/actions"
import type { MailJob } from "@/lib/mail-journey/job"
import type { QuoteResult } from "@/lib/mail-journey/pricing"
import type { ProofFreeze } from "@/lib/mail-journey/proof"
import type { AddressEntry } from "@/lib/address-book/types"

export function MailJourneyReview(props: {
  campaignId: string
  proof: ProofFreeze
  quote: QuoteResult
  priceLabel: string
  priceDetail: string
  lists: AddressListChoice[]
  selectedId: string | null
  entries: AddressEntry[]
  job: MailJob | null
  mailMessage: string
}) {
  const count = props.entries.length
  const ready = props.proof.ok && count > 0 && props.quote.ok && props.job === null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Review before anything is sent</h1>
        <p className="text-sm text-muted-foreground">
          Checkout stays closed until the front, the back, the saved addresses, and an approved full price all match.
          Coming back from the payment page does not mark this order paid, and nothing is mailed from here.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Two-sided proof</h2>
        {props.proof.ok ? (
          <ul className="text-sm">
            <li>Front {props.proof.proof.front.source} {props.proof.proof.front.key}</li>
            <li>Back {props.proof.proof.back.source} {props.proof.proof.back.key}</li>
          </ul>
        ) : (
          <p className="text-sm">{props.proof.message}</p>
        )}
      </section>

      <AddressBook
        tone="paper"
        lists={props.lists}
        selectedId={props.selectedId}
        entries={props.entries}
        campaignId={props.campaignId}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Full price</h2>
        <p className="text-3xl font-semibold tracking-tight">{props.priceLabel}</p>
        <p className="text-sm text-muted-foreground">{props.priceDetail}</p>
        {props.quote.ok ? (
          <p className="text-sm">
            {props.quote.quote.pieceCount} {props.quote.quote.pieceCount === 1 ? "piece" : "pieces"}. Terms {props.quote.quote.termsVersion}. Good through {props.quote.quote.expiresAt}.
          </p>
        ) : (
          <p className="text-sm">{props.quote.message}</p>
        )}
        {props.job ? (
          <p className="text-sm">
            Order {props.job.id} is {props.job.state.replaceAll("_", " ")}. {props.mailMessage}
          </p>
        ) : null}
        {ready ? (
          <form action={startCheckoutAction}>
            <input type="hidden" name="campaignId" value={props.campaignId} />
            <button type="submit" className="min-h-12 rounded-md border px-3 py-2 text-sm">
              Record this approval
            </button>
          </form>
        ) : null}
        {props.job?.state === "awaiting_payment" && props.quote.ok ? (
          <form action={payFullPriceAction}>
            <input type="hidden" name="campaignId" value={props.campaignId} />
            <input type="hidden" name="jobId" value={props.job.id} />
            <button type="submit" className="min-h-12 rounded-md border px-3 py-2 text-sm">
              Pay the full price, {(props.quote.quote.totalCents / 100).toFixed(2)} {props.quote.quote.currency.toUpperCase()}, by card or US bank
            </button>
          </form>
        ) : null}
      </section>
    </div>
  )
}
