"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { ASSISTANT_INTRO, ASSISTANT_NAME } from "@/lib/assistant/comet"
import { markCometIntroSeen } from "@/lib/assistant/intro-action"

import { CometMark } from "./CometMark"

export function CometIntro({ open }: { open: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(open)
  if (!visible) return null

  async function go() {
    await markCometIntroSeen()
    router.push("/app/mail?path=ai")
  }

  async function stay() {
    await markCometIntroSeen()
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#05080f]/80 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="comet-intro-title">
      <div className="mm-intro w-full max-w-lg rounded-3xl border border-[#1c3d52] bg-[#0c1424] p-6 text-[#e7f2fb] shadow-[0_0_40px_rgba(92,225,255,0.08)] sm:p-8">
        <CometMark className="size-10" />
        <h2 id="comet-intro-title" className="mt-4 text-2xl font-semibold">{ASSISTANT_NAME}</h2>
        <p className="mt-3 text-base leading-7 text-[#d5e6f2]">{ASSISTANT_INTRO}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => void go()} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#5ce1ff] px-4 font-semibold text-[#041018]">
            Let&apos;s go
          </button>
          <button type="button" onClick={() => void stay()} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#245068] px-4">
            Look around first
          </button>
        </div>
      </div>
    </div>
  )
}
