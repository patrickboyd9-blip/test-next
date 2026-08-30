"use client"

import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CampaignBrief, CreativeSpec } from "@/lib/campaign-creator/types"
import { trackingDestination } from "@/lib/campaign-creator/creative-state"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { PostcardPreview } from "./PostcardPreview"

interface ApprovalModalProps {
  open: boolean
  spec: CreativeSpec
  brief: CampaignBrief
  directionName: string
  onApprove: () => void
  onKeepRefining: () => void
  isApproving?: boolean
  approved?: boolean
}

export function ApprovalModal({
  open,
  spec,
  brief,
  directionName,
  onApprove,
  onKeepRefining,
  isApproving = false,
  approved = false,
}: ApprovalModalProps) {
  const reducedMotion = useReducedMotion()
  const approveButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const metric =
    brief.primarySuccessMetric?.description ?? "Appointment bookings"
  const destination = trackingDestination(brief)

  useEffect(() => {
    if (open && approveButtonRef.current) {
      approveButtonRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onKeepRefining()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onKeepRefining])

  useEffect(() => {
    if (!open) return

    const dialog = dialogRef.current
    if (!dialog) return

    const focusableSelector =
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return

      const el = dialogRef.current
      if (!el) return

      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => element.offsetParent !== null)

      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener("keydown", handleTabKey)
    return () => dialog.removeEventListener("keydown", handleTabKey)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.2 }}
            onClick={onKeepRefining}
            aria-label="Close approval dialog"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-modal-title"
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.25, type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="relative mx-auto mb-4 flex justify-center">
              <PostcardPreview spec={spec} size="medium" enableHoverTilt={false} />
              {approved && (
                <motion.div
                  className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  aria-hidden
                >
                  <Check className="size-4" />
                </motion.div>
              )}
            </div>

            <h2 id="approval-modal-title" className="text-center text-lg font-semibold">
              Ready to approve this design?
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              This is what we&apos;ll print and mail. You can still make changes until you
              confirm your audience.
            </p>
            <p className="mt-3 text-center text-sm">
              <span className="text-muted-foreground">Designed to drive: </span>
              <span className="font-medium">
                {metric} via {destination}
              </span>
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">{directionName}</p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                ref={approveButtonRef}
                onClick={onApprove}
                disabled={isApproving || approved}
                className="sm:min-w-[140px]"
              >
                {isApproving ? "Approving…" : "Approve creative"}
              </Button>
              <Button
                variant="outline"
                onClick={onKeepRefining}
                disabled={isApproving}
              >
                Keep refining
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
