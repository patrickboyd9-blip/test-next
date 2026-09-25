import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "fs/promises"
import os from "os"
import path from "path"
import { test } from "node:test"

import { MMR_001_INTAKE, MMR_001_INTAKE_ID } from "./fixtures"
import {
  createReferenceCorpusRepository,
  defaultReferenceCorpusDataDir,
} from "./repository"
import {
  hasEvidenceLocator,
  hasReferenceMedia,
  hasResearchPointer,
  type ReferenceCorpusItem,
} from "./types"

const FORBIDDEN_ITEM_FIELDS = [
  "brief",
  "creative",
  "ownerId",
  "status",
  "mailPiece",
  "layoutVariant",
  "leadJob",
  "imageryRole",
  "visualDirection",
  "principles",
  "gallery",
  "galleryStatus",
  "conceptStatus",
  "spec",
  "score",
] as const

function physicalMailerItem(): ReferenceCorpusItem {
  return {
    id: "ref-test-physical-0001",
    sourceClass: "physical_mailer",
    label: "Physical mailer test record",
    addedAt: "2026-09-25T00:00:00.000Z",
    media: {
      front: {
        id: "ref-test-physical-0001-front",
        role: "front",
        src: "fixture://physical-mailer/placeholder-front",
      },
    },
    provenance: {
      acquiredBy: "patrick",
      note: "Test only. Not a photographed mailer.",
    },
  }
}

async function withStore(
  run: (
    store: ReturnType<typeof createReferenceCorpusRepository>,
    dir: string
  ) => Promise<void>
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "reference-corpus-"))
  try {
    await run(createReferenceCorpusRepository({ dataDir: dir }), dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function assertIntakeShape(item: Record<string, unknown>) {
  for (const field of FORBIDDEN_ITEM_FIELDS) {
    assert.equal(field in item, false, `must not carry ${field}`)
  }
}

test("MMR-001 can be persisted and read as a ReferenceCorpusItem", async () => {
  await withStore(async (store) => {
    const saved = await store.save(MMR_001_INTAKE)
    const loaded = await store.get(MMR_001_INTAKE_ID)

    assert.equal(saved.sourceClass, "grok_research")
    assert.equal(saved.provenance.researchId, "MMR-001")
    assert.equal(saved.provenance.recordPath, "examples/2026-09-16-MMR-001.md")
    assert.deepEqual(loaded, MMR_001_INTAKE)
    assertIntakeShape(saved as unknown as Record<string, unknown>)
  })
})

test("a Grok research item can have no media and still have evidence", () => {
  assert.deepEqual(MMR_001_INTAKE.media, {})
  assert.equal(hasReferenceMedia(MMR_001_INTAKE.media), false)
  assert.equal(hasResearchPointer(MMR_001_INTAKE.provenance), true)
  assert.equal(hasEvidenceLocator(MMR_001_INTAKE), true)
  assert.equal(MMR_001_INTAKE.media.front, undefined)
})

test("a physical mailer item uses the same type and can have front media", async () => {
  await withStore(async (store) => {
    const physical = physicalMailerItem()
    await store.save(MMR_001_INTAKE)
    await store.save(physical)

    const grok = await store.get(MMR_001_INTAKE_ID)
    const loaded = await store.get(physical.id)

    assert.ok(grok)
    assert.ok(loaded)
    assert.equal(grok.sourceClass, "grok_research")
    assert.equal(loaded.sourceClass, "physical_mailer")
    assert.equal(loaded.media.front?.role, "front")
    assert.equal(hasReferenceMedia(loaded.media), true)
    assert.equal(hasResearchPointer(loaded.provenance), false)
    assert.equal(hasEvidenceLocator(loaded), true)
    assert.deepEqual(Object.keys(grok).sort(), Object.keys(loaded).sort())
    assertIntakeShape(loaded as unknown as Record<string, unknown>)
  })
})

test("back and details remain optional", async () => {
  await withStore(async (store) => {
    const frontOnly = await store.save(physicalMailerItem())
    assert.equal(frontOnly.media.back, undefined)
    assert.equal(frontOnly.media.details, undefined)

    const withOptional: ReferenceCorpusItem = {
      ...physicalMailerItem(),
      id: "ref-test-physical-0002",
      media: {
        front: physicalMailerItem().media.front,
        back: {
          id: "ref-test-physical-0002-back",
          role: "back",
          src: "fixture://physical-mailer/placeholder-back",
        },
        details: [
          {
            id: "ref-test-physical-0002-detail",
            role: "detail",
            src: "fixture://physical-mailer/placeholder-detail",
          },
        ],
      },
    }

    const loaded = await store.get((await store.save(withOptional)).id)
    assert.equal(loaded?.media.back?.role, "back")
    assert.equal(loaded?.media.details?.[0]?.role, "detail")
  })
})

test("source class does not fork the domain shape", () => {
  const grok = MMR_001_INTAKE
  const physical: ReferenceCorpusItem = {
    ...grok,
    id: "ref-shape-physical",
    sourceClass: "physical_mailer",
    label: "Same shape, physical source",
  }

  assert.deepEqual(Object.keys(physical).sort(), Object.keys(grok).sort())
  assert.deepEqual(Object.keys(physical.media).sort(), Object.keys(grok.media).sort())
})

test("evidence can come from a research pointer or from media", async () => {
  await withStore(async (store) => {
    await store.save(MMR_001_INTAKE)
    await store.save(physicalMailerItem())

    assert.equal(hasResearchPointer(MMR_001_INTAKE.provenance), true)
    assert.equal(hasReferenceMedia(MMR_001_INTAKE.media), false)
    assert.equal(hasResearchPointer(physicalMailerItem().provenance), false)
    assert.equal(hasReferenceMedia(physicalMailerItem().media), true)

    await assert.rejects(
      () =>
        store.save({
          id: "ref-no-evidence",
          sourceClass: "physical_mailer",
          label: "Missing evidence",
          addedAt: "2026-09-25T00:00:00.000Z",
          media: {},
          provenance: {},
        }),
      /requires evidence/
    )
  })
})

test("the corpus store does not live with or write campaign data", async () => {
  await withStore(async (store, dir) => {
    await store.save(MMR_001_INTAKE)

    assert.notEqual(dir, path.join(process.cwd(), ".data", "campaigns"))
    assert.notEqual(
      defaultReferenceCorpusDataDir(),
      path.join(process.cwd(), ".data", "campaigns")
    )
    assert.match(defaultReferenceCorpusDataDir(), /reference-corpus$/)

    const raw = JSON.parse(
      await readFile(path.join(dir, `${MMR_001_INTAKE_ID}.json`), "utf-8")
    ) as Record<string, unknown>

    assertIntakeShape(raw)
    assert.equal(raw.sourceClass, "grok_research")
    assert.equal((raw.provenance as { researchId: string }).researchId, "MMR-001")
  })
})
