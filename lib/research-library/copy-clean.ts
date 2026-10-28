import { copyRejectPattern } from "./industry"

const COPY_REJECT = new RegExp(copyRejectPattern(), "i")
const PHOTO_SENTENCE = /owner[-\s]?labeled|\b(?:back|front) of\b|\bphotographs?\b|\bphotos?\b|\bimages?\b|upside down|\bupright\b|\brotated\b|(?:^|\s)channel\s*:|surrounding surface|\b(?:left|right|top|bottom)\s+edge\b/i

function isPhotoNote(line: string): boolean {
  if (/\b(?:left|right|top|bottom|outer|inner)\s+edge\b/i.test(line)) return true
  if (/\bmeets the (?:photo )?frame\b/i.test(line)) return true
  if (/\b(?:photo|picture|image)\s+frame\b/i.test(line)) return true
  if (/\b(?:photos?|photographs?|cameras?|cropped?|glare|scans?|scanned|lighting)\b/i.test(line)) return true
  if (/\b(?:on|in) (?:the )?(?:table|hand)\b/i.test(line) && /\b(?:piece|card|mailer|printed|photo)\b/i.test(line)) return true
  return false
}

function isJunkCopy(line: string): boolean {
  const text = line.replace(/\s+/g, " ").trim()
  if (!text) return true
  if (PHOTO_SENTENCE.test(text)) return true
  if (/\bvisible\b/i.test(text) && /\b(?:above|below|left|right|edge|frame|surface|corner)\b/i.test(text)) return true
  if (/\bframe\b/i.test(text) && /\b(?:visible|edge|meets|piece|photo|surface)\b/i.test(text)) return true
  if (COPY_REJECT.test(text) || isPhotoNote(text)) return true
  if (/\b[a-z]+_[a-z0-9_]+\b/.test(text) && (text.match(/\b[a-z]+_[a-z0-9_]+\b/g) || []).length >= 2) return true
  if (/^[A-Za-z][\w .&/-]{0,40}:\s+\S/.test(text) && !/[$%]|\bfree\b|\d/i.test(text)) return true
  return false
}

/**
 * Drops photo, camera, and metadata sentences from any field that can reach generation.
 * A real price before the photo note is kept.
 */
export function sanitizeCustomerCopy(value: string | undefined): string {
  const text = value?.replace(/\s+/g, " ").trim() ?? ""
  if (!text) return ""
  const kept: string[] = []
  for (const sentence of text.split(/(?<=[.!])\s+/)) {
    if (isJunkCopy(sentence)) continue
    const cutAt = sentence.search(PHOTO_SENTENCE)
    const head = (cutAt >= 0 ? sentence.slice(0, cutAt) : sentence).replace(/[\s,;:–—-]+$/, "").trim()
    if (head.length < 8 || isJunkCopy(head)) continue
    kept.push(head)
  }
  return kept.join(" ").trim()
}
