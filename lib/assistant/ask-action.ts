"use server"

import { getSession, previewDemoAllowed } from "@/lib/auth/session"
import { beginMailAction } from "@/lib/ops/mail-flow"

import { answerHelp, type HelpAnswer } from "./help"

export async function askCometAction(question: string, page: string, step: string): Promise<HelpAnswer> {
  const session = await getSession()
  beginMailAction(session?.userId ?? "anonymous", "ai")
  return answerHelp({
    question,
    page,
    step,
    demo: previewDemoAllowed() || !process.env.ANTHROPIC_API_KEY,
  })
}
