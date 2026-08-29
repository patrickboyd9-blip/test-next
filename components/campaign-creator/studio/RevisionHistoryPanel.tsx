"use client"

import { motion } from "framer-motion"
import { MinusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  formatRelativeTime,
  getActiveRevision,
} from "@/lib/campaign-creator/creative-state"
import type { CampaignCreative, CreativeRevision } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

interface RevisionHistoryPanelProps {
  creative: CampaignCreative
  directionId: string
  onRestore: (revisionId: string) => void
  isRestoring?: boolean
  className?: string
}

function truncatePrompt(prompt: string, max = 60): string {
  if (prompt === "Original concept") return "original concept"
  if (prompt.length <= max) return prompt
  return `${prompt.slice(0, max - 1)}…`
}

function buildConflictLabel(revision: CreativeRevision): string {
  const prompt = revision.customerPrompt.toLowerCase()
  if (prompt.includes("qr") || prompt.includes("code")) {
    return "Request not applied — QR kept for appointment tracking"
  }
  if (prompt.includes("phone") || prompt.includes("number")) {
    return "Request not applied — phone kept for tracking"
  }
  if (prompt.includes("offer")) {
    return "Request not applied — offer kept for campaign goal"
  }
  return "Request not applied"
}

export function RevisionHistoryPanel({
  creative,
  directionId,
  onRestore,
  isRestoring = false,
  className,
}: RevisionHistoryPanelProps) {
  const reducedMotion = useReducedMotion()
  const activeRevision = getActiveRevision(creative, directionId)

  const entries = creative.revisions
    .filter((r) => r.directionId === directionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <aside
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
        "max-h-[160px] overflow-y-auto md:max-h-none md:min-h-[280px]",
        className
      )}
      aria-label="Revision history"
    >
      <h3 className="text-sm font-semibold">Revision history</h3>

      <ul className="flex flex-col gap-1">
        {entries.map((revision, index) => {
          const isConflict = revision.type === "conflict"
          const isCurrent =
            !isConflict &&
            activeRevision?.id === revision.id &&
            revision.version !== null
          const versionLabel =
            revision.version === 1 && revision.customerPrompt === "Original concept"
              ? "v1 · original concept"
              : isConflict
                ? buildConflictLabel(revision)
                : revision.version !== null
                  ? `v${revision.version} · ${truncatePrompt(revision.customerPrompt)}`
                  : truncatePrompt(revision.customerPrompt)

          return (
            <motion.li
              key={revision.id}
              initial={reducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, delay: index === 0 ? 0 : 0 }}
            >
              <button
                type="button"
                disabled={isRestoring || isConflict || isCurrent}
                onClick={() => onRestore(revision.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  isConflict
                    ? "cursor-default text-muted-foreground/70"
                    : isCurrent
                      ? "cursor-default bg-muted/50"
                      : "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-current={isCurrent ? "true" : undefined}
              >
                {isConflict && (
                  <MinusCircle className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-hidden />
                )}
                <span className="flex-1">
                  <span className="block">{versionLabel}</span>
                  {!isConflict && (
                    <span className="text-muted-foreground">
                      {revision.version === 1 &&
                      revision.customerPrompt === "Original concept"
                        ? ""
                        : formatRelativeTime(revision.createdAt)}
                    </span>
                  )}
                </span>
                {isCurrent && (
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Current
                  </span>
                )}
              </button>
            </motion.li>
          )
        })}
      </ul>
    </aside>
  )
}
