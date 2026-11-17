"use client"

import { useSearchParams } from "next/navigation"

export function AccountNotice() {
  const params = useSearchParams()
  const notice = params.get("notice")
  if (notice === "verify-later") {
    return <p className="border-b px-4 py-3 text-sm text-muted-foreground">You can verify your email later. Nothing was sent because email is not configured yet.</p>
  }
  if (notice === "verified") {
    return <p className="border-b px-4 py-3 text-sm text-muted-foreground">Email verified.</p>
  }
  return null
}
