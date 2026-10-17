/**
 * Token cost for one card. Counts come from the model response when a model
 * ran. The dollar figure is an estimate so a build can be compared with the
 * last one. It is not an invoice.
 */

export interface TokenCost {
  cardId: string
  step: "art-director" | "critic" | "analyze" | "blueprint" | "copy-edit"
  model: string
  inputTokens: number
  outputTokens: number
  estimatedUsd: number
}

const DEFAULT_INPUT_PER_MILLION = 3
const DEFAULT_OUTPUT_PER_MILLION = 15

export function estimateUsd(
  inputTokens: number,
  outputTokens: number,
  env: NodeJS.ProcessEnv = process.env
): number {
  const inputRate = numberEnv(env.DESIGN_INPUT_USD_PER_MTOK, DEFAULT_INPUT_PER_MILLION)
  const outputRate = numberEnv(env.DESIGN_OUTPUT_USD_PER_MTOK, DEFAULT_OUTPUT_PER_MILLION)
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
}

export function logTokenCost(cost: TokenCost): void {
  console.info(`[design-intelligence] ${JSON.stringify(cost)}`)
}

export function emptyCost(cardId: string, step: TokenCost["step"]): TokenCost {
  return { cardId, step, model: "rules", inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
