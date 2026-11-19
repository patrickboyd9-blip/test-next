import { readFileSync } from "node:fs"
import path from "node:path"

import { REVIEWED_SOURCES } from "./sources"

/**
 * The reviewed markdown already in this repo. Not a new download.
 * A missing file is an empty note. The campaign editor still opens.
 */
export function readLibraryFiles(
  read: (file: string) => string = readReviewedFile
): Record<string, string> {
  const paths = [...new Set(REVIEWED_SOURCES.map((source) => source.file))]
  return Object.fromEntries(
    paths.map((file) => {
      try {
        return [file, read(file)]
      } catch {
        return [file, ""]
      }
    })
  )
}

const LIBRARY_DIR = "lib/design-intelligence/ad-psych"

function readReviewedFile(file: string): string {
  const name = path.basename(file)
  if (file !== `${LIBRARY_DIR}/${name}` || name.includes("..")) {
    throw new Error("Reviewed note is outside the library folder.")
  }
  return readFileSync(path.join(process.cwd(), LIBRARY_DIR, name), "utf8")
}
