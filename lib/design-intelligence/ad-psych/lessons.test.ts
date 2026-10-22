import assert from "node:assert/strict"
import { test } from "node:test"

import { lessonFor, ROLE_LESSONS, textHasAgencyResult } from "./lessons-data"
import { lessonForRole, loadAdLessons } from "./lessons"

test("roofing lessons are reasoning, with no agency result figures", () => {
  const lessons = loadAdLessons()
  assert.match(lessonFor("roofing", "outcome"), /finished house/i)
  assert.match(lessonFor("roofing", "threat"), /easy/i)
  assert.equal(lessonFor("roofing", "outcome"), lessonForRole(lessons, "roofing", "outcome"))
  for (const lesson of ROLE_LESSONS) {
    assert.equal(textHasAgencyResult(lesson.text), false, lesson.text)
    assert.equal(/\b889\b|impressions|unverified/i.test(lesson.text), false, lesson.text)
  }
  assert.equal(textHasAgencyResult("889K impressions"), true)
  assert.equal(headlineIsOurs("A dry, safe home starts here"), false)
})

function headlineIsOurs(headline: string): boolean {
  return ROLE_LESSONS.some((lesson) => lesson.text.toLowerCase() === headline.toLowerCase())
}
