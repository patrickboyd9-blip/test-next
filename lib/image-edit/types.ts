import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"

/** A layer Comet can move. Text is never painted into the photograph. */
export interface ProofLayer {
  id: string
  face: "front" | "back"
  kind: "image" | "text"
  /** Percents of the artwork canvas, origin at the top left. */
  x: number
  y: number
  w: number
  h: number
  z: number
  src?: string
  name?: string
  text?: string
  color?: string
}

export type ProofFace = ProofLayer["face"]

export interface ImageEditRequest {
  instruction: string
  face: ProofFace
  size: PostcardSizeId
  /** The photograph being edited. Live providers would send this. The mock does not. */
  imageRef?: string
}

export interface ImageEditResult {
  /** `edited` only after an approved paid call. The mock never returns it. */
  status: "not-run" | "edited"
  /** Shown to the customer. No vendor, model, or price. */
  message: string
  imageRef?: string
  /** Internal estimate in cents. Not shown in the product. */
  estimatedCents: number
}

export interface ImageEditProvider {
  readonly id: "mock" | "google" | "openai" | "flux" | "qwen" | "seedream"
  edit(request: ImageEditRequest): Promise<ImageEditResult>
}
