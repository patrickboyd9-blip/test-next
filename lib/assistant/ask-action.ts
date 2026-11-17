"use server"

import { previewDemoAllowed } from "@/lib/auth/session"

import { answerHelp, type HelpAnswer } from "./help"

export async function askCometAction(question: string, page: string, step: string): Promise<HelpAnswer> {
  return answerHelp({
    question,
    page,
    step,
    demo: previewDemoAllowed() || !process.env.ANTHROPIC_API_KEY,
  })
}
