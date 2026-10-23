import type { ReactNode } from "react"

import { COMPLIANCE_TEXT } from "@/lib/compliance/legal-text"

export const metadata = {
  title: "Legal drafts — Modern Mail",
}

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {COMPLIANCE_TEXT.draftNotice}
        </p>
        {children}
      </article>
    </div>
  )
}
