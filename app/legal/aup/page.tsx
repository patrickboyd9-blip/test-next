import type { Metadata } from "next"

import { COMPLIANCE_TEXT } from "@/lib/compliance/legal-text"

import { LegalDocument } from "@/components/compliance/LegalDocument"

export const metadata: Metadata = {
  title: "Acceptable Use Policy (draft) — Modern Mail",
}

export default function AcceptableUsePage() {
  const doc = COMPLIANCE_TEXT.account.documents.aup
  return (
    <LegalDocument
      title={doc.title}
      versionId={COMPLIANCE_TEXT.account.aupVersionId}
      body={doc.body}
    />
  )
}
