import type { ImageEditProvider, ImageEditRequest, ImageEditResult } from "./types"

/**
 * Photo edits stay behind this boundary.
 * Paid calls stay off until Patrick approves a spend. The mock is the only
 * provider that runs today.
 */
export function getImageEditProvider(env: NodeJS.ProcessEnv = process.env): ImageEditProvider {
  if (env.IMAGE_EDIT_ALLOW_PAID === "true") {
    return {
      id: "mock",
      async edit(request): Promise<ImageEditResult> {
        return refused(request, "Paid photo edits are not approved yet. Nothing was charged.")
      },
    }
  }
  return mockImageEditProvider
}

export const mockImageEditProvider: ImageEditProvider = {
  id: "mock",
  async edit(request) {
    return {
      status: "not-run",
      message: photoHoldMessage(),
      estimatedCents: 4,
      imageRef: request.imageRef,
    }
  },
}

function refused(request: ImageEditRequest, message: string): ImageEditResult {
  return { status: "not-run", message, estimatedCents: 0, imageRef: request.imageRef }
}

function photoHoldMessage(): string {
  return "That change is a photo edit. It is prepared and was not run, so nothing was charged. Words stay on their own layer so the print stays sharp."
}
