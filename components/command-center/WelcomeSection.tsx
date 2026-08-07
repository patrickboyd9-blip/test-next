import type { CommandCenterSnapshot } from "@/lib/command-center/types"

interface WelcomeSectionProps {
  snapshot: CommandCenterSnapshot
}

export function WelcomeSection({ snapshot }: WelcomeSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">How&apos;s my mail doing?</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{snapshot.summary}</p>
    </div>
  )
}
