import { randomBytes } from "node:crypto"
import { link, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import type { FollowUpProposal } from "./proposal"

export interface FollowUpStore {
  save(proposal: FollowUpProposal): Promise<{ proposal: FollowUpProposal; created: boolean }>
  markApproved(proposal: FollowUpProposal): Promise<FollowUpProposal>
  get(id: string): Promise<FollowUpProposal | null>
  latest(ownerId: string, campaignId: string): Promise<FollowUpProposal | null>
}

export function createFileFollowUpStore(directory: string): FollowUpStore {
  const fileFor = (id: string) => path.join(directory, `proposal-${id}.json`)
  return {
    async save(proposal) {
      await mkdir(directory, { recursive: true })
      const dest = fileFor(proposal.id)
      const existing = await readJson<FollowUpProposal>(dest)
      if (existing) {
        if (existing.ownerId !== proposal.ownerId) {
          throw new Error("That proposal belongs to another account.")
        }
        return { proposal: existing, created: false }
      }
      const temp = path.join(directory, `.tmp-${proposal.id}-${randomBytes(4).toString("hex")}`)
      await writeFile(temp, JSON.stringify(proposal), "utf-8")
      try {
        await link(temp, dest)
        return { proposal, created: true }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        const winner = await readJson<FollowUpProposal>(dest)
        if (!winner || winner.ownerId !== proposal.ownerId) throw new Error("That proposal belongs to another account.")
        return { proposal: winner, created: false }
      } finally {
        await unlink(temp).catch(() => undefined)
      }
    },
    async markApproved(proposal: FollowUpProposal): Promise<FollowUpProposal> {
      const existing = await readJson<FollowUpProposal>(fileFor(proposal.id))
      if (!existing || existing.ownerId !== proposal.ownerId) {
        throw new Error("That proposal belongs to another account.")
      }
      const next: FollowUpProposal = { ...existing, status: "approved", approvedAt: new Date().toISOString() }
      await writeFile(fileFor(proposal.id), JSON.stringify(next), "utf-8")
      return next
    },
    async get(id) {
      return readJson<FollowUpProposal>(fileFor(id))
    },
    async latest(ownerId, campaignId) {
      let names: string[] = []
      try {
        names = await readdir(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
      const found: FollowUpProposal[] = []
      for (const name of names) {
        if (!name.startsWith("proposal-")) continue
        const proposal = await readJson<FollowUpProposal>(path.join(directory, name))
        if (proposal && proposal.ownerId === ownerId && proposal.campaignId === campaignId) found.push(proposal)
      }
      found.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return found[0] ?? null
    },
  }
}

let singleton: FollowUpStore | null = null

export function getFollowUpStore(): FollowUpStore {
  if (!singleton) singleton = createFileFollowUpStore(path.join(process.cwd(), ".data", "follow-up"))
  return singleton
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}
