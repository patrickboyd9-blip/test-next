"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { DesignRequestForm } from "@/components/campaign-creator/design-request/DesignRequestForm"
import {
  approvePreview,
  canApprove,
  canContinue,
  composeSteps,
  countAddresses,
  emptyDraft,
  LIST_BEFORE_PROOF,
  nextStep,
  PLACEHOLDER_FULL_PRICE,
  previousStep,
  proofFromDraft,
  SAVED_LISTS,
  selectedListName,
  selectedPeople,
  type ComposeDraft,
  type ComposeStep,
} from "@/lib/mailer-compose/flow"
import {
  ACCOMPLISH_QUESTION,
  EXAMPLE_PROMPTS,
  interviewReply,
  proposalFor,
  reactToProposal,
  tonySample,
  type ProposedMailer,
} from "@/lib/mailer-compose/interview"
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { listMailTemplates, getMailTemplate } from "@/lib/mail-templates/query"
import { TEMPLATE_INDUSTRIES, TEMPLATE_INDUSTRY_LABELS, type TemplateIndustry } from "@/lib/mail-templates/types"

import { StartChoices, type StartPath } from "./StartChoices"

import { ProofTray } from "./ProofCard"
import { ProofFrame } from "@/components/campaign-creator/upload/ProofFrame"
import { classifyDesignUpload, type DesignPreviewMedia } from "@/lib/mailer-compose/design-preview"
import { cometLiveTurn } from "@/lib/mailer-compose/live-turn"
import { CometMark } from "@/components/assistant/CometMark"
import { ASSISTANT_NAME } from "@/lib/assistant/comet"

import { CockpitFrame, Eyebrow, fieldClass, Panel } from "./ui"

const STEP_LABEL: Record<ComposeStep, string> = {
  to: "To",
  what: "What",
  proof: "Proof",
}

interface HeldDesign {
  name: string
  url: string
  mediaType: DesignPreviewMedia
}

