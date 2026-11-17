import { AuthScreen, authFieldClass } from "@/components/auth/AuthScreen"
import { resetPasswordAction, resetRequestAction } from "@/lib/auth/actions"

export const dynamic = "force-dynamic"

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; notice?: string; error?: string }>
}) {
  const params = await searchParams
  return (
    <AuthScreen eyebrow="Modern Mail" title="Reset password" notice={params.notice} error={params.error}>
      {params.token ? (
        <form action={resetPasswordAction} className="space-y-3">
          <input name="token" type="hidden" defaultValue={params.token} />
          <input name="password" type="password" required minLength={10} placeholder="New password" className={authFieldClass()} />
          <button type="submit" className="min-h-12 w-full rounded-xl bg-[#5ce1ff] text-sm font-medium text-[#041018]">
            Save password
          </button>
        </form>
      ) : (
        <form action={resetRequestAction} className="space-y-3">
          <input name="email" type="email" required placeholder="Email" className={authFieldClass()} />
          <button type="submit" className="min-h-12 w-full rounded-xl bg-[#5ce1ff] text-sm font-medium text-[#041018]">
            Send reset link
          </button>
        </form>
      )}
    </AuthScreen>
  )
}
