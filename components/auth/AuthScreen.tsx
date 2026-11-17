import type { ReactNode } from "react"

import { CockpitFrame, Eyebrow, Panel, fieldClass } from "@/components/cockpit/ui"

export function AuthScreen({
  eyebrow,
  title,
  notice,
  error,
  children,
}: {
  eyebrow: string
  title: string
  notice?: string
  error?: string
  children: ReactNode
}) {
  return (
    <CockpitFrame hero>
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-16">
        <Panel className="space-y-4 p-6">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {notice ? <p className="text-sm text-[#b7d7ea]">{notice}</p> : null}
          {error ? <p className="text-sm text-[#ffb4b4]">{error}</p> : null}
          <div className="space-y-3">{children}</div>
        </Panel>
      </div>
    </CockpitFrame>
  )
}

export function authFieldClass(): string {
  return fieldClass()
}
