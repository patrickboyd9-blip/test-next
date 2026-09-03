import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const requireFromHere = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Runtime CJS load. The specifier is base64 so Turbopack/webpack cannot
 * constant-fold it and pull `@anthropic-ai/sdk` into the compile of `/`.
 */
export function requireDecodedPackage(b64: string): unknown {
  return requireFromHere(Buffer.from(b64, "base64").toString("utf8"))
}

/** Same idea for local engine files next to this module. */
export function requireDecodedLocal(b64: string): unknown {
  const name = Buffer.from(b64, "base64").toString("utf8")
  return requireFromHere(path.join(here, name))
}
