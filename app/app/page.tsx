import { getCommandCenterSnapshot } from "@/lib/command-center/data"
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
  const params = await searchParams
  const state: CommandCenterUserState = VALID_STATES.includes(
    params.state as CommandCenterUserState
  )
    ? (params.state as CommandCenterUserState)
    : "active"

  const snapshot = await getCommandCenterSnapshot(state)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <SidebarTrigger />
        <StateSwitcher current={state} />
      </div>

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
