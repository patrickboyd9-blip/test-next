"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { signIn, signOut } from "@/auth"

import { registerPasswordAccount, requestPasswordReset, resetPassword, verifyEmailToken } from "./accounts"

async function origin(): Promise<string> {
  const headerList = await headers()
  return headerList.get("origin") ?? "https://test-next-modern-mail2.vercel.app"
}

export async function signUpAction(formData: FormData): Promise<void> {
  const result = await registerPasswordAccount({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? ""),
    businessName: String(formData.get("business") ?? ""),
    origin: await origin(),
  })
  if (!result.ok) redirect(`/sign-up?error=${encodeURIComponent(result.message)}`)
  const next = result.notice.startsWith("You can verify later") ? "/app?notice=verify-later" : "/app"
  await signIn("credentials", {
    email: result.user.email,
    password: String(formData.get("password") ?? ""),
    redirectTo: next,
  })
}

export async function signInAction(formData: FormData): Promise<void> {
  await signIn("credentials", {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    redirectTo: "/app",
  })
}

export async function googleAction(): Promise<void> {
  await signIn("google", { redirectTo: "/app" })
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" })
}

export async function verifyAction(formData: FormData): Promise<void> {
  const ok = await verifyEmailToken(String(formData.get("token") ?? ""))
  redirect(ok ? "/app?notice=verified" : "/sign-in?error=That%20link%20is%20no%20longer%20valid.")
}

export async function resetRequestAction(formData: FormData): Promise<void> {
  const result = await requestPasswordReset({
    email: String(formData.get("email") ?? ""),
    origin: await origin(),
  })
  redirect(`/reset?notice=${encodeURIComponent(result.notice)}`)
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const ok = await resetPassword(String(formData.get("token") ?? ""), String(formData.get("password") ?? ""))
  redirect(ok ? "/sign-in?notice=Password%20updated." : "/reset?error=That%20link%20is%20no%20longer%20valid.")
}
