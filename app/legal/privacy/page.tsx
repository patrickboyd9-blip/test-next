import type { Metadata } from "next"

import { COMPLIANCE_TEXT } from "@/lib/compliance/legal-text"

import { LegalDocument } from "@/components/compliance/LegalDocument"

export const metadata: Metadata = {
  title: "Privacy Policy (draft) — Modern Mail",
}

export default function PrivacyPage() {
  const doc = COMPLIANCE_TEXT.account.documents.privacy
  return (
    <LegalDocument
      title={doc.title}
      versionId={COMPLIANCE_TEXT.account.privacyVersionId}
      body={doc.body}
    />
  )
}
