import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign } from "@/lib/campaign-creator/types"
import { getPaymentStore, type PaymentStore } from "@/lib/payments/store"
import type { PaymentRecord } from "@/lib/payments/types"

/** Writes the payment next to the campaign so the order and the charge stay linked. */
export async function persistPayment(payment: PaymentRecord): Promise<Campaign> {
  await getPaymentStore().put(payment)
  return getCampaignRepository().savePayment(payment.campaignId, payment)
}

/** Payment store that also updates the campaign on every write. */
export function mirroringPaymentStore(): PaymentStore {
  const inner = getPaymentStore()
  return {
    get: (id) => inner.get(id),
    list: () => inner.list(),
    async put(payment) {
      await persistPayment(payment)
    },
  }
}
