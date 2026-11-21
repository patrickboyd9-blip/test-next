import { readFile } from "fs/promises"
import path from "path"

import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { readRasterSize } from "@/lib/print-spec/raster"

import { GEMINI_EDIT_MODEL, requestGeminiEdit } from "./gemini"
import {
  PHOTO_EDIT_DAILY,
  PHOTO_EDIT_FAILED,
  PHOTO_EDIT_NEED_PHOTO,
  PHOTO_EDIT_NEED_WORDS,
  PHOTO_EDIT_PAUSED,
  PHOTO_EDIT_TOO_LARGE,
  PHOTO_EDIT_UNAVAILABLE,
} from "./messages"
import { toPrintJpeg } from "./print-jpeg"
import {
  PHOTO_EDIT_CENTS,
  dailyEditLimit,
  monthlyCapCents,
  photoEditLedger,
  type PhotoEditLedger,
} from "./spend"

const MAX_DECODED = 8_000_000
const MAX_INSTRUCTION = 400

export interface PhotoEditSuccess {
  ok: true
  afterSrc: string
  editId: string
}

export interface PhotoEditFailure {
  ok: false
  status: number
  message: string
}

type PhotoEditor = (image: Buffer, mimeType: "image/jpeg" | "image/png", instruction: string) => Promise<Buffer>

let editorForTests: PhotoEditor | null = null

export function usePhotoEditorForTests(editor: PhotoEditor | null): void {
  editorForTests = editor
}

export async function editCustomerPhoto(input: {
  userId: string
  templateId?: string
  imageBase64?: string
  instruction: string
  now?: Date
  env?: NodeJS.ProcessEnv
  ledger?: PhotoEditLedger
  editor?: PhotoEditor
}): Promise<PhotoEditSuccess | PhotoEditFailure> {
  const instruction = input.instruction.trim().slice(0, MAX_INSTRUCTION)
  if (instruction.length < 2) return { ok: false, status: 400, message: PHOTO_EDIT_NEED_WORDS }
  const loaded = await loadPhotoSource(input)
  if (!loaded.ok) return loaded

  const env = input.env ?? process.env
  const editor = input.editor ?? editorForTests
  const key = env.GEMINI_API_KEY?.trim() ?? ""
  if (!editor && !key) return { ok: false, status: 503, message: PHOTO_EDIT_UNAVAILABLE }

  const ledger = input.ledger ?? photoEditLedger()
  let reservation: Awaited<ReturnType<PhotoEditLedger["reserve"]>>
  try {
    reservation = await ledger.reserve({
      userId: input.userId,
      cents: PHOTO_EDIT_CENTS,
      now: input.now ?? new Date(),
      capCents: monthlyCapCents(env),
      dailyLimit: dailyEditLimit(env),
    })
  } catch {
    return { ok: false, status: 503, message: PHOTO_EDIT_UNAVAILABLE }
  }
  if (!reservation.ok) {
    return {
      ok: false,
      status: 429,
      message: reservation.reason === "month" ? PHOTO_EDIT_PAUSED : PHOTO_EDIT_DAILY,
    }
  }

  try {
    const edited = editor
      ? await editor(loaded.bytes, loaded.mimeType, instruction)
      : await requestGeminiEdit({
          image: loaded.bytes,
          mimeType: loaded.mimeType,
          instruction,
          apiKey: key,
          model: GEMINI_EDIT_MODEL,
        })
    const jpeg = await toPrintJpeg(edited)
    return {
      ok: true,
      editId: reservation.id,
      afterSrc: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    }
  } catch {
    await ledger.release(reservation.id).catch(() => undefined)
    return { ok: false, status: 502, message: PHOTO_EDIT_FAILED }
  }
}

async function loadPhotoSource(input: {
  templateId?: string
  imageBase64?: string
}): Promise<{ ok: true; bytes: Buffer; mimeType: "image/jpeg" | "image/png" } | PhotoEditFailure> {
  if (input.templateId) {
    const src = galleryPhotoSrc(input.templateId)
    if (!src || !src.startsWith("/gallery/") || src.includes("..")) {
      return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO }
    }
    const filePath = path.join(process.cwd(), "public", src)
    try {
      const bytes = await readFile(filePath)
      return { ok: true, bytes, mimeType: mimeOf(bytes) }
    } catch {
      return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO }
    }
  }

  if (!input.imageBase64) return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO }
  const base64 = input.imageBase64.includes(",")
    ? input.imageBase64.slice(input.imageBase64.indexOf(",") + 1)
    : input.imageBase64
  if (base64.length > 12_000_000) return { ok: false, status: 400, message: PHOTO_EDIT_TOO_LARGE }
  const bytes = Buffer.from(base64, "base64")
  if (bytes.length === 0 || bytes.length > MAX_DECODED) {
    return { ok: false, status: 400, message: PHOTO_EDIT_TOO_LARGE }
  }
  try {
    return { ok: true, bytes, mimeType: mimeOf(bytes) }
  } catch {
    return { ok: false, status: 400, message: PHOTO_EDIT_NEED_PHOTO }
  }
}

function mimeOf(bytes: Buffer): "image/jpeg" | "image/png" {
  const size = readRasterSize(bytes)
  return size.kind === "jpeg" ? "image/jpeg" : "image/png"
}
