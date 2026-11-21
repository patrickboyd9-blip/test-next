import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { homePrice, homeSamples } from "@/lib/marketing/home"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Modern Mail",
  description: "Tell Comet your goal, approve the proof, and we print and mail the postcard. Nothing is mailed until you approve.",
  openGraph: {
    title: "Modern Mail",
    description: "Tell Comet your goal, approve the proof, and we print and mail the postcard. Nothing is mailed until you approve.",
    images: [{ url: "/gallery/roofing-after-the-storm.jpg", alt: "A sample roofing postcard from the Gallery" }],
  },
}

const steps = [
  { title: "Tell Comet your goal", body: "Say who you want to reach and what the card should do." },
  { title: "Approve the proof", body: "You see the postcard and the full price before anything is printed." },
  { title: "We print and mail", body: "After you approve, the piece is printed and sent. Not before." },
]

const questions = [
  { q: "What sizes can I send?", a: "Postcards in 5×8 and 6×9." },
  { q: "Will anything mail on its own?", a: "No. Nothing is mailed until you approve the proof." },
  { q: "Where do the addresses come from?", a: "You upload the list." },
]

export default async function Home() {
  const session = await getSession()
  if (session && !session.fixture) redirect("/app")
  const price = homePrice()
  const samples = homeSamples()
  const hero = samples[0]
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Modern Mail",
        url: "/",
        description: "Physical postcards. You approve the proof, then we print and mail.",
      },
      {
        "@type": "SoftwareApplication",
        name: "Modern Mail",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Create a postcard with Comet, approve the proof, and have it printed and mailed.",
      },
    ],
  }

  return (
    <div className="min-h-full bg-[#070b14] text-[#e7f2fb]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(1px 1px at 12% 18%, rgba(226,244,255,0.7), transparent 60%), radial-gradient(1px 1px at 28% 42%, rgba(226,244,255,0.45), transparent 60%), radial-gradient(1.5px 1.5px at 70% 22%, rgba(226,244,255,0.55), transparent 60%), radial-gradient(1px 1px at 84% 60%, rgba(226,244,255,0.4), transparent 60%)" }} />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Modern Mail</p>
        <Link href="/sign-in" className="inline-flex min-h-11 items-center text-sm text-[#b7c9d8] underline">
          Sign in
        </Link>
      </header>
      <main className="relative mx-auto flex max-w-5xl flex-col gap-16 px-4 pb-20 sm:px-6">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl">Physical mail, from one place.</h1>
            <p className="mt-4 max-w-xl text-lg text-[#b7c9d8]">Tell Comet your goal. Approve the proof. We print it and mail it.</p>
            <Link href="/sign-up" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-[#5ce1ff] px-5 text-base font-semibold text-[#041018]">
              Get Started
            </Link>
          </div>
          {hero ? (
            <figure className="overflow-hidden rounded-2xl border border-[#1c3d52] bg-[#0c1424] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <Image src={hero.src} alt={hero.name} width={1200} height={750} className="aspect-[8/5] h-auto w-full object-cover" priority />
            </figure>
          ) : null}
        </section>

        <section aria-labelledby="how">
          <h2 id="how" className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[#1c3d52] bg-[#0c1424]/80 p-4">
                <p className="text-sm text-[#8aa0b4]">{index + 1}</p>
                <h3 className="mt-1 text-lg font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#b7c9d8]">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="samples">
          <h2 id="samples" className="text-2xl font-semibold">Sample designs</h2>
          <p className="mt-2 text-sm text-[#8aa0b4]">From the Gallery. You replace the words with your own.</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {samples.map((sample) => (
              <li key={sample.id} className="overflow-hidden rounded-xl border border-[#1c3d52] bg-[#0c1424]">
                <Image src={sample.src} alt="" width={800} height={500} className="aspect-[8/5] h-auto w-full object-cover" />
                <p className="px-3 py-2 text-sm">{sample.name}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pricing">
          <h2 id="pricing" className="text-2xl font-semibold">Pricing</h2>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{price.amount}</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#b7c9d8]">{price.note}</p>
        </section>

        <section aria-labelledby="assistants">
          <h2 id="assistants" className="text-2xl font-semibold">Works with your AI assistant</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b7c9d8]">
            Connect Claude or ChatGPT through MCP at <span className="text-[#e7f2fb]">/api/mcp</span>. The assistant can help you start a mailer. You still approve the proof and the full price in Modern Mail.
          </p>
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-semibold">Questions</h2>
          <dl className="mt-4 space-y-4">
            {questions.map((item) => (
              <div key={item.q}>
                <dt className="font-medium">{item.q}</dt>
                <dd className="mt-1 text-sm text-[#b7c9d8]">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <footer className="relative border-t border-[#1c3d52] px-4 py-6 text-sm text-[#8aa0b4] sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline">Privacy</Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center underline">Terms</Link>
          <Link href="/sign-in" className="inline-flex min-h-11 items-center underline">Contact</Link>
        </div>
      </footer>
    </div>
  )
}
