"use client"

import { useActionState } from "react"

import { createAssistantToken, revokeAssistantTokenAction, saveSpendingCapAction } from "@/lib/mcp/settings-actions"

export interface TokenRow {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

export function ApiAssistants({
  tokens,
  capDollars,
  spent,
  reserved,
  serverUrl,
  notice,
}: {
  tokens: TokenRow[]
  capDollars: string
  spent: string
  reserved: string
  serverUrl: string
  notice: string | null
}) {
  const [created, create, pending] = useActionState(createAssistantToken, null)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight">API &amp; AI assistants</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Connect Claude, ChatGPT, or Cursor so they can prepare mailers. They can create a campaign, add a design or a gallery
          mailer, add a list, and show the proof and the full price. They cannot approve, print, or charge. You do that in Modern Mail.
        </p>
      </header>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium">Server address</h2>
        <p className="break-all rounded-lg border px-3 py-2 font-mono text-xs">{serverUrl}</p>
        <p className="text-muted-foreground">Paste this address into the assistant. Then paste a token, or sign in when it asks.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Spending cap</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Charged so far: {spent}. Waiting on your approval: {reserved}. An assistant cannot raise this cap. A charge over the cap is
          refused.
        </p>
        {notice ? <p className="text-sm">{notice}</p> : null}
        <form action={saveSpendingCapAction} className="flex flex-wrap items-center gap-2">
          <label className="text-sm" htmlFor="dollars">
            Cap in dollars
          </label>
          <input
            id="dollars"
            name="dollars"
            defaultValue={capDollars}
            inputMode="decimal"
            className="h-10 w-32 rounded-lg border bg-background px-3 text-sm"
          />
          <button type="submit" className="h-10 rounded-lg bg-foreground px-3 text-sm text-background">
            Save cap
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Tokens</h2>
        <p className="text-sm text-muted-foreground">Create a token, copy it once, and revoke it here whenever you want.</p>
        <form action={create} className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="token-name">
            Token name
          </label>
          <input
            id="token-name"
            name="name"
            placeholder="Name, such as Claude"
            className="h-10 min-w-48 flex-1 rounded-lg border bg-background px-3 text-sm"
          />
          <button type="submit" disabled={pending} className="h-10 rounded-lg bg-foreground px-3 text-sm text-background">
            Create token
          </button>
        </form>
        {created?.secret ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Copy this token now. It will not be shown again.
            <span className="mt-2 block break-all font-mono text-xs">{created.secret}</span>
          </p>
        ) : null}
        {created?.error ? <p className="text-sm">{created.error}</p> : null}
        {tokens.length === 0 ? <p className="text-sm text-muted-foreground">No tokens yet.</p> : null}
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{token.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {token.lastUsedAt ? `Last used ${token.lastUsedAt.slice(0, 10)}` : "Not used yet"}
                </span>
              </span>
              <form action={revokeAssistantTokenAction}>
                <input type="hidden" name="id" value={token.id} />
                <button type="submit" className="h-9 rounded-lg border px-3 text-sm">
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
