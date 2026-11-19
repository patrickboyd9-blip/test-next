import Link from "next/link"

export default function CampaignNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">That campaign is not on this account</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Nothing was mailed or charged. Start a new mailer from home.
      </p>
      <Link href="/app" className="inline-flex min-h-11 w-fit items-center text-sm underline">
        Home
      </Link>
    </div>
  )
}
