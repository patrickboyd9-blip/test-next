import { GalleryIndex } from "@/components/mail-gallery/GalleryIndex"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default function GalleryPage() {
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {"A short, hand-picked set of mailers you can be proud to send. Pick a photo, then make it yours. More industries are on the way."}
        </p>
        <h2 className="text-sm font-medium">How It Works</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          You have two options. Pick a photo and edit it yourself, or pick a photo and have us design the mailer for you. Nothing is mailed from this page.
        </p>
      </div>
      <GalleryIndex />
    </>
  )
}
