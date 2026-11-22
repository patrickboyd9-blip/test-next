import { readFile } from "node:fs/promises"
import path from "node:path"

import { lockedHeroMissing, type LockedHeroInput, type LockedHeroSize } from "@/lib/mail-templates/locked-hero"
import { finishedGalleryPhoto } from "@/lib/mail-templates/gallery-finished"
import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { getMailTemplate } from "@/lib/mail-templates/query"
import { readRasterSize } from "@/lib/print-spec/raster"

import { GEMINI_EDIT_MODEL, requestGeminiEdit } from "./gemini"
import { assembleAddressBack } from "./locked-hero-back"
import { lockedHeroInstruction } from "./locked-hero-instruction"
import {
  HERO_EDIT_FAILED,
  PHOTO_EDIT_DAILY,
  PHOTO_EDIT_NEED_PHOTO,
  PHOTO_EDIT_TOO_LARGE,
  PHOTO_EDIT_UNAVAILABLE,
  WORD_CHANGE_ALLOWANCE,
  WORD_CHANGE_LOGO,
  WORD_CHANGE_PAUSED,
} from "./messages"
import { stampProof } from "./proof-watermark"
import { toPrintJpeg } from "./print-jpeg"
import {
  wordChangeAccountDaily,
  wordChangeFreeAllowance,
  wordChangeIsPaid,
  wordChangeLedger,
  wordChangeSiteDaily,
  type WordChangeBlock,
  type WordChangeLedger,
} from "./word-change"
import { loadFinishedPostcard } from "./edit-finished-words"

const MAX_IMAGE = 8_000_000
const MAX_LOGO = 2_000_000

export interface LockedHeroEditSuccess {
  ok: true
  frontSrc: string
  backSrc: string
  editId: string
  /** Unpaid proofs carry a light PROOF mark. */
  proof: boolean
}

export interface LockedHeroEditFailure {
  ok: false
  status: number
  message: string
  code: "invalid" | "unavailable" | "failed" | WordChangeBlock
}

export interface LockedHeroEditInput {
  userId: string
  templateId: string
  campaignName: string
  size: string | null
  businessName: string
  offer: string
  callToAction: string
  phone: string
  website?: string
  instructions: string
  /** Extra note when the current proof is the picture to edit. */
  changeNote?: string
  logoBase64?: string
  /** Data URL of the proof on screen. When set, this is the edit input. */
  currentFrontBase64?: string
  now?: Date
  env?: NodeJS.ProcessEnv
  ledger?: WordChangeLedger
  editor?: LockedHeroEditor
  loadImage?: (templateId: string) => Promise<Buffer | null>
}

export type LockedHeroEditor = (input: {
  image: Buffer
  mimeType: "image/jpeg" | "image/png"
  instruction: string
  logo: { bytes: Buffer; mimeType: "image/jpeg" | "image/png" } | null
}) => Promise<Buffer>

let editorForTests: LockedHeroEditor | null = null
let loaderForTests: ((templateId: string) => Promise<Buffer | null>) | null = null

export function useLockedHeroEditorForTests(editor: LockedHeroEditor | null): void {
  editorForTests = editor
}

export function useLockedHeroImageLoaderForTests(loader: ((templateId: string) => Promise<Buffer | null>) | null): void {
  loaderForTests = loader
}

