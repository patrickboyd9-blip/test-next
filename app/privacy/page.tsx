import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Privacy · Modern Mail" }

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 bg-[#070b14] px-4 py-12 text-[#e7f2fb] sm:px-6">
      <h1 className="text-3xl font-semibold">Privacy</h1>
      <p className="text-sm leading-6 text-[#b7c9d8]">The address list is the one you upload. Modern Mail uses it to print and mail the piece you approved. It is not sold.</p>
      <p className="text-sm leading-6 text-[#b7c9d8]">Sign in and open Help if you need a copy of what we hold, or if you want it deleted.</p>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm underline">Back</Link>
    </main>
  )
}
