import { saveGuidanceAction } from "@/lib/strategy/actions"
import { sourcesFor, type StrategyGuidance } from "@/lib/strategy/advise"
import { REVIEWED_SOURCES } from "@/lib/strategy/sources"

export function GuidancePanel({ campaignId, guidance }: { campaignId: string; guidance: StrategyGuidance }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Why this direction</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One recommendation and at most two alternatives. This is not a promise of more replies, and it is not legal approval.
        </p>
      </div>
      {guidance.sourcesChanged ? (
        <p className="text-sm">
          The library copy changed after this plan was saved. Your saved offer and proof were not changed.
        </p>
      ) : null}
      <section className="text-sm">
        <h2 className="font-medium">Confirmed by you</h2>
        <ul className="mt-1">
          <li>Trade: {guidance.facts.trade}</li>
          <li>Offer: {guidance.facts.offer || "Not confirmed. None was invented."}</li>
          <li>What the photo shows: {guidance.facts.serviceAction || "Not confirmed."}</li>
          <li>Phone: {guidance.facts.phone || "Not confirmed."}</li>
        </ul>
      </section>
      {guidance.status === "limited" ? (
        <section className="text-sm">
          <h2 className="font-medium">Limited guidance</h2>
          <p className="mt-1">{guidance.limitedReason}</p>
          <ul className="mt-2 list-disc pl-5">
            {guidance.missingInputs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : (
        guidance.plans.map((plan) => (
          <article key={plan.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            <h2 className="font-medium">
              {plan.role === "recommendation" ? "Recommendation" : "Alternative"}
            </h2>
            <p>Objection: {plan.objection}</p>
            <p>Offer, in your words: {plan.offerFraming}</p>
            <p>Scene: {plan.scene}</p>
            <p>Back: {plan.back}</p>
            <p>From the library: {plan.rationale}</p>
            <p>Inference, not a finding: {plan.inference}</p>
            <ul>
              {sourcesFor(plan.sourceIds).map((source) => (
                <li key={source.id}>
                  <a className="underline" href={source.url}>{source.title}</a>
                  {" · "}
                  {source.evidenceType === "psychology-paper" ? "Psychology paper" : "Documented campaign"}
                  {" · "}
                  library date {source.documentDate}
                  {source.campaignWhen ? ` · campaign timing ${source.campaignWhen}` : ""}
                  . {source.limitation}
                </li>
              ))}
            </ul>
          </article>
        ))
      )}
      {guidance.flags.map((flag) => (
        <p key={flag.phrase} className="text-sm">
          Flagged, not approved: “{flag.phrase}”. {flag.note}
        </p>
      ))}
      <form action={saveGuidanceAction.bind(null, campaignId)}>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">
          Save this guidance
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Sources are the notes already in this project ({REVIEWED_SOURCES.length} checked records). No new research was downloaded.
      </p>
    </div>
  )
}
