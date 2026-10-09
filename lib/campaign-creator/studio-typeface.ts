/**
 * Postcard type pairing.
 *
 * Display is Archivo (a heavy grotesque), loaded with next/font so the
 * preview file is self-hosted. Text is Source Sans 3, which stays readable
 * at postcard sizes. If either file is missing, the stack falls through to
 * Helvetica / Arial — never a serif.
 *
 * The 5×8 print-spec PDF is still a geometry proof. Its labels use the
 * standard PDF faces below, which render in every reader without embedding.
 * Browser print of the Studio card uses the self-hosted files.
 */

/**
 * next/font sets these on <html>. `@theme inline` does not emit
 * `--font-display` / `--font-studio` as runtime variables, so an inline
 * `var(--font-display)` is dropped and the card inherits the page sans.
 */
export const STUDIO_DISPLAY_CSS =
  'var(--font-display-family), "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif'

export const STUDIO_TEXT_CSS =
  'var(--font-studio-family), "Helvetica Neue", Helvetica, Arial, sans-serif'

/** Built-in PDF faces. No embedding, no serif, present in every print export. */
export const PRINT_DISPLAY_BASE_FONT = "Helvetica-Bold"
export const PRINT_TEXT_BASE_FONT = "Helvetica"
