/**
 * Confirmed working on 2026-11-20.
 * The published price is about $0.039 per image. gemini-3.1-flash-image costs
 * more once the picture is large enough to print, so this stays the editor.
 */
export const GEMINI_EDIT_MODEL = "gemini-2.5-flash-image"

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

export class PhotoEditError extends Error {
  constructor() {
    super("Photo edit failed.")
    this.name = "PhotoEditError"
  }
}

export async function requestGeminiEdit(input: {
  image: Buffer
  mimeType: "image/jpeg" | "image/png"
  instruction: string
  apiKey: string
  model?: string
  fetchImpl?: typeof fetch
  /** "lettering" rewrites words already printed on a finished postcard. */
  purpose?: "scene" | "lettering"
  logo?: { bytes: Buffer; mimeType: "image/jpeg" | "image/png" }
}): Promise<Buffer> {
  const key = input.apiKey.trim()
  if (!key) throw new PhotoEditError()
  const model = input.model ?? GEMINI_EDIT_MODEL
  const fetchImpl = input.fetchImpl ?? fetch
  const parts: Array<Record<string, unknown>> = [
    { text: editText(input.purpose ?? "scene", input.instruction) },
    { inlineData: { mimeType: input.mimeType, data: input.image.toString("base64") } },
  ]
  if (input.logo) {
    parts.push({ inlineData: { mimeType: input.logo.mimeType, data: input.logo.bytes.toString("base64") } })
  }
  const response = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new PhotoEditError()
  const payload = (await response.json()) as unknown
  const bytes = imageFromResponse(payload)
  if (!bytes) throw new PhotoEditError()
  return bytes
}

function editText(purpose: "scene" | "lettering", instruction: string): string {
  if (purpose === "lettering") {
    return `Rewrite only the words already printed on this finished postcard. Keep the design, colors, photographs, and layout. Do not add a watermark.\n\n${instruction}`
  }
  return `Edit this photograph as requested. Keep the same scene unless the request changes it. Do not add words, letters, logos, or watermarks.\n\nRequest: ${instruction}`
}

function imageFromResponse(payload: unknown): Buffer | null {
  if (!payload || typeof payload !== "object") return null
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return null
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    const content = (candidate as { content?: { parts?: unknown } }).content
    const parts = content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (!part || typeof part !== "object") continue
      const record = part as {
        inlineData?: { data?: unknown }
        inline_data?: { data?: unknown }
      }
      const data = record.inlineData?.data ?? record.inline_data?.data
      if (typeof data === "string" && data.length > 0) return Buffer.from(data, "base64")
    }
  }
  return null
}
