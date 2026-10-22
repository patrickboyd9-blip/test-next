import { OrdersList } from "@/components/orders/OrdersList"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { listCustomerOrders } from "@/lib/orders/load"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const query = await searchParams
  const orders = await listCustomerOrders()
  const notice =
    query.checkout === "success"
      ? "Payment received. The mailing is sent to the printer after the payment is confirmed. Refresh in a moment if it still says paid."
      : null

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <OrdersList orders={orders} notice={notice} />
    </main>
  )
}
