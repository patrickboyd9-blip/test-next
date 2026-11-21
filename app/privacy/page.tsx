import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Privacy · Modern Mail" }

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 bg-[#070b14] px-4 py-12 text-[#e7f2fb] sm:px-6">
      <h1 className="text-3xl font-semibold">Privacy</h1>
      <p className="w-fit rounded-full border border-[#f0a202] px-3 py-1 text-xs font-medium text-[#f6d48a]">Draft. This wording is not final.</p>
      <p className="text-sm leading-6 text-[#b7c9d8]">The address list is the one you upload. Modern Mail uses it to print and mail the piece you approved. It is not sold.</p>
      <p className="text-sm leading-6 text-[#b7c9d8]">DRAFT. A hashed phone, a hashed email, an IP address, and the page cookie are kept for 24 months, then deleted. The consent record is kept for 5 years. An opt-out stays on file so that person is left off follow-up lists.</p>
      <p className="text-sm leading-6 text-[#b7c9d8]">Sign in and open Help if you need a copy of what we hold, or if you want it deleted.</p>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm underline">Back</Link>
    </main>
  )
}
