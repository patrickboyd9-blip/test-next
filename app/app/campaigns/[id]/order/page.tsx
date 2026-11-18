import { notFound } from "next/navigation"

import { MailJourneyReview } from "@/components/mail-journey/MailJourneyReview"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import { getJourneyStore } from "@/lib/mail-journey/job"
import { reviewCustomerList } from "@/lib/mail-journey/list-import"
import { attemptMail, readLiveGate } from "@/lib/mail-journey/mail-gate"
import { buildQuote, readApprovedSchedule } from "@/lib/mail-journey/pricing"
import { freezeProof } from "@/lib/mail-journey/proof"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function OrderReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ checkout?: string; cap?: string }>
}) {
  const session = await getSession()
  if (!session) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          The order review is not shown until an account is signed in.
        </p>
      </div>
    )
  }

  const { id } = await params
  const { checkout, cap } = await searchParams
  const checkoutNote =
    cap === "over"
      ? "This total is over your spending cap. Nothing was charged and nothing was mailed."
      : checkout === "return"
      ? "You came back from payment. This page does not mark the order paid, and nothing was mailed."
      : checkout === "cancel" || checkout === "closed"
        ? "Payment did not start. Nothing was charged and nothing was mailed."
        : null
  let campaign
  try {
    campaign = await requireOwnedCampaign(id)
  } catch {
    notFound()
  }

  const stored = await getJourneyStore().getListReview(id, session.userId)
  const review = stored ? reviewCustomerList(stored.csv) : null
  const proof = freezeProof(campaign)
  const count = review?.acceptedCount ?? 0
  const quote = buildQuote(readApprovedSchedule(), count, new Date().toISOString())
  const job = stored?.jobId ? await getJourneyStore().getJob(stored.jobId) : null
  const mailMessage = job ? attemptMail(job, readLiveGate()).message : "Nothing is mailed from this page."
  if (job && job.ownerId !== session.userId) notFound()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">Order review</span>
      </header>
      {checkoutNote ? <p className="px-6 pt-6 text-sm text-muted-foreground lg:px-8">{checkoutNote}</p> : null}
      <MailJourneyReview
        campaignId={id}
        proof={proof}
        review={review}
        quote={quote}
        job={job}
        mailMessage={mailMessage}
        csv={stored?.csv}
      />
    </div>
  )
}
