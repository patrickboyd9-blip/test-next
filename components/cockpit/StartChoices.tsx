import { LayoutTemplate, PenLine, Sparkles, Upload } from "lucide-react"

import { Eyebrow, Panel } from "./ui"

export type StartPath = "ai" | "upload" | "template" | "team"

const CHOICES: Array<{
  id: StartPath
  title: string
  description: string
  icon: typeof Sparkles
  featured?: boolean
}> = [
  {
    id: "ai",
    title: "Chat with AI",
    description: "Tell us your goal. We ask a few follow-ups and design the postcard.",
    icon: Sparkles,
    featured: true,
  },
  {
    id: "upload",
    title: "Upload my own design",
    description: "Upload a front and a back. We fit them to the postcard and show a proof.",
    icon: Upload,
  },
  {
    id: "template",
    title: "Start from a template",
    description: "Pick a mailer for your kind of business, then add your name and offer.",
    icon: LayoutTemplate,
  },
  {
    id: "team",
    title: "Have our team design it",
    description: "Share your logo, offer, and style. A person builds the postcard.",
    icon: PenLine,
  },
]

export function StartChoices({ onChoose }: { onChoose: (path: StartPath) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Eyebrow>New mailer</Eyebrow>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">How do you want to start?</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHOICES.map((choice) => {
          const Icon = choice.icon
          return (
            <button
              key={choice.id}
              type="button"
              data-choice={choice.id}
              onClick={() => onChoose(choice.id)}
              className={`flex min-h-40 flex-col items-start gap-3 rounded-2xl border p-5 text-left ${
                choice.featured
                  ? "border-[#5ce1ff] bg-[#102433] shadow-[0_0_24px_rgba(92,225,255,0.12)] sm:col-span-2"
                  : "border-[#1c3d52] bg-[#0c1424]"
              }`}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#071018] text-[#7ee7ff]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-lg font-semibold">{choice.title}</span>
              <span className="text-sm leading-6 text-[#b7c9d8]">{choice.description}</span>
            </button>
          )
        })}
      </div>
      <Panel className="px-4 py-3 text-sm text-[#8aa0b4]">Sample choices. Nothing is mailed from this screen.</Panel>
    </div>
  )
}
