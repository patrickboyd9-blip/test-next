"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  accountCheckboxParts,
  COMPLIANCE_TEXT,
} from "@/lib/compliance/legal-text"
import { acceptAccountTerms } from "@/lib/compliance/actions"

export function AccountClickwrap({ reason }: { reason: "missing" | "updated" }) {
  const [agreed, setAgreed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const parts = accountCheckboxParts()
  const docs = COMPLIANCE_TEXT.account.documents

  function agree() {
    setMessage(null)
    startTransition(() => {
      void acceptAccountTerms(agreed).then((result) => {
        if (!result.ok) {
          setMessage(result.message ?? "Check the box to agree.")
          return
        }
        router.refresh()
      })
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {COMPLIANCE_TEXT.draftNotice}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Before you use Modern Mail</h1>
        <p className="text-sm text-muted-foreground">
          {reason === "updated"
            ? "The agreement changed. Read this version and agree again before you continue."
            : "This covers your account. You will confirm each mailer again before it is sent."}
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-4 text-sm leading-6">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-foreground"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>
          {parts.beforeTerms}
          <LegalLink href={docs.terms.href}>{docs.terms.title}</LegalLink>
          {parts.betweenTermsAndAup}
          <LegalLink href={docs.aup.href}>{docs.aup.title}</LegalLink>
          {parts.betweenAupAndPrivacy}
          <LegalLink href={docs.privacy.href}>{docs.privacy.title}</LegalLink>
          {parts.afterPrivacy}
        </span>
      </label>

      <p className="text-sm leading-6 text-muted-foreground">{COMPLIANCE_TEXT.account.notice}</p>

      {message && <p className="text-sm text-destructive">{message}</p>}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Version {COMPLIANCE_TEXT.versionId}</p>
        <Button type="button" disabled={!agreed || pending} onClick={agree}>
          {pending ? "Saving…" : "Agree and continue"}
        </Button>
      </div>
    </div>
  )
}

function LegalLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} target="_blank" className="underline underline-offset-4">
      {children}
    </Link>
  )
}
