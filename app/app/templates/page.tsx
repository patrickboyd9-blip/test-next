import { GalleryBoard } from "@/components/mail-gallery/GalleryBoard"
import { SidebarTrigger } from "@/components/ui/sidebar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default function GalleryPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">Gallery</span>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            You have two options. Pick a photo and edit it yourself, or pick a photo and have us design the mailer for you. Nothing is mailed from this page.
          </p>
        </div>
        <GalleryBoard />
      </main>
    </div>
  )
}
