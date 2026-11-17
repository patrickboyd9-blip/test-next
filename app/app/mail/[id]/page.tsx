import { MailerStatus, PreviewStatus } from "@/components/cockpit/MailerStatus"
import { mailerById, SAMPLE_SHOP, type MailerProof } from "@/lib/mailer-compose/flow"

export const dynamic = "force-dynamic"

export default async function MailerStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mailer = mailerById(id)
  if (!mailer) return <PreviewStatus id={id} />
  const proof: MailerProof | null =
    mailer.status === "proof_ready"
      ? {
          shop: SAMPLE_SHOP,
          line: "$50 off a tune-up this month",
          to: mailer.listName,
          people: mailer.people,
          phone: "",
          website: "",
          logoName: null,
          qr: null,
        }
      : null
  return <MailerStatus mailer={mailer} proof={proof} />
}
