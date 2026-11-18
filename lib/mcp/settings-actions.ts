"use server"

import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { parseCapDollars, setSpendingCap } from "@/lib/ops/spend-cap"

import { createAssistantToken as mintToken, revokeAssistantToken } from "./tokens"

export async function createAssistantToken(
  _prev: { secret?: string; error?: string } | null,
  formData: FormData
): Promise<{ secret?: string; error?: string }> {
  const session = await getSession()
  if (!session) return { error: "Sign in to create a token." }
  const name = String(formData.get("name") ?? "").trim() || "Assistant"
  const minted = await mintToken({ userId: session.userId, name })
  return { secret: minted.secret }
}

export async function revokeAssistantTokenAction(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  await revokeAssistantToken(session.userId, String(formData.get("id") ?? ""))
  redirect("/app/settings/api")
}

export async function saveSpendingCapAction(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const parsed = parseCapDollars(String(formData.get("dollars") ?? ""))
  if (!parsed.ok) redirect("/app/settings/api?cap=invalid")
  await setSpendingCap(session.userId, parsed.capCents)
  redirect("/app/settings/api?cap=saved")
}
