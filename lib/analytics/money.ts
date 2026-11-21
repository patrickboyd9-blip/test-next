export interface OutcomeInput {
  chargeCents: number | null
  leads: number
  jobs: number | null
  revenueCents: number | null
}

export interface OutcomeFigures {
  costPerLead: string | null
  costPerJob: string | null
  returnOnSpend: string | null
}

/** Uses a recorded charge only. A missing charge or a zero denominator stays blank. */
export function outcomeFigures(input: OutcomeInput): OutcomeFigures {
  const charge = input.chargeCents
  const costPerLead = charge != null && charge > 0 && input.leads > 0 ? dollars(charge / input.leads) : null
  const costPerJob = charge != null && charge > 0 && input.jobs != null && input.jobs > 0 ? dollars(charge / input.jobs) : null
  const returnOnSpend =
    charge != null && charge > 0 && input.revenueCents != null && input.revenueCents >= 0
      ? `${(input.revenueCents / charge).toFixed(2)}×`
      : null
  return { costPerLead, costPerJob, returnOnSpend }
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
