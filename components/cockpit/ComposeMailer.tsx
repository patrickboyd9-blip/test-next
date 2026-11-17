"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

import { ProofTray } from "./ProofCard"
import { CockpitFrame, Eyebrow, fieldClass, Panel } from "./ui"

const STEP_LABEL: Record<ComposeStep, string> = {
  to: "To",
  what: "What",
  proof: "Proof",
}

export function ComposeMailer({
  shop,
  initialStep = composeSteps(LIST_BEFORE_PROOF)[0] ?? "what",
  initialDraft,
}: {
  shop: string
  initialStep?: ComposeStep
  initialDraft?: ComposeDraft
}) {
  const router = useRouter()
  const [step, setStep] = useState<ComposeStep>(initialStep)
  const [draft, setDraft] = useState<ComposeDraft>(initialDraft ?? emptyDraft())
  const [advanced, setAdvanced] = useState(false)
  const [listError, setListError] = useState("")
  const steps = composeSteps(LIST_BEFORE_PROOF)
  const proof = useMemo(() => proofFromDraft(draft, shop), [draft, shop])
  const people = selectedPeople(draft)
  const ready = canContinue(step, draft)
  const lastStep = steps[steps.length - 1] === step

  function patch(partial: Partial<ComposeDraft>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  async function onFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    const count = countAddresses(text)
    setListError(count > 0 ? "" : "That file needs a header row and at least one person.")
    patch({ uploadedName: file.name, uploadedPeople: count, listId: null })
  }

  function continueStep() {
    if (!ready) return
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
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="text-sm text-[#8ecfff]">
            Home
          </Link>
          <Eyebrow>New mailer</Eyebrow>
        </div>
        <ol className="grid grid-cols-3 gap-2">
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
                {STEP_LABEL[item]}
              </button>
            </li>
          ))}
        </ol>

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

        {step === "what" ? (
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
            <label className="block">
              <span className="mb-2 block text-sm text-[#b7c9d8]">Logo, if you have one</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="block min-h-12 w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[#123044] file:px-3 file:text-[#e7f2fb]"
                onChange={(event) => patch({ logoName: event.target.files?.[0]?.name ?? null })}
              />
            </label>
            {draft.logoName ? <p className="text-sm">Using {draft.logoName}. No icon is invented if you skip this.</p> : null}
          </Panel>
        ) : null}

        {step === "proof" ? (
          <div className="space-y-4">
            <Panel className="space-y-3 p-4 sm:p-6">
              <Eyebrow>Proof</Eyebrow>
              <h1 className="text-2xl font-semibold">Does this look right?</h1>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        </div>

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
