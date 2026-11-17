"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { askCometAction } from "@/lib/assistant/ask-action"
import { ASSISTANT_NAME, ASSISTANT_THINKING } from "@/lib/assistant/comet"
import type { HelpAnswer } from "@/lib/assistant/help"

import { CometMark } from "./CometMark"

interface Turn {
  role: "customer" | "assistant"
  text: string
  links?: { label: string; href: string }[]
  offerPerson?: boolean
}

export function AskComet() {
  const pathname = usePathname() ?? "/app"
  const params = useSearchParams()
  const step = params.get("step") ?? ""
  const proof = step === "proof" || pathname.includes("proof")
  const [open, setOpen] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [note, setNote] = useState("")
  const [savedNote, setSavedNote] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])

  async function ask(question: string) {
    const text = question.trim()
    if (!text) return
    setSavedNote(false)
    setTurns((current) => [...current, { role: "customer", text }])
    setThinking(true)
    try {
      const answer: HelpAnswer = await askCometAction(text, pathname, step)
      setTurns((current) => [
        ...current,
        { role: "assistant", text: answer.reply, links: answer.links, offerPerson: answer.offerPerson },
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed z-30 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#1c3d52] bg-[#0c1424]/95 px-3 text-sm text-[#e7f2fb] shadow-lg ${proof ? "bottom-4 left-4" : "bottom-4 right-4"}`}
      >
        <CometMark className="size-5" />
        Ask {ASSISTANT_NAME}
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-[#05080f]/50" role="presentation" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-comet-title"
            className="flex h-full w-full max-w-md flex-col border-l border-[#1c3d52] bg-[#0c1424] p-4 text-[#e7f2fb]"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false)
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="ask-comet-title" className="flex items-center gap-2 text-lg font-semibold">
                <CometMark />
                Ask {ASSISTANT_NAME}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-sm text-[#8ecfff]">
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-[#8aa0b4]">Help only. {ASSISTANT_NAME} does not mail, approve, or charge.</p>
            <ul className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto">
              {turns.map((turn, index) => (
                <li key={`${turn.role}-${index}`} className={turn.role === "customer" ? "text-right" : "text-left"}>
                  <p className={`inline-block max-w-[90%] rounded-2xl px-3 py-2 text-left text-sm leading-6 ${turn.role === "customer" ? "bg-[#5ce1ff] text-[#041018]" : "bg-[#071018]"}`}>
                    {turn.text}
                  </p>
                  {turn.links?.map((link) => (
                    <Link key={link.href} href={link.href} className="mt-1 block text-sm text-[#8ecfff]">
                      {link.label}
                    </Link>
                  ))}
                  {turn.offerPerson ? (
                    <form
                      className="mt-2 space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        if (!note.trim()) return
                        setSavedNote(true)
                      }}
                    >
                      <label className="block text-sm">
                        Talk to a person
                        <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-[#245068] bg-[#071018] p-2" />
                      </label>
                      <button type="submit" className="min-h-11 rounded-xl border border-[#245068] px-3 text-sm">
                        Keep this note here
                      </button>
                      {savedNote ? <p className="text-xs text-[#8aa0b4]">This note stays on this screen. It is not sent.</p> : null}
                    </form>
                  ) : null}
                </li>
              ))}
              {thinking ? <li className="text-sm text-[#8aa0b4]">{ASSISTANT_THINKING}</li> : null}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const field = event.currentTarget.elements.namedItem("q") as HTMLInputElement
                void ask(field.value)
                field.value = ""
              }}
            >
              <input name="q" aria-label={`Ask ${ASSISTANT_NAME}`} className="min-h-12 flex-1 rounded-xl border border-[#245068] bg-[#071018] px-3" placeholder="Ask about a step" />
              <button type="submit" className="min-h-12 rounded-xl bg-[#5ce1ff] px-3 font-semibold text-[#041018]">
                Send
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
