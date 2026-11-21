import Link from "next/link"

import { PluginGuide } from "@/components/plugins/PluginGuide"
import { SidebarTrigger } from "@/components/ui/sidebar"

export const dynamic = "force-dynamic"

export default function PluginGuidePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">Help</span>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">How to use our plugins</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Design the postcard in your usual app, then send the front and the back into a campaign. Each plugin is coming soon. There is nothing to install yet.
          </p>
        </div>
        <PluginGuide />
        <Link href="/app/help" className="text-sm underline">
          Back to Help
        </Link>
      </main>
    </div>
  )
}
