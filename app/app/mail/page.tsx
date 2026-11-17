import { ComposeMailer } from "@/components/cockpit/ComposeMailer"
import { composeSteps, emptyDraft, LIST_BEFORE_PROOF, SAMPLE_SHOP, type ComposeStep } from "@/lib/mailer-compose/flow"

export const dynamic = "force-dynamic"

export default async function NewMailerPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; brief?: string; list?: string }>
}) {
  const params = await searchParams
  const allowed = new Set<ComposeStep>(composeSteps(LIST_BEFORE_PROOF))
  const requested = params.step as ComposeStep
  const step: ComposeStep = allowed.has(requested) ? requested : composeSteps(LIST_BEFORE_PROOF)[0]!
  const draft = emptyDraft()
  if (params.list === "nearby-homes" || params.list === "last-year") draft.listId = params.list
  if (typeof params.brief === "string") draft.brief = params.brief
  return <ComposeMailer shop={SAMPLE_SHOP} initialStep={step} initialDraft={draft} />
}
