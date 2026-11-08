import { reviewListAction, startCheckoutAction } from "@/lib/mail-journey/actions"
import type { ListReview } from "@/lib/mail-journey/list-import"
import type { MailJob } from "@/lib/mail-journey/job"
import type { QuoteResult } from "@/lib/mail-journey/pricing"
import type { ProofFreeze } from "@/lib/mail-journey/proof"

export function MailJourneyReview(props: {
  campaignId: string
  proof: ProofFreeze
  review: ListReview | null
  quote: QuoteResult
  job: MailJob | null
  mailMessage: string
  csv?: string
}) {
  const review = props.review
  const ready =
    props.proof.ok &&
    review !== null &&
    review.headerError === null &&
    review.invalid.length === 0 &&
    review.acceptedCount > 0 &&
    props.quote.ok &&
    props.job === null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Review before anything is sent</h1>
        <p className="text-sm text-muted-foreground">
          Checkout stays closed until the front, the back, the accepted addresses, and an approved
          price all match. This page does not charge a card and does not mail.
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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Your address list</h2>
        <form action={reviewListAction} className="flex flex-col gap-3">
          <input type="hidden" name="campaignId" value={props.campaignId} />
          <label className="text-sm" htmlFor="csv">
            Paste a CSV. Use columns such as First Name, Last Name, Street, Apt, City, State, and ZIP.
          </label>
          <textarea
            id="csv"
            name="csv"
            rows={6}
            className="rounded-md border bg-background p-3 font-mono text-sm"
            defaultValue={props.csv ?? ""}
            placeholder="First Name,Last Name,Street,Apt,City,State,ZIP"
          />
          <button type="submit" className="w-fit rounded-md border px-3 py-2 text-sm">
            Check this list
          </button>
        </form>
        {review ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>{review.validationNote}</p>
            {review.headerError ? <p>{review.headerError}</p> : null}
            <p>
              {review.acceptedCount} accepted, {review.invalid.length}{" "}
              {review.invalid.length === 1 ? "needs" : "need"} a correction,{" "}
              {review.duplicates.length} duplicate{review.duplicates.length === 1 ? "" : "s"} removed.
            </p>
            {review.invalid.map((row) => (
              <p key={row.row}>{row.messages.join(" ")}</p>
            ))}
            {review.duplicates.map((row) => (
              <p key={row.row}>
                Row {row.row} repeats row {row.matchesRow}. The first copy was kept.
              </p>
            ))}
            {review.accepted.length > 0 ? (
              <ul>
                {review.accepted.map((recipient) => (
                  <li key={`${recipient.address1}-${recipient.address2}-${recipient.zip}`}>
                    {recipient.first} {recipient.last}, {recipient.address1}
                    {recipient.address2 ? `, ${recipient.address2}` : ""}, {recipient.city} {recipient.state}{" "}
                    {recipient.zip}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No list has been checked for this campaign yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Total and checkout</h2>
        {props.quote.ok ? (
          <p className="text-sm">
            {props.quote.quote.pieceCount} pieces, {props.quote.quote.currency.toUpperCase()}{" "}
            {(props.quote.quote.totalCents / 100).toFixed(2)}, terms {props.quote.quote.termsVersion}, good
            through {props.quote.quote.expiresAt}.
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
            <button type="submit" className="rounded-md border px-3 py-2 text-sm">
              Record this approval
            </button>
          </form>
        ) : null}
      </section>
    </div>
  )
}
