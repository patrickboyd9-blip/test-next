import { ComposeMailer } from "@/components/cockpit/ComposeMailer"
import { cometChatIsLive } from "@/lib/mailer-compose/live-turn"
import type { StartPath } from "@/components/cockpit/StartChoices"
import { composeSteps, emptyDraft, LIST_BEFORE_PROOF, SAMPLE_SHOP, type ComposeStep } from "@/lib/mailer-compose/flow"
import { isTemplateIndustry, type TemplateIndustry } from "@/lib/mail-templates/types"

export const dynamic = "force-dynamic"

const PATHS = new Set<StartPath>(["ai", "upload", "template", "team"])

export default async function NewMailerPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; brief?: string; list?: string; path?: string; quick?: string; beat?: string; industry?: string }>
}) {
  const params = await searchParams
  const industry: TemplateIndustry | null = params.industry && isTemplateIndustry(params.industry) ? params.industry : null
  const allowed = new Set<ComposeStep>(composeSteps(LIST_BEFORE_PROOF))
  const requested = params.step as ComposeStep
  const step: ComposeStep = allowed.has(requested) ? requested : composeSteps(LIST_BEFORE_PROOF)[0]!
  const draft = emptyDraft()
  if (params.list === "nearby-homes" || params.list === "last-year") draft.listId = params.list
  if (typeof params.brief === "string") draft.brief = params.brief
  const path = PATHS.has(params.path as StartPath) ? (params.path as StartPath) : step === "what" ? null : "ai"
  const beat = params.beat ? Number(params.beat) : null
  return (
    <ComposeMailer
      shop={SAMPLE_SHOP}
      initialStep={step}
      initialDraft={draft}
      initialPath={path}
      initialQuick={params.quick === "1"}
      initialIndustry={industry}
      sampleBeat={Number.isFinite(beat) ? beat : null}
      liveChat={await cometChatIsLive()}
    />
  )
}
