import { getSession } from "@/lib/auth/session"
import { getCommandCenterSnapshot, honestCustomerSnapshot } from "@/lib/command-center/data"
import type { CommandCenterUserState } from "@/lib/command-center/types"
import { WelcomeSection } from "@/components/command-center/WelcomeSection"
import { EmptyState } from "@/components/command-center/EmptyState"
import { CampaignConfidenceSection } from "@/components/command-center/CampaignConfidenceSection"
import { MailStatusSection } from "@/components/command-center/MailStatusSection"
import { AIStrategistSection } from "@/components/command-center/AIStrategistSection"
import { MetricsStrip } from "@/components/command-center/MetricsStrip"
import { OpportunitiesSection } from "@/components/command-center/OpportunitiesSection"
import { StateSwitcher } from "@/components/command-center/StateSwitcher"
import { Reveal } from "@/components/command-center/Reveal"
import { SidebarTrigger } from "@/components/ui/sidebar"

const VALID_STATES: CommandCenterUserState[] = ["new", "active", "power"]

interface CommandCenterPageProps {
  searchParams: Promise<{ state?: string }>
}

export default async function CommandCenterPage({ searchParams }: CommandCenterPageProps) {
  const session = await getSession()
  if (!session) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <SidebarTrigger />
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          This workspace does not show campaign results until an account is signed in. Sample
          results are not shown here.
        </p>
      </div>
    )
  }

  const params = await searchParams
  const fixture = session.fixture && process.env.NODE_ENV !== "production"
  const requested = params.state as CommandCenterUserState
  const state: CommandCenterUserState = fixture && VALID_STATES.includes(requested) ? requested : "new"
  const snapshot = state === "new" ? honestCustomerSnapshot(session) : await getCommandCenterSnapshot(state)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <SidebarTrigger />
        {fixture ? <StateSwitcher current={state} /> : null}
      </div>
      {fixture && state !== "new" ? (
        <p className="text-sm text-muted-foreground">Sample data. Not this account&apos;s mail.</p>
      ) : null}

      <Reveal>
        <WelcomeSection snapshot={snapshot} />
      </Reveal>

      {snapshot.state === "new" ? (
        <Reveal delay={0.1}>
          <EmptyState />
        </Reveal>
      ) : (
        <>
          {snapshot.confidence && (
            <Reveal delay={0.1}>
              <CampaignConfidenceSection confidence={snapshot.confidence} />
            </Reveal>
          )}

          <Reveal delay={0.2} className="grid gap-4 lg:grid-cols-2">
            {snapshot.mailStatus && <MailStatusSection mailStatus={snapshot.mailStatus} />}
            <AIStrategistSection recommendations={snapshot.recommendations} />
          </Reveal>

          <Reveal delay={0.3}>
            <MetricsStrip metrics={snapshot.metrics} />
          </Reveal>

          <Reveal delay={0.4}>
            <OpportunitiesSection opportunities={snapshot.opportunities} />
          </Reveal>
        </>
      )}
    </div>
  )
}
