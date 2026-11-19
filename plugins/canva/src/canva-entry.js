/**
 * Glue for a Canva starter app. The Canva CLI provides `@canva/design`.
 * Call startModernMail(sizes) with the sizes from plugins/canva/spec.js.
 */
import { addPage, getCurrentPageContext, openDesign, requestExport } from "@canva/design"

import { createHost } from "./host.js"

export function startModernMail(sizes) {
  return createHost({ addPage, getCurrentPageContext, openDesign, requestExport }, sizes)
}
