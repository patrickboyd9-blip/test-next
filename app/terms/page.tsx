import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Terms · Modern Mail" }

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 bg-[#070b14] px-4 py-12 text-[#e7f2fb] sm:px-6">
      <h1 className="text-3xl font-semibold">Terms</h1>
      <p className="text-sm leading-6 text-[#b7c9d8]">Nothing is printed or mailed until you approve the proof and the full price. The full price covers printing, postage, and the list. It is not postage by itself.</p>
      <p className="text-sm leading-6 text-[#b7c9d8]">You are responsible for the list you upload and for the words on the card.</p>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm underline">Back</Link>
    </main>
  )
}
