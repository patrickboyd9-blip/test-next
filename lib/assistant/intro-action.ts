"use server"

import { cookies } from "next/headers"

import { getSession } from "@/lib/auth/session"

const COOKIE = "mm_comet_intro"

export async function markCometIntroSeen(): Promise<void> {
  const session = await getSession()
  if (!session) return
  const jar = await cookies()
  jar.set(COOKIE, session.userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 })
}

export async function cometIntroSeen(userId: string): Promise<boolean> {
  const jar = await cookies()
  return jar.get(COOKIE)?.value === userId
}
