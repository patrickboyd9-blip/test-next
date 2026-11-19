"use client"

import Link from "next/link"

export default function CampaignEditorError() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">This campaign could not be opened</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Nothing was mailed or charged. Go back and open the editor again.
      </p>
      <Link href="/app/mail" className="inline-flex min-h-11 w-fit items-center text-sm underline">
        Back to the mailer
      </Link>
    </div>
  )
}
