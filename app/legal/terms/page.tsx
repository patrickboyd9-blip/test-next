import type { Metadata } from "next"

import { COMPLIANCE_TEXT } from "@/lib/compliance/legal-text"

import { LegalDocument } from "@/components/compliance/LegalDocument"

export const metadata: Metadata = {
  title: "Terms of Service (draft) — Modern Mail",
}

export default function TermsPage() {
  const doc = COMPLIANCE_TEXT.account.documents.terms
  return (
    <LegalDocument
      title={doc.title}
      versionId={COMPLIANCE_TEXT.account.termsVersionId}
      body={doc.body}
    />
  )
}
