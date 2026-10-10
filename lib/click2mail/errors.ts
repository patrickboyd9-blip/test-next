export class Click2MailError extends Error {
  readonly httpStatus: number | null
  readonly resultCode: number | null
  readonly resultDescription: string

  constructor(
    message: string,
    details: {
      httpStatus?: number | null
      resultCode?: number | null
      resultDescription?: string
    } = {}
  ) {
    super(message)
    this.name = "Click2MailError"
    this.httpStatus = details.httpStatus ?? null
    this.resultCode = details.resultCode ?? null
    this.resultDescription = details.resultDescription ?? ""
  }
}

/** Remove account secrets if a vendor body echoes them. */
export function redactSecrets(text: string, secrets: readonly string[]): string {
  let next = text
  for (const secret of secrets) {
    const trimmed = secret.trim()
    if (trimmed.length < 4) continue
    next = next.split(secret).join("[redacted]")
    if (trimmed !== secret) next = next.split(trimmed).join("[redacted]")
  }
  return next
}
