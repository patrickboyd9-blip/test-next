import { readFileSync } from "node:fs"

import { REVIEWED_SOURCES } from "./sources"

/** The reviewed markdown already in this repo. Not a new download. */
export function readLibraryFiles(): Record<string, string> {
  const paths = [...new Set(REVIEWED_SOURCES.map((source) => source.file))]
  return Object.fromEntries(paths.map((file) => [file, readFileSync(file, "utf8")]))
}
