import { AuthScreen } from "@/components/auth/AuthScreen"
import { verifyAction } from "@/lib/auth/actions"

export const dynamic = "force-dynamic"

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  return (
    <AuthScreen eyebrow="Modern Mail" title="Verify email">
      <form action={verifyAction} className="space-y-3">
        <input name="token" type="hidden" defaultValue={params.token ?? ""} />
        <button type="submit" className="min-h-12 w-full rounded-xl bg-[#5ce1ff] text-sm font-medium text-[#041018]">
          Verify this email
        </button>
      </form>
      <p className="text-sm text-[#8aa0b4]">The link works once.</p>
    </AuthScreen>
  )
}
