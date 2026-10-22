"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cancelCustomerOrder, refreshCustomerOrder } from "@/lib/orders/actions"
import type { CustomerOrderView } from "@/lib/orders/present"

export function OrdersList({
  orders,
  notice,
}: {
  orders: CustomerOrderView[]
  notice?: string | null
}) {
  const [items, setItems] = useState(orders)
  const [message, setMessage] = useState(notice ?? "")
  const [busyId, setBusyId] = useState<string | null>(null)

  async function update(paymentId: string, action: "cancel" | "refresh") {
    setBusyId(paymentId)
    setMessage("")
    try {
      const result = action === "cancel" ? await cancelCustomerOrder(paymentId) : await refreshCustomerOrder(paymentId)
      setMessage(result.message)
      if (result.order) {
        setItems((current) => current.map((item) => (item.paymentId === paymentId ? result.order! : item)))
      }
    } finally {
      setBusyId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No orders yet. When you pay for a mailing, it shows up here.
        </p>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">Each mailing moves from paid, to submitted, to printing, to mailed.</p>
        {message && (
          <p className="mt-3 text-sm" role="status">
            {message}
          </p>
        )}
      </div>
      {items.map((order) => (
        <article key={order.paymentId} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">{order.campaignName}</h2>
            <p className="text-sm text-muted-foreground">{order.totalLabel}</p>
          </div>
          <p className="mt-2 text-sm">{order.sentence}</p>
          <ol className="mt-4 flex flex-wrap gap-2" aria-label="Order progress">
            {order.steps.map((step) => (
              <li
                key={step.id}
                aria-current={step.state === "current" ? "step" : undefined}
                className={
                  step.state === "upcoming"
                    ? "rounded-full border px-3 py-1 text-sm text-muted-foreground"
                    : "rounded-full border border-foreground bg-foreground px-3 py-1 text-sm text-background"
                }
              >
                {step.label}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">
            {order.pieceCount} {order.pieceCount === 1 ? "card" : "cards"}
          </p>
          {order.problem && <p className="mt-2 text-sm text-destructive">{order.problem}</p>}
          {order.paymentStatus === "paid" && !order.canCancel && order.cancelBlockedReason && (
            <p className="mt-2 text-sm text-muted-foreground">{order.cancelBlockedReason}</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" disabled={busyId === order.paymentId} onClick={() => void update(order.paymentId, "refresh")}>
              {busyId === order.paymentId ? "Working…" : "Refresh status"}
            </Button>
            {order.canCancel && (
              <Button type="button" variant="destructive" disabled={busyId === order.paymentId} onClick={() => void update(order.paymentId, "cancel")}>
                Cancel order
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
