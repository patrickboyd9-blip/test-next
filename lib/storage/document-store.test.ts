import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "fs/promises"
import os from "os"
import path from "path"
import { test } from "node:test"

import {
  createAppDocumentStore,
  createFileDocumentStore,
  createPostgresDocumentStore,
  postgresUrl,
  storageMode,
} from "./document-store"
import { MemorySql } from "./memory-sql"

test("storage mode stays on files until a database URL is set", () => {
  assert.equal(storageMode({}), "file")
  assert.equal(storageMode({ DATABASE_URL: "  ", POSTGRES_URL: "" }), "file")
  assert.equal(storageMode({ DATABASE_URL: "postgres://primary/db" }), "postgres")
  assert.equal(storageMode({ POSTGRES_URL: "postgres://fallback/db" }), "postgres")
  assert.equal(
    postgresUrl({
      DATABASE_URL: "postgres://primary/db",
      POSTGRES_URL: "postgres://fallback/db",
    }),
    "postgres://primary/db"
  )
  assert.equal(
    postgresUrl({ POSTGRES_URL: "postgres://fallback/db" }),
    "postgres://fallback/db"
  )
})

test("file documents round-trip inside their own directory", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-docs-"))
  try {
    const store = createFileDocumentStore(dir)
    assert.equal(await store.get("missing"), null)
    await store.put("camp-1", { id: "camp-1", brief: { offer: "Inspection" } })
    assert.deepEqual(await store.get("camp-1"), {
      id: "camp-1",
      brief: { offer: "Inspection" },
    })
    const raw = await readFile(path.join(dir, "camp-1.json"), "utf-8")
    assert.match(raw, /Inspection/)
    await assert.rejects(() => store.put("../escape", { id: "nope" }))
    assert.equal(await store.get("../escape"), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("postgres documents round-trip, create the table once, and survive a create race", async () => {
  const sql = new MemorySql()
  const store = createPostgresDocumentStore("campaigns", sql)

  await store.put("camp-1", { id: "camp-1", status: "draft" })
  assert.deepEqual(await store.get("camp-1"), { id: "camp-1", status: "draft" })
  assert.equal(await store.get("missing"), null)

  await store.put("camp-1", { id: "camp-1", status: "creative_ready" })
  assert.deepEqual(await store.get("camp-1"), {
    id: "camp-1",
    status: "creative_ready",
  })

  const creates = sql.statements.filter((statement) =>
    statement.startsWith("CREATE TABLE")
  )
  assert.equal(creates.length, 1)
  assert.match(creates[0] ?? "", /CREATE TABLE IF NOT EXISTS campaigns/)
  assert.match(sql.statements.join("\n"), /ON CONFLICT \(id\) DO UPDATE/)

  const raced = new MemorySql()
  raced.failCreates = 1
  const racedStore = createPostgresDocumentStore("reference_corpus", raced)
  await racedStore.put("ref-1", { id: "ref-1", label: "Mailer" })
  assert.deepEqual(await racedStore.get("ref-1"), { id: "ref-1", label: "Mailer" })
  assert.match(
    raced.statements.join("\n"),
    /CREATE TABLE IF NOT EXISTS reference_corpus/
  )
})

test("postgres reads jsonb that comes back as a string", async () => {
  const sql = new MemorySql()
  sql.returnDataAsString = true
  const store = createPostgresDocumentStore("campaigns", sql)
  await store.put("camp-2", { id: "camp-2", brief: { goal: "Calls" } })
  assert.deepEqual(await store.get("camp-2"), {
    id: "camp-2",
    brief: { goal: "Calls" },
  })
})

test("an explicit directory keeps createAppDocumentStore on files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mm-app-docs-"))
  try {
    const store = createAppDocumentStore("campaigns", { dataDir: dir })
    await store.put("camp-3", { id: "camp-3" })
    assert.deepEqual(await store.get("camp-3"), { id: "camp-3" })
    assert.equal(
      await readFile(path.join(dir, "camp-3.json"), "utf-8").then((raw) =>
        raw.includes("camp-3")
      ),
      true
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
