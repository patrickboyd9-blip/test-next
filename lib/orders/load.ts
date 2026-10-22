import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { getPaymentStore } from "@/lib/payments/store"

import { presentOrder, type CustomerOrderView } from "./present"

export async function listCustomerOrders(now = new Date()): Promise<CustomerOrderView[]> {
  const payments = await getPaymentStore().list()
  const repository = getCampaignRepository()
  const orders: CustomerOrderView[] = []
  for (const payment of payments) {
    const campaign = await repository.getCampaign(payment.campaignId)
    const current = campaign?.mailOrder
    const order =
      current?.id === payment.orderId
        ? current
        : campaign?.mailOrderHistory?.find((item) => item.id === payment.orderId) ?? null
    orders.push(
      presentOrder({
        payment,
        order,
        campaignName: campaign?.name?.trim() || campaign?.brief.businessInfo?.name?.trim() || "Postcard mailing",
        now,
      })
    )
  }
  return orders
}