export function ComposeMailer({
  shop,
  initialStep = composeSteps(LIST_BEFORE_PROOF)[0] ?? "what",
  initialDraft,
  initialPath = null,
  initialQuick = false,
  initialIndustry = null,
  sampleBeat = null,
  liveChat = false,
}: {
  shop: string
  initialStep?: ComposeStep
  initialDraft?: ComposeDraft
  initialPath?: StartPath | null
  initialQuick?: boolean
  initialIndustry?: TemplateIndustry | null
  sampleBeat?: number | null
  /** True only when production can call the conversation engine. */
  liveChat?: boolean
}) {
  const router = useRouter()
  const [step, setStep] = useState<ComposeStep>(initialStep)
  const [draft, setDraft] = useState<ComposeDraft>(initialDraft ?? emptyDraft())
  const [path, setPath] = useState<StartPath | null>(initialPath)
  const [quick, setQuick] = useState(initialQuick)
  const tony = sampleBeat == null ? null : tonySample(sampleBeat)
  const [chat, setChat] = useState(tony?.turns ?? [{ role: "assistant" as const, text: ACCOMPLISH_QUESTION, choices: EXAMPLE_PROMPTS }])
  const [known, setKnown] = useState<Partial<CampaignBrief>>({})
  const [proposal, setProposal] = useState<ProposedMailer | null>(tony?.proposal ?? null)
  const [frontFile, setFrontFile] = useState<HeldDesign | null>(null)
  const [backFile, setBackFile] = useState<HeldDesign | null>(null)
  const [designError, setDesignError] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [industry, setIndustry] = useState<TemplateIndustry | "all">(initialIndustry ?? "all")
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [listError, setListError] = useState("")
  const steps = composeSteps(LIST_BEFORE_PROOF)
  const proof = useMemo(
    () => proofFromDraft(draft, proposal?.shop || shop),
    [draft, proposal?.shop, shop]
  )
  const people = selectedPeople(draft)
  const stepOneReady =
    path === "upload"
      ? Boolean(frontFile && backFile)
      : path === "template"
        ? Boolean(templateId)
        : path === "ai" && !quick
          ? Boolean(proposal)
          : canContinue("what", draft)
  const ready = step === "what" ? stepOneReady : canContinue(step, draft)
  const lastStep = steps[steps.length - 1] === step
  const showTracker = path !== null && path !== "team"
  const firstLabel = path === "upload" ? "Upload" : path === "template" ? "Template" : "What"

  function patch(partial: Partial<ComposeDraft>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  async function onLogo(file: File | null) {
    if (!file) return
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch {
      setDesignError("That logo could not be read. Try a PNG or JPG.")
      return
    }
    const classified = classifyDesignUpload(bytes)
    if (!classified.ok || classified.mediaType === "application/pdf") {
      setDesignError(classified.ok ? "Use a PNG or JPG for the logo." : classified.error)
      return
    }
    if (logoUrl) URL.revokeObjectURL(logoUrl)
    setLogoUrl(URL.createObjectURL(file.slice(0, file.size, classified.mediaType)))
    patch({ logoName: file.name })
    setDesignError("")
  }

  async function onDesign(face: "front" | "back", file: File | null) {
    const replace = face === "front" ? setFrontFile : setBackFile
    if (!file) {
      replace(null)
      return
    }
    setDesignError("")
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch {
      replace(null)
      setDesignError("That file could not be read. Try it again.")
      return
    }
    const classified = classifyDesignUpload(bytes)
    if (!classified.ok) {
      replace(null)
      setDesignError(classified.error)
      return
    }
    const url = URL.createObjectURL(file.slice(0, file.size, classified.mediaType))
    replace((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return { name: file.name, url, mediaType: classified.mediaType }
    })
  }

  async function onFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    const count = countAddresses(text)
    setListError(count > 0 ? "" : "That file needs a header row and at least one person.")
    patch({ uploadedName: file.name, uploadedPeople: count, listId: null })
  }

  async function answer(text: string) {
    if (liveChat) {
      const result = await cometLiveTurn({
        brief: known,
        history: chat.map((turn) => ({ role: turn.role, text: turn.text })),
        message: text,
        refining: false,
      })
      if (result.live) {
        setKnown(result.brief)
        setChat((current) => [
          ...current,
          { role: "customer", text },
          { role: "assistant", text: result.ready ? `${result.reply}\n\n${result.line}` : result.reply },
        ])
        if (result.ready) {
          setProposal({ shop: result.shop, line: result.line, why: result.reply, audience: result.audience, revision: 0 })
          patch({ brief: result.line })
        }
        return
      }
    }
    const next = interviewReply(text, known)
    setKnown(next.brief)
    setChat((current) => [
      ...current,
      { role: "customer", text },
      { role: "assistant", text: next.ready ? `${proposalFor(next.brief).why}\n\n${proposalFor(next.brief).line}` : next.reply, choices: next.choices },
    ])
    if (next.ready) {
      const card = proposalFor(next.brief)
      setProposal(card)
      patch({ brief: card.line })
    }
  }

  async function tweak(reaction: string) {
    if (!proposal) return
    if (liveChat) {
      const result = await cometLiveTurn({
        brief: known,
        history: chat.map((turn) => ({ role: turn.role, text: turn.text })),
        message: reaction,
        refining: true,
      })
      if (result.live) {
        setKnown(result.brief)
        setProposal({ ...proposal, line: result.line, why: result.reply, audience: result.audience, revision: proposal.revision + 1 })
        patch({ brief: result.line })
        setChat((current) => [...current, { role: "customer", text: reaction }, { role: "assistant", text: result.reply }])
        return
      }
    }
    const next = reactToProposal(proposal, reaction)
    setProposal(next)
    patch({ brief: next.line })
    setChat((current) => [...current, { role: "customer", text: reaction }, { role: "assistant", text: next.why }])
  }

  function continueStep() {
    if (!ready) return
    if (step === "what" && proposal) patch({ brief: proposal.line })
    if (step === "what" && path === "upload") patch({ brief: "Your uploaded front and back, fitted to the postcard." })
    if (step === "what" && path === "template" && templateId) {
      const chosen = getMailTemplate(templateId)
      if (chosen && !draft.brief) patch({ brief: chosen.spec.offer || chosen.summary })
    }
    const following = nextStep(step, LIST_BEFORE_PROOF)
    if (following) setStep(following)
  }

  function approve() {
    if (!canApprove(draft)) return
    const result = approvePreview()
    const id = `preview-${draft.listId ?? "upload"}`
    sessionStorage.setItem(
      `mailer-preview:${id}`,
      JSON.stringify({
        name: draft.brief.replace(/\s+/g, " ").trim().slice(0, 42),
        listName: selectedListName(draft),
        people,
        status: result.status,
        detail: "Preview only. Nothing was mailed and nothing was charged.",
        line: proof.line,
        shop,
        phone: proof.phone,
        qr: proof.qr,
      })
    )
    router.push(`/app/mail/${id}`)
  }

  return (
    <CockpitFrame hero={path === null && step === "what"} postbox={path === null && step === "what" ? "start" : undefined}>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="text-sm text-[#8ecfff]">
            Home
          </Link>
          <Eyebrow>New mailer</Eyebrow>
        </div>
        {showTracker ? <ol className="grid grid-cols-3 gap-2">
          {steps.map((item, index) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => {
                  const previous = steps.slice(0, index)
                  if (previous.every((name) => canContinue(name, draft)) || item === step) setStep(item)
                }}
                className={`min-h-12 w-full rounded-xl border px-2 text-left text-sm ${
                  item === step
                    ? "border-[#5ce1ff] bg-[#102433] text-white"
                    : "border-[#1c3d52] text-[#8aa0b4]"
                }`}
              >
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em]">Step {index + 1}</span>
                {item === "what" ? firstLabel : STEP_LABEL[item]}
              </button>
            </li>
          ))}
        </ol> : null}

        {step === "to" ? (
          <Panel className="space-y-4 p-4 sm:p-6">
            <div>
              <Eyebrow>To</Eyebrow>
              <h1 className="mt-2 text-2xl font-semibold">Who should get it?</h1>
              <p className="mt-1 text-sm text-[#8aa0b4]">Sample lists. Or upload your own. The file stays on this screen.</p>
            </div>
            <ul className="space-y-2">
              {SAVED_LISTS.map((list) => {
                const selected = draft.listId === list.id && draft.uploadedPeople === 0
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      onClick={() => patch({ listId: list.id, uploadedName: null, uploadedPeople: 0 })}
                      className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-4 text-left ${
                        selected ? "border-[#5ce1ff] bg-[#102433]" : "border-[#245068]"
                      }`}
                    >
                      <span className="text-base">{list.name}</span>
                      <span className="text-sm text-[#8aa0b4]">{list.people} people</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <label className="block">
              <span className="mb-2 block text-sm text-[#b7c9d8]">Or upload a list (CSV)</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block min-h-12 w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[#5ce1ff] file:px-3 file:font-semibold file:text-[#041018]"
                onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {listError ? <p className="text-sm text-[#f0a202]">{listError}</p> : null}
            {draft.uploadedPeople > 0 ? (
              <p className="text-sm text-[#b7c9d8]">
                {draft.uploadedName}: {draft.uploadedPeople} people. The file stays on this screen.
              </p>
            ) : null}
          </Panel>
        ) : null}

        {step === "what" && path === null ? (
          <StartChoices onChoose={setPath} />
        ) : null}

        {step === "what" && path === "team" ? (
          <Panel className="bg-white p-4 text-neutral-900 sm:p-6">
            <DesignRequestForm onBack={() => setPath(null)} />
          </Panel>
        ) : null}

        {step === "what" && path === "ai" && !quick ? (
          <Panel className="space-y-4 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>Chat</Eyebrow>
                <h1 className="mt-2 text-2xl font-semibold">What would you like to accomplish?</h1>
              </div>
              <label className="inline-flex min-h-11 cursor-pointer items-center text-sm text-[#8ecfff]">
                <span className="sr-only">Add a logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="max-w-28 text-xs"
                  onChange={(event) => void onLogo(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <ul className="space-y-3">
              {chat.map((turn, index) => (
                <li key={`${turn.role}-${index}`} className={turn.role === "customer" ? "text-right" : "text-left"}>
                  <p className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-sm leading-6 ${turn.role === "customer" ? "bg-[#5ce1ff] text-[#041018]" : "bg-[#071018] text-[#e7f2fb]"}`}>
                    {turn.role === "assistant" ? (
                      <span className="mb-1 flex items-center gap-1 text-xs text-[#7ee7ff]">
                        <CometMark className="size-3.5" />
                        {ASSISTANT_NAME}
                      </span>
                    ) : null}
                    {turn.text}
                  </p>
                  {turn.choices && index === chat.length - 1 && !proposal ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {turn.choices.map((choice) => (
                        <button key={choice} type="button" onClick={() => answer(choice)} className="min-h-11 rounded-full border border-[#245068] px-3 text-left text-sm">
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {proposal ? (
              <div className="space-y-3">
                <ProofTray
                  proof={{
                    shop: proposal.shop,
                    line: proposal.line,
                    to: proposal.audience,
                    people: 0,
                    phone: "",
                    website: "",
                    logoName: null,
                    qr: null,
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {["Make it more fun", "Different photo", "Bigger offer"].map((choice) => (
                    <button key={choice} type="button" onClick={() => tweak(choice)} className="min-h-11 rounded-full border border-[#245068] px-3 text-sm">
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const field = event.currentTarget.elements.namedItem("say") as HTMLInputElement
                const value = field.value.trim()
                if (!value) return
                if (proposal) tweak(value)
                else answer(value)
                field.value = ""
              }}
            >
              <input name="say" placeholder="Or type your own answer" className={fieldClass()} />
              <button type="submit" className="min-h-12 rounded-xl bg-[#123044] px-4 text-sm">Send</button>
            </form>
            <button type="button" onClick={() => setQuick(true)} className="min-h-11 text-sm text-[#8ecfff]">
              I already know what I want
            </button>
            {liveChat ? null : <p className="text-xs text-[#8aa0b4]">Sample conversation. No live model is called.</p>}
          </Panel>
        ) : null}

        {step === "what" && path === "ai" && quick ? (
          <Panel className="space-y-4 p-4 sm:p-6">
            <div>
              <Eyebrow>What</Eyebrow>
              <h1 className="mt-2 text-2xl font-semibold">What do you want to mail?</h1>
              <p className="mt-1 text-sm text-[#8aa0b4]">One sentence. We print it as you wrote it.</p>
            </div>
            <textarea
              value={draft.brief}
              onChange={(event) => patch({ brief: event.target.value })}
              rows={4}
              placeholder="$50 off a tune-up if they call this month."
              className={fieldClass()}
            />
            <button type="button" onClick={() => setQuick(false)} className="min-h-11 text-sm text-[#8ecfff]">
              Back to the chat
            </button>
          </Panel>
        ) : null}

        {step === "what" && path === "upload" ? (
          <Panel className="space-y-4 p-4 sm:p-6">
            <div>
              <Eyebrow>Upload</Eyebrow>
              <h1 className="mt-2 text-2xl font-semibold">Upload the front and the back</h1>
              <p className="mt-1 text-sm text-[#8aa0b4]">PNG, JPG, or PDF. Each file stays in this browser and is fitted on the proof. Nothing is uploaded or mailed.</p>
            </div>
            <label className="block text-sm">Front
              <input type="file" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf" className="mt-1 block min-h-12 w-full text-sm" onChange={(event) => void onDesign("front", event.target.files?.[0] ?? null)} />
            </label>
            {frontFile ? <ProofFrame src={frontFile.url} mediaType={frontFile.mediaType} face="front" label={`Front · ${frontFile.name}`} size={draft.size} /> : null}
            <label className="block text-sm">Back
              <input type="file" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf" className="mt-1 block min-h-12 w-full text-sm" onChange={(event) => void onDesign("back", event.target.files?.[0] ?? null)} />
            </label>
            {backFile ? <ProofFrame src={backFile.url} mediaType={backFile.mediaType} face="back" label={`Back · ${backFile.name}`} size={draft.size} /> : null}
            {designError ? <p role="alert" className="rounded-xl bg-[#3a1418] px-3 py-3 text-sm text-[#ffb4b4]">{designError}</p> : null}
            {frontFile && backFile ? <p className="text-sm">Both sides are ready. Continue to the proof.</p> : null}
          </Panel>
        ) : null}

        {step === "what" && path === "template" ? (
          <Panel className="space-y-4 p-4 sm:p-6">
            <div>
              <Eyebrow>Template</Eyebrow>
              <h1 className="mt-2 text-2xl font-semibold">Start from a template</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setIndustry("all")} className="min-h-11 rounded-full border border-[#245068] px-3 text-sm">All</button>
              {TEMPLATE_INDUSTRIES.map((item) => (
                <button key={item} type="button" onClick={() => setIndustry(item)} className={`min-h-11 rounded-full border px-3 text-sm ${industry === item ? "border-[#5ce1ff]" : "border-[#245068]"}`}>
                  {TEMPLATE_INDUSTRY_LABELS[item]}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {(industry === "all"
                ? listMailTemplates().filter((item, index, all) => all.findIndex((other) => other.industry === item.industry) === index)
                : listMailTemplates(industry)
              ).map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => { setTemplateId(item.id); patch({ brief: item.spec.offer || item.summary }) }} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left ${templateId === item.id ? "border-[#5ce1ff]" : "border-[#245068]"}`}>
                    {galleryPhotoSrc(item.id) ? (
                      <img src={galleryPhotoSrc(item.id) ?? ""} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span aria-hidden className="h-10 w-4 shrink-0 rounded-full" style={{ background: item.spec.palette?.[0] ?? "#245068" }} />
                    )}
                    <span>
                      <span className="block font-medium">{item.name}</span>
                      <span className="text-sm text-[#8aa0b4]">{item.layoutRecipe ? item.layoutRecipe.replace("-", " ") : item.summary}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {templateId ? (
              <div className="space-y-3">
                <p className="text-sm text-[#b7c9d8]">Add your details. Sample text stays if you skip one.</p>
                <input value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} placeholder="Phone" className={fieldClass()} />
                <input value={draft.brief} onChange={(event) => patch({ brief: event.target.value })} placeholder="Offer" className={fieldClass()} />
                <div className="flex flex-wrap gap-2">
                  {["Make it more fun", "Different photo", "Bigger offer"].map((choice) => (
                    <button key={choice} type="button" onClick={() => patch({ brief: `${draft.brief} (${choice})` })} className="min-h-11 rounded-full border border-[#245068] px-3 text-sm">{choice}</button>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
        ) : null}

        {step === "proof" && path === "upload" && (!frontFile || !backFile) ? (
          <Panel className="space-y-3 p-4 sm:p-6">
            <h1 className="text-2xl font-semibold">The proof needs both files</h1>
            <p role="alert" className="text-sm text-[#ffb4b4]">Upload a PNG, JPG, or PDF for the front and the back. A refresh clears them, because this preview keeps the files in the browser.</p>
          </Panel>
        ) : null}

        {step === "proof" && path === "upload" && frontFile && backFile ? (
          <div className="space-y-4">
            <Panel className="space-y-4 p-4 sm:p-6">
              <Eyebrow>Proof</Eyebrow>
              <h1 className="text-2xl font-semibold">Does this look right?</h1>
              <p className="text-sm text-[#b7c9d8]">Your files, fitted inside the postcard. They stay in this browser. Nothing was stored or mailed.</p>
              <ProofFrame src={frontFile.url} mediaType={frontFile.mediaType} face="front" label={`Front · ${frontFile.name}`} size={draft.size} />
              <ProofFrame src={backFile.url} mediaType={backFile.mediaType} face="back" label={`Back · ${backFile.name}`} size={draft.size} />
            </Panel>
          </div>
        ) : null}

        {step === "proof" && path !== "upload" ? (
          <div className="space-y-4">
            <Panel className="space-y-3 p-4 sm:p-6">
              <Eyebrow>Proof</Eyebrow>
              <h1 className="text-2xl font-semibold">Does this look right?</h1>
              {logoUrl ? (
                // The mark is the customer's file. Keep its proportions.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={proof.logoName ?? "Logo"} className="h-14 w-24 rounded-md bg-white object-contain p-1" />
              ) : null}
              <ProofTray proof={proof} />
            </Panel>
          </div>
        ) : null}

        {lastStep ? (
          <Panel className="space-y-3 p-4 sm:p-6">
            <Eyebrow>Full price</Eyebrow>
            <p className="text-4xl font-semibold tracking-tight">{PLACEHOLDER_FULL_PRICE.label}</p>
            <p className="text-sm leading-relaxed text-[#b7c9d8]">{PLACEHOLDER_FULL_PRICE.detail}</p>
            <p className="rounded-xl bg-[#f0a202]/15 px-3 py-3 text-sm text-[#f6d48a]">
              This button only saves a preview. Nothing is mailed or charged.
            </p>
            <button
              type="button"
              onClick={approve}
              disabled={!canApprove(draft)}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#5ce1ff] px-4 text-base font-semibold text-[#041018] disabled:opacity-40 sm:w-auto"
            >
              Approve & mail
            </button>
          </Panel>
        ) : null}

        {path && path !== "team" ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              const prior = previousStep(step, LIST_BEFORE_PROOF)
              if (prior) setStep(prior)
            }}
            disabled={!previousStep(step, LIST_BEFORE_PROOF)}
            className="min-h-12 rounded-xl border border-[#245068] px-4 text-sm disabled:opacity-40"
          >
            Back
          </button>
          {!lastStep ? (
            <button
              type="button"
              onClick={continueStep}
              disabled={!ready}
              className="min-h-12 rounded-xl bg-[#5ce1ff] px-5 text-base font-semibold text-[#041018] disabled:opacity-40"
            >
              Continue
            </button>
          ) : null}
        </div> : null}

        <Panel className="p-4">
          <button
            type="button"
            onClick={() => setAdvanced((value) => !value)}
            className="min-h-11 text-sm text-[#8ecfff]"
            aria-expanded={advanced}
          >
            {advanced ? "Hide advanced" : "Advanced"}
          </button>
          {advanced ? (
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                Card size
                <select
                  value={draft.size}
                  onChange={(event) => patch({ size: event.target.value === "6x9" ? "6x9" : "5x8" })}
                  className={`${fieldClass()} mt-1`}
                >
                  <option value="5x8">5×8 postcard</option>
                  <option value="6x9">6×9 postcard</option>
                </select>
              </label>
              <label className="block text-sm">
                Phone on the card
                <input
                  value={draft.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                  className={`${fieldClass()} mt-1`}
                  placeholder="(619) 555-0148"
                />
              </label>
              <label className="block text-sm">
                Web address, only if you want a code
                <input
                  value={draft.website}
                  onChange={(event) => patch({ website: event.target.value })}
                  className={`${fieldClass()} mt-1`}
                  placeholder="jordans.example/book"
                />
              </label>
              <Link href="/app/campaigns/new" className="inline-flex min-h-11 items-center text-sm text-[#8ecfff]">
                Open the full editor
              </Link>
            </div>
          ) : null}
        </Panel>
      </div>
    </CockpitFrame>
  )
}