export async function editLockedHero(input: LockedHeroEditInput): Promise<LockedHeroEditSuccess | LockedHeroEditFailure> {
  const form = formOf(input)
  const missing = lockedHeroMissing(form)
  if (missing) return { ok: false, status: 400, message: missing, code: "invalid" }
  if (!getMailTemplate(input.templateId)) {
    return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO, code: "invalid" }
  }

  const size: LockedHeroSize = form.size === "6x9" ? "6x9" : "5x8"
  const changeNote = clip(input.changeNote ?? "", 400)
  let image: Buffer | null
  try {
    image = input.currentFrontBase64?.trim()
      ? decodeImage(input.currentFrontBase64)
      : await (input.loadImage ?? loaderForTests ?? loadLockedHeroImage)(input.templateId)
  } catch {
    image = null
  }
  if (image === null) return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO, code: "invalid" }
  if (image.length === 0 || image.length > MAX_IMAGE) {
    return { ok: false, status: 400, message: PHOTO_EDIT_TOO_LARGE, code: "invalid" }
  }
  let mimeType: "image/jpeg" | "image/png"
  try {
    mimeType = mimeOf(image)
  } catch {
    return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO, code: "invalid" }
  }

  const logo = decodeLogo(input.logoBase64)
  if (!logo.ok) return { ok: false, status: 400, message: WORD_CHANGE_LOGO, code: "invalid" }

  const env = input.env ?? process.env
  const editor = input.editor ?? editorForTests
  const key = env.GEMINI_API_KEY?.trim() ?? ""
  if (!editor && !key) return { ok: false, status: 503, message: PHOTO_EDIT_UNAVAILABLE, code: "unavailable" }

  const paid = wordChangeIsPaid(env)
  const ledger = input.ledger ?? wordChangeLedger()
  let reservation: Awaited<ReturnType<WordChangeLedger["reserve"]>>
  try {
    reservation = await ledger.reserve({
      userId: input.userId,
      now: input.now ?? new Date(),
      paid,
      freeAllowance: wordChangeFreeAllowance(env),
      accountDaily: wordChangeAccountDaily(env),
      siteDaily: wordChangeSiteDaily(env),
    })
  } catch {
    return { ok: false, status: 503, message: PHOTO_EDIT_UNAVAILABLE, code: "unavailable" }
  }
  if (!reservation.ok) return block(reservation.reason)

  try {
    const instruction = lockedHeroInstruction({
      campaignName: clip(form.campaignName, 80),
      size,
      businessName: clip(form.businessName, 80),
      offer: clip(form.offer, 120),
      callToAction: clip(form.callToAction, 120),
      phone: clip(form.phone, 40),
      website: clip(form.website, 120),
      instructions: clip(form.instructions, 800),
      changeNote,
      hasLogo: Boolean(logo.bytes),
    })
    const edited = editor
      ? await editor({ image, mimeType, instruction, logo: logo.bytes })
      : await requestGeminiEdit({
          image,
          mimeType,
          instruction,
          apiKey: key,
          model: GEMINI_EDIT_MODEL,
          purpose: "design",
          logo: logo.bytes ?? undefined,
        })
    const front = await toPrintJpeg(edited)
    const back = await assembleAddressBack({
      size,
      businessName: clip(form.businessName, 80),
      offer: clip(form.offer, 120),
      callToAction: clip(form.callToAction, 120),
      phone: clip(form.phone, 40),
      website: clip(form.website, 120),
    })
    const markedFront = paid ? front : await stampProof(front)
    const markedBack = paid ? back : await stampProof(back, "#1c2430")
    return {
      ok: true,
      editId: reservation.id,
      proof: !paid,
      frontSrc: dataUrl(markedFront),
      backSrc: dataUrl(markedBack),
    }
  } catch {
    await ledger.release(reservation.id).catch(() => undefined)
    return { ok: false, status: 502, message: HERO_EDIT_FAILED, code: "failed" }
  }
}

export async function loadLockedHeroImage(templateId: string): Promise<Buffer | null> {
  if (finishedGalleryPhoto(templateId)) return loadFinishedPostcard(templateId)
  const src = galleryPhotoSrc(templateId)
  if (!src || !src.startsWith("/gallery/") || src.includes("..")) return null
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", src))
    if (bytes.length < 32 || bytes.length > MAX_IMAGE) return null
    return bytes
  } catch {
    return null
  }
}

function formOf(input: LockedHeroEditInput): LockedHeroInput {
  return {
    campaignName: input.campaignName,
    size: input.size,
    businessName: input.businessName,
    offer: input.offer,
    callToAction: input.callToAction,
    phone: input.phone,
    website: input.website ?? "",
    instructions: input.instructions,
    logoName: null,
  }
}

function block(reason: WordChangeBlock): LockedHeroEditFailure {
  if (reason === "allowance") {
    return { ok: false, status: 402, message: WORD_CHANGE_ALLOWANCE, code: "allowance" }
  }
  if (reason === "account-day") {
    return { ok: false, status: 429, message: PHOTO_EDIT_DAILY, code: "account-day" }
  }
  return { ok: false, status: 429, message: WORD_CHANGE_PAUSED, code: "site-day" }
}

function dataUrl(jpeg: Buffer): string {
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`
}

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function decodeImage(value: string): Buffer | null {
  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value
  if (base64.length > MAX_IMAGE * 2) return null
  const bytes = Buffer.from(base64, "base64")
  if (bytes.length < 8 || bytes.length > MAX_IMAGE) return null
  return bytes
}

function decodeLogo(
  value: string | undefined
): { ok: true; bytes: { bytes: Buffer; mimeType: "image/jpeg" | "image/png" } | null } | { ok: false } {
  if (!value?.trim()) return { ok: true, bytes: null }
  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value
  if (base64.length > MAX_LOGO * 2) return { ok: false }
  const bytes = Buffer.from(base64, "base64")
  if (bytes.length < 8 || bytes.length > MAX_LOGO) return { ok: false }
  try {
    return { ok: true, bytes: { bytes, mimeType: mimeOf(bytes) } }
  } catch {
    return { ok: false }
  }
}

function mimeOf(bytes: Buffer): "image/jpeg" | "image/png" {
  const size = readRasterSize(bytes)
  return size.kind === "jpeg" ? "image/jpeg" : "image/png"
}
