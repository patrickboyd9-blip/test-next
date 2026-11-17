/**
 * Verification and password reset. When RESEND_API_KEY is missing, sign-up
 * still succeeds and the caller shows a verify-later notice.
 */
export async function sendAuthMail(
  input: { to: string; subject: string; text: string },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<{ sent: boolean; notice: string }> {
  const key = env.RESEND_API_KEY?.trim()
  if (!key) {
    console.warn("RESEND_API_KEY is not set. The account email was not sent.")
    return { sent: false, notice: "You can verify later. Email is not configured yet." }
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.AUTH_EMAIL_FROM?.trim() || "Modern Mail <mail@modernmail.example>",
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    })
    if (!res.ok) {
      console.warn("The account email was not accepted. Sign-up continues.")
      return { sent: false, notice: "You can verify later. The email did not send." }
    }
  } catch (error) {
    console.warn("The account email failed.", error instanceof Error ? error.message : "")
    return { sent: false, notice: "You can verify later. The email did not send." }
  }
  return { sent: true, notice: "Check your email." }
}
