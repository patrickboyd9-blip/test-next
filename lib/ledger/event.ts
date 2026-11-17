import { createHash } from "node:crypto"
import { link, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

export type LedgerOutcome = "completed" | "failed" | "unknown"

export interface LedgerEvent {
  id: string
  ownerId: string
  campaignId: string
  type:
    | "guidance_saved"
    | "job_frame_saved"
    | "list_reviewed"
    | "checkout_opened"
    | "checkout_blocked"
    | "payment_recorded"
    | "mail_refused"
    | "proposal_previewed"
    | "proposal_approved"
  outcome: LedgerOutcome
  occurredAt: string
  versionKey: string
  creativeVersion: string | null
  listHash: string | null
  listCount: number | null
  /** Null means the amount is unknown. It is never stored as zero to fill a gap. */
  amountCents: number | null
  note: string
}

export function ledgerEventId(ownerId: string, campaignId: string, type: string, versionKey: string): string {
  return createHash("sha256").update([ownerId, campaignId, type, versionKey].join("\n")).digest("hex").slice(0, 32)
}

export interface LedgerStore {
  record(event: LedgerEvent): Promise<{ event: LedgerEvent; created: boolean }>
  list(ownerId: string, campaignId: string): Promise<LedgerEvent[]>
}

export function createFileLedgerStore(directory: string): LedgerStore {
  const fileFor = (id: string) => path.join(directory, `event-${id}.json`)
  return {
    async record(event) {
      await mkdir(directory, { recursive: true })
      const dest = fileFor(event.id)
      const existing = await readJson<LedgerEvent>(dest)
      if (existing) return { event: existing, created: false }
      const temp = path.join(directory, `.tmp-${event.id}`)
      await writeFile(temp, JSON.stringify(event), "utf-8")
      try {
        await link(temp, dest)
        return { event, created: true }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        const winner = await readJson<LedgerEvent>(dest)
        if (!winner) throw new Error("The earlier event could not be read.")
        return { event: winner, created: false }
      } finally {
        await unlink(temp).catch(() => undefined)
      }
    },
    async list(ownerId, campaignId) {
      let names: string[] = []
      try {
        names = await readdir(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
        throw error
      }
      const events: LedgerEvent[] = []
      for (const name of names) {
        if (!name.startsWith("event-") || !name.endsWith(".json")) continue
        const event = await readJson<LedgerEvent>(path.join(directory, name))
        if (!event || event.ownerId !== ownerId || event.campaignId !== campaignId) continue
        events.push(event)
      }
      return events.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1))
    },
  }
}

export function defaultLedgerDirectory(): string {
  return path.join(process.cwd(), ".data", "ledger")
}

let singleton: LedgerStore | null = null

export function getLedgerStore(): LedgerStore {
  if (!singleton) singleton = createFileLedgerStore(defaultLedgerDirectory())
  return singleton
}

export function paidAmount(events: readonly LedgerEvent[]): number | null {
  const paid = events.filter((event) => event.type === "payment_recorded" && event.outcome === "completed")
  if (paid.length === 0) return null
  return paid[paid.length - 1]?.amountCents ?? null
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}
