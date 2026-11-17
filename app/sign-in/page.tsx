import Link from "next/link"

import { googleAction, signInAction } from "@/lib/auth/actions"
import { AuthScreen, authFieldClass } from "@/components/auth/AuthScreen"

export const dynamic = "force-dynamic"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const params = await searchParams
  const google = Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim())
  return (
    <AuthScreen eyebrow="Modern Mail" title="Sign in" notice={params.notice} error={params.error}>
      <form action={signInAction} className="space-y-3">
        <input name="email" type="email" required placeholder="Email" className={authFieldClass()} />
        <input name="password" type="password" required placeholder="Password" className={authFieldClass()} />
        <button type="submit" className="min-h-12 w-full rounded-xl bg-[#5ce1ff] text-sm font-medium text-[#041018]">
          Sign in
        </button>
      </form>
      {google ? (
        <form action={googleAction}>
          <button type="submit" className="min-h-12 w-full rounded-xl border border-[#245068] text-sm">
            Continue with Google
          </button>
        </form>
      ) : null}
      <p className="text-sm text-[#8aa0b4]">
        <Link href="/sign-up" className="underline">Create an account</Link>
        {" · "}
        <Link href="/reset" className="underline">Forgot password</Link>
      </p>
    </AuthScreen>
  )
}
