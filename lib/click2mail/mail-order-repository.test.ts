import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import type { MailOrderRecord } from "./order-record"

test("mail order is stored on the campaign without changing its status", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-mail-order-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(dir))
    const campaign = await repository.createCampaign("owner@example.com")
    const order: MailOrderRecord = {
      id: "order-1",
      mode: "test",
      environment: "stage",
      pieceCount: 1,
      estimatedCostLabel: "$1.25 placeholder — not a Click2Mail quote",
      artwork: "type-plate",
      documentId: "doc-1",
      addressListId: "list-1",
      jobId: "job-1",
      jobStatus: "EDITING",
      submitted: false,
      product: {
        documentClass: "Postcard 5 x 8",
        layout: "Double Sided Postcard",
        paperType: "White Matte with Gloss UV Finish",
        printOption: "Printing both sides",
        mailClass: "First Class",
        productionTime: "Next Day",
        color: "Full Color",
      },
      createdAt: "2026-10-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
    }
    const saved = await repository.saveMailOrder(campaign.id, order)
    assert.equal(saved.status, "draft")
    assert.equal(saved.mailOrder?.jobId, "job-1")

    const again = await repository.saveMailOrder(campaign.id, {
      ...order,
      id: "order-2",
      jobStatus: "MAILED",
      updatedAt: "2026-10-10T01:00:00.000Z",
    })
    assert.equal(again.mailOrder?.id, "order-2")
    assert.equal(again.mailOrderHistory?.[0]?.id, "order-1")
    assert.equal(again.status, "draft")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
