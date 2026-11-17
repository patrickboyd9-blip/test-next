/** Largest file the postcard proof will hold in the browser. */
export const DESIGN_PREVIEW_BYTE_LIMIT = 8 * 1024 * 1024

export type DesignPreviewMedia = "image/png" | "image/jpeg" | "application/pdf"

export type DesignPreviewResult =
  | { ok: true; mediaType: DesignPreviewMedia }
  | { ok: false; error: string }

/**
 * Decide whether an uploaded postcard file can be shown.
 * Bytes are sniffed. A renamed text file is not treated as a picture.
 * Nothing here is stored.
 */
export function classifyDesignUpload(bytes: Uint8Array): DesignPreviewResult {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "That file is empty. Choose a PNG, JPG, or PDF." }
  }
  if (bytes.byteLength > DESIGN_PREVIEW_BYTE_LIMIT) {
    return {
      ok: false,
      error: "That file is over 8 MB. Choose a smaller PNG, JPG, or PDF. It was not uploaded.",
    }
  }
  if (isPdf(bytes)) return { ok: true, mediaType: "application/pdf" }
  if (isPng(bytes)) return { ok: true, mediaType: "image/png" }
  if (isJpeg(bytes)) return { ok: true, mediaType: "image/jpeg" }
  return {
    ok: false,
    error: "Save this as a PNG, JPG, or PDF. Other files can't be shown on the proof.",
  }
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}
