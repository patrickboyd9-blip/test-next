import { DesignRequestList } from "@/components/design-requests/DesignRequestList"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { listDesignRequests } from "@/lib/design-requests/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function DesignRequestsPage() {
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
