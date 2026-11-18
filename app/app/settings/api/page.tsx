import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { ApiAssistants } from "@/components/settings/ApiAssistants"
import { getSession } from "@/lib/auth/session"
import { listAssistantTokens } from "@/lib/mcp/tokens"
import { formatDollars, spendPosition } from "@/lib/ops/spend-cap"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function ApiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ cap?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const params = await searchParams
  const [tokens, position] = await Promise.all([listAssistantTokens(session.userId), spendPosition(session.userId)])
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? ""
  const proto = headerList.get("x-forwarded-proto") ?? "https"
  const origin = host ? `${proto}://${host}` : ""
  const notice =
    params.cap === "saved"
      ? "Spending cap saved."
      : params.cap === "invalid"
        ? "Enter a dollar amount from $1 to $50,000."
        : session.fixture
          ? "This is a sample account. Nothing is mailed or charged."
          : null

  return (
    <ApiAssistants
      tokens={tokens.map((token) => ({
        id: token.id,
        name: token.name,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
      }))}
      capDollars={(position.capCents / 100).toFixed(2)}
      spent={formatDollars(position.spentCents)}
      reserved={formatDollars(position.reservedCents)}
      serverUrl={origin ? `${origin}/api/mcp` : "/api/mcp"}
      notice={notice}
    />
  )
}
