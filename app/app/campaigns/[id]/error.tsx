"use client"

import Link from "next/link"

/**
 * Replaces the Next.js server-error page for this route.
 * A digest still exists in the logs. The customer sees a way back.
 */
export default function CampaignEditorError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">This campaign could not be opened</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Nothing was mailed or charged. You can try the editor again, or go back home.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
        >
          Try again
        </button>
        <Link href="/app/mail" className="inline-flex min-h-11 items-center text-sm underline">
          Back to the mailer
        </Link>
      </div>
    </div>
  )
}
