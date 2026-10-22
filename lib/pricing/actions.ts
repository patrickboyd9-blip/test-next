"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ownerCookieMatches, ownerKeyMatches, ownerSessionToken, PRICING_OWNER_COOKIE, pricingOwnerKey } from "./owner-gate"
import { pricingConfigFromForm } from "./quote"
import { getPricingStore } from "./store"

export async function unlockPricing(formData: FormData) {
  if (!pricingOwnerKey()) redirect("/app/pricing?locked=missing")
  const key = String(formData.get("key") ?? "")
  if (!ownerKeyMatches(key)) redirect("/app/pricing?locked=mismatch")
  const jar = await cookies()
  jar.set(PRICING_OWNER_COOKIE, ownerSessionToken(pricingOwnerKey() ?? key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  })
  redirect("/app/pricing")
}

export async function savePricing(formData: FormData) {
  const jar = await cookies()
  if (!ownerCookieMatches(jar.get(PRICING_OWNER_COOKIE)?.value)) redirect("/app/pricing")
  await getPricingStore().put(pricingConfigFromForm(formData))
  redirect("/app/pricing?saved=1")
}
