import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

/**
 * Public help notes only. This module does not read the taste pack,
 * the research library, or generator rules.
 */

export interface KnowledgeChunk {
  id: string
  title: string
  text: string
}

const KNOWLEDGE_DIR = path.join(process.cwd(), "docs", "comet-knowledge")

let cache: KnowledgeChunk[] | null = null

export function loadKnowledge(directory = KNOWLEDGE_DIR): KnowledgeChunk[] {
  if (cache && directory === KNOWLEDGE_DIR) return cache
  const chunks = readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const raw = readFileSync(path.join(directory, name), "utf8")
      const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? name
      return { id: name.replace(/\.md$/, ""), title, text: raw }
    })
  if (directory === KNOWLEDGE_DIR) cache = chunks
  return chunks
}

export function retrieveKnowledge(question: string, notes = loadKnowledge()): KnowledgeChunk[] {
  const words = tokens(question)
  return notes
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, words) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
    .slice(0, 3)
    .map((item) => item.chunk)
}

function scoreChunk(chunk: KnowledgeChunk, words: string[]): number {
  const hay = `${chunk.title} ${chunk.text}`.toLowerCase()
  let score = 0
  for (const word of words) {
    if (hay.includes(word)) score += 1
  }
  return score
}

const STOP = new Set(["what", "does", "this", "that", "your", "with", "from", "have", "they", "them", "where", "when", "which", "about"])

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOP.has(word))
}
