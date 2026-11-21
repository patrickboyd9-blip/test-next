import { finishedGalleryPhoto } from "@/lib/mail-templates/gallery-finished"
import { readRasterSize } from "@/lib/print-spec/raster"

import { GEMINI_EDIT_MODEL, requestGeminiEdit } from "./gemini"
import {
  PHOTO_EDIT_DAILY,
  PHOTO_EDIT_FAILED,
  PHOTO_EDIT_NEED_PHOTO,
  PHOTO_EDIT_UNAVAILABLE,
  WORD_CHANGE_ALLOWANCE,
  WORD_CHANGE_LOGO,
  WORD_CHANGE_NEED_DETAILS,
  WORD_CHANGE_NEED_PLACE,
  WORD_CHANGE_PAUSED,
} from "./messages"
import { stampProof } from "./proof-watermark"
import { toPrintJpeg } from "./print-jpeg"
import { isLogoPlacement, type LogoPlacement } from "./logo-placement"
import {
  wordChangeAccountDaily,
  wordChangeFreeAllowance,
  wordChangeIsPaid,
  wordChangeLedger,
  wordChangeSiteDaily,
  type WordChangeBlock,
  type WordChangeLedger,
} from "./word-change"
import { wordChangeInstruction } from "./word-change-instruction"

const ALLOWED_HOST = "o1at7qxja3v9ya7m.public.blob.vercel-storage.com"
const MAX_IMAGE = 8_000_000
const MAX_LOGO = 2_000_000

export interface FinishedWordsSuccess {
  ok: true
  afterSrc: string
  editId: string
  /** Unpaid proofs carry a light PROOF mark. */
  proof: boolean
}

export interface FinishedWordsFailure {
  ok: false
  status: number
  message: string
  code: "invalid" | "unavailable" | "failed" | WordChangeBlock
}

export interface FinishedWordsInput {
  userId: string
  templateId: string
  businessName: string
  headline: string
  phone: string
  website?: string
  extra?: string
  placement?: string | null
  logoBase64?: string
  now?: Date
  env?: NodeJS.ProcessEnv
  ledger?: WordChangeLedger
  editor?: FinishedWordsEditor
  loadImage?: (templateId: string) => Promise<Buffer | null>
}

export type FinishedWordsEditor = (input: {
  image: Buffer
  mimeType: "image/jpeg" | "image/png"
  instruction: string
  logo: { bytes: Buffer; mimeType: "image/jpeg" | "image/png" } | null
}) => Promise<Buffer>

let editorForTests: FinishedWordsEditor | null = null
let loaderForTests: ((templateId: string) => Promise<Buffer | null>) | null = null

export function useFinishedWordsEditorForTests(editor: FinishedWordsEditor | null): void {
  editorForTests = editor
}

export function useFinishedImageLoaderForTests(loader: ((templateId: string) => Promise<Buffer | null>) | null): void {
  loaderForTests = loader
}

export async function editFinishedWords(input: FinishedWordsInput): Promise<FinishedWordsSuccess | FinishedWordsFailure> {
  const copy = cleanCopy(input)
  if (!copy) return { ok: false, status: 400, message: WORD_CHANGE_NEED_DETAILS, code: "invalid" }

  const placement = readPlacement(input.placement)
  if (input.placement && !placement) {
    return { ok: false, status: 400, message: WORD_CHANGE_NEED_PLACE, code: "invalid" }
  }

  const photo = finishedGalleryPhoto(input.templateId)
  if (!photo || photo.kind !== "finished") {
    return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO, code: "invalid" }
  }

  const loadImage = input.loadImage ?? loaderForTests ?? loadFinishedPostcard
  let image: Buffer | null
  try {
    image = await loadImage(input.templateId)
  } catch {
    image = null
  }
  if (!image || image.length === 0 || image.length > MAX_IMAGE) {
    return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO, code: "invalid" }
  }
  let mimeType: "image/jpeg" | "image/png"
  try {
    mimeType = mimeOf(image)
  } catch {
    return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO, code: "invalid" }
  }

  const logo = decodeLogo(input.logoBase64)
  if (!logo.ok) return { ok: false, status: 400, message: WORD_CHANGE_LOGO, code: "invalid" }
  if (logo.bytes && !placement) {
    return { ok: false, status: 400, message: WORD_CHANGE_NEED_PLACE, code: "invalid" }
  }
  if (!logo.bytes && placement) {
    return { ok: false, status: 400, message: WORD_CHANGE_LOGO, code: "invalid" }
  }

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
    const instruction = wordChangeInstruction({ ...copy, placement: logo.bytes ? placement : null })
    const edited = editor
      ? await editor({ image, mimeType, instruction, logo: logo.bytes })
      : await requestGeminiEdit({
          image,
          mimeType,
          instruction,
          apiKey: key,
          model: GEMINI_EDIT_MODEL,
          purpose: "lettering",
          logo: logo.bytes ?? undefined,
        })
    const jpeg = await toPrintJpeg(edited)
    const marked = paid ? jpeg : await stampProof(jpeg)
    return {
      ok: true,
      editId: reservation.id,
      proof: !paid,
      afterSrc: `data:image/jpeg;base64,${marked.toString("base64")}`,
    }
  } catch {
    await ledger.release(reservation.id).catch(() => undefined)
    return { ok: false, status: 502, message: PHOTO_EDIT_FAILED, code: "failed" }
  }
}

function block(reason: WordChangeBlock): FinishedWordsFailure {
  if (reason === "allowance") {
    return { ok: false, status: 402, message: WORD_CHANGE_ALLOWANCE, code: "allowance" }
  }
  if (reason === "account-day") {
    return { ok: false, status: 429, message: PHOTO_EDIT_DAILY, code: "account-day" }
  }
  return { ok: false, status: 429, message: WORD_CHANGE_PAUSED, code: "site-day" }
}

function cleanCopy(input: FinishedWordsInput): {
  businessName: string
  headline: string
  phone: string
  website: string
  extra: string
} | null {
  const businessName = clip(input.businessName, 80)
  const headline = clip(input.headline, 120)
  const phone = clip(input.phone, 40)
  const website = clip(input.website ?? "", 120)
  const extra = clip(input.extra ?? "", 80)
  if (businessName.length < 2 || headline.length < 2 || phone.length < 7) return null
  return { businessName, headline, phone, website, extra }
}

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function readPlacement(value: string | null | undefined): LogoPlacement | null {
  if (!value) return null
  return isLogoPlacement(value) ? value : null
}

export async function loadFinishedPostcard(templateId: string, fetchImpl: typeof fetch = fetch): Promise<Buffer | null> {
  const photo = finishedGalleryPhoto(templateId)
  if (!photo || photo.kind !== "finished") return null
  let url: URL
  try {
    url = new URL(photo.src)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST) return null
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 32 || bytes.length > MAX_IMAGE) return null
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
