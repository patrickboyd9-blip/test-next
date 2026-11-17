import Link from "next/link"

import { AuthScreen, authFieldClass } from "@/components/auth/AuthScreen"
import { signUpAction } from "@/lib/auth/actions"

export const dynamic = "force-dynamic"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const params = await searchParams
  return (
    <AuthScreen eyebrow="Modern Mail" title="Create an account" notice={params.notice} error={params.error}>
      <form action={signUpAction} className="space-y-3">
        <input name="name" placeholder="Your name" className={authFieldClass()} />
        <input name="business" placeholder="Business name" className={authFieldClass()} />
        <input name="email" type="email" required placeholder="Email" className={authFieldClass()} />
        <input name="password" type="password" required minLength={10} placeholder="Password, at least 10 characters" className={authFieldClass()} />
        <button type="submit" className="min-h-12 w-full rounded-xl bg-[#5ce1ff] text-sm font-medium text-[#041018]">
          Create account
        </button>
      </form>
      <p className="text-sm text-[#8aa0b4]">
        <Link href="/sign-in" className="underline">Already have an account</Link>
      </p>
    </AuthScreen>
  )
}
