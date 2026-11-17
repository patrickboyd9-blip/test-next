import { DesignRequestList } from "@/components/design-requests/DesignRequestList"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSession } from "@/lib/auth/session"
import { listDesignRequests } from "@/lib/design-requests/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function DesignRequestsPage() {
  const session = await getSession()
  if (!session) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Design requests are not listed until an account is signed in.
        </p>
      </div>
    )
  }
  const requests = await listDesignRequests()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">Design requests</span>
      </header>
      <DesignRequestList requests={requests} />
    </div>
  )
}
