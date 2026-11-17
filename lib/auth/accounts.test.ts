import assert from "node:assert/strict"
import { test } from "node:test"

import { consumeRate } from "@/lib/ops/rate-limit"

import {
  authenticatePassword,
  linkGoogleAccount,
  registerPasswordAccount,
  requestPasswordReset,
  resetAuthStore,
  verifyEmailToken,
} from "./accounts"
import { sendAuthMail } from "./mail"
import { passwordMatches } from "./passwords"

test("a password is stored as a hash, and sign-up works when email is not configured", async () => {
  resetAuthStore()
  let called = false
  const created = await registerPasswordAccount({
    email: "Ada-Pass@Example.com",
    password: "correct horse",
    name: "Ada",
    businessName: "Ada Co",
    origin: "https://mail.example",
    env: process.env,
    fetchImpl: async () => {
      called = true
      return new Response("no")
    },
    now: 1_000,
  })
  assert.equal(created.ok, true)
  if (!created.ok) return
  assert.equal(called, false)
  assert.match(created.notice, /verify later/i)
  assert.notEqual(created.user.passwordHash, "correct horse")
  assert.equal(await passwordMatches("correct horse", created.user.passwordHash ?? ""), true)
  assert.equal(created.user.emailVerifiedAt, null)
  const signedIn = await authenticatePassword({ email: "ada-pass@example.com", password: "correct horse", now: 2_000 })
  assert.equal(signedIn?.id, created.user.id)
})

test("Google links only a verified email and does not take an unverified password account", async () => {
  resetAuthStore()
  const created = await registerPasswordAccount({
    email: "ada-link@example.com",
    password: "correct horse",
    name: "Ada",
    businessName: "Ada Co",
    origin: "https://mail.example",
    env: process.env,
    now: 1_000,
  })
  assert.equal(created.ok, true)
  const blocked = await linkGoogleAccount({
    email: "ada-link@example.com",
    emailVerified: true,
    googleId: "google-1",
    name: "Ada",
  })
  assert.equal(blocked.ok, false)
  if (!created.ok) return
  created.user.emailVerifiedAt = new Date(1_000).toISOString()
  const linked = await linkGoogleAccount({
    email: "Ada-Link@Example.com",
    emailVerified: true,
    googleId: "google-1",
    name: "Ada Google",
  })
  assert.equal(linked.ok, true)
  if (!linked.ok) return
  assert.equal(linked.linked, true)
  assert.equal(linked.user.id, created.user.id)
  const again = await linkGoogleAccount({
    email: "ada-link@example.com",
    emailVerified: false,
    googleId: "google-2",
  })
  assert.equal(again.ok, false)
})

test("sign-up slows down after a short burst", async () => {
  resetAuthStore()
  const email = "burst@example.com"
  for (let i = 0; i < 5; i += 1) assert.equal((await consumeRate(`sign-up:${email}`, 5, 10 * 60_000, 5_000 + i)).ok, true)
  const blocked = await registerPasswordAccount({
    email,
    password: "correct horse",
    name: "Burst",
    businessName: "",
    origin: "https://mail.example",
    env: process.env,
    now: 6_000,
  })
  assert.equal(blocked.ok, false)
})

test("password reset does not crash or change the password when email is not configured", async () => {
  resetAuthStore()
  const created = await registerPasswordAccount({
    email: "ada-reset@example.com",
    password: "correct horse",
    name: "Ada",
    businessName: "",
    origin: "https://mail.example",
    env: process.env,
    now: 1_000,
  })
  assert.equal(created.ok, true)
  const reset = await requestPasswordReset({
    email: "ada-reset@example.com",
    origin: "https://mail.example",
    env: process.env,
    now: 2_000,
  })
  assert.match(reset.notice, /not available/i)
  const still = await authenticatePassword({ email: "ada-reset@example.com", password: "correct horse", now: 3_000 })
  assert.equal(still?.email, "ada-reset@example.com")
  const mail = await sendAuthMail({ to: "ada@example.com", subject: "Hi", text: "Hi" }, process.env)
  assert.equal(mail.sent, false)
  assert.equal(await verifyEmailToken("missing"), false)
})
