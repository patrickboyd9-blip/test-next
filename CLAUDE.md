# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Modern Mail** — marketing site / early product shell for an "operating system for physical outreach" (direct mail campaigns: create, audience, launch, measure, optimize). This is a very early-stage Next.js codebase — currently just the landing page and a design-system foundation (shadcn components). There is no backend, database, auth, or test suite yet.

Product context lives in `docs/`:
- `docs/PRODUCT_BIBLE.md` — mission, vision, product principles, personas, and non-negotiables. It defines what the product should and shouldn't do (e.g. "not a print shop", "every workflow launchable in under five minutes").
- `docs/UX_MANIFESTO.md` — UX bar: calm, premium, minimal, fast; how motion, copy, and layout should feel.
- `docs/ENGINEERING_PRINCIPLES.md` — how we build: quality, milestones, definition of done, regression discipline.
- `docs/RELEASE_CHECKLIST.MD` — mandatory verification before every milestone release (lint, build, dev, browser, git).
- `docs/prd/` — feature PRDs (e.g. `CommandCenter.md`). Read the relevant PRD before implementing a feature.

## Product & Engineering Philosophy

These rules govern *how* to work in this repo, not just what's in it. They apply whether you're touching the landing page today or building out product surfaces later.

1. **Read `docs/PRODUCT_BIBLE.md` before making product or UX decisions.** Copy, flow, and feature scope should trace back to it, not to generic best practice.
2. **Read the relevant PRD in `docs/prd/` before implementing a feature.** The bible sets direction; the PRD sets the spec for the thing you're building.
3. **If the Product Bible and a PRD conflict, stop and ask — don't guess.** Don't silently resolve the conflict in either direction.
4. **Complexity belongs to us, not the customer.** Push implementation complexity into the code/architecture rather than onto the user.
5. **Every workflow should reduce cognitive load.** Fewer decisions, fewer screens, fewer things to hold in your head.
6. **Prefer clarity over cleverness.** In code and in UI/copy — the obvious solution beats the clever one.
7. **Never add features that are not requested or documented.** No speculative scope, no "while I'm in here" additions beyond the task.
8. **Explain your implementation plan before making significant code changes.** Don't jump straight to a large diff — describe the approach first.
9. **Build reusable components whenever practical.** Favor shared, composable pieces (especially in `components/ui/`) over one-off, duplicated UI.
10. **The UI should feel premium, calm, trustworthy, and modern.** This is a design bar for every screen, not just the landing page.
11. **AI is a first-class part of the product — not an afterthought.** When building features, consider how AI fits into the workflow (per the Product Bible's AI Strategy) rather than bolting it on later.
12. **Every implementation should reinforce that Modern Mail is the operating system for physical outreach** — unifying create/audience/launch/measure/optimize into one workspace, not a point tool.
13. **Follow all governing docs before shipping.** Read `PRODUCT_BIBLE.md`, `UX_MANIFESTO.md`, `ENGINEERING_PRINCIPLES.md`, the relevant milestone PRD, and complete `RELEASE_CHECKLIST.MD` — never skip validation.
14. **Never leave the application in a broken state.** If lint or build fails, fix it before ending the session.
15. **Explain dependency changes before making them.** State why a version pin or new package is needed; then verify with a clean install, build, and dev smoke test.
16. **Every milestone ends with:** `npm run lint`, `npm run build`, `npm run dev`, browser verification of `/` and `/app` (plus new feature paths), and a `git status` review.

## Commands

```bash
npm run dev      # start dev server (Next.js, http://localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

No test runner is configured in this repo yet.

There are two lockfiles at the root (`package-lock.json` and `package-lock 2.json`) — the latter is a stray duplicate, not a workspace file; don't treat it as authoritative.

## Architecture

- **Next.js App Router** (`app/`), React 19, TypeScript, Tailwind CSS v4.
- `app/layout.tsx` — root layout, loads Geist fonts.
- `app/page.tsx` — landing page (currently inlines most of what's in `components/Hero.tsx`; the two are duplicative — check both before editing hero content, since it's unclear which is the live/canonical version).
- `app/globals.css` — Tailwind v4 theme via `@theme inline`, imports `shadcn/tailwind.css` and `tw-animate-css`. Design tokens (colors, radii, sidebar/chart colors) are defined here as CSS variables, not in a `tailwind.config.*` file (Tailwind v4 style — there is no JS/TS Tailwind config).
- **shadcn/ui** is configured via `components.json` (style: `base-nova`, base color: `neutral`, icon library: `lucide`). Path aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.
  - `components/ui/` — generated shadcn primitives (built on `@base-ui/react`, styled with `class-variance-authority` + `cn()` from `lib/utils.ts`, which wraps `clsx` + `tailwind-merge`). Add new shadcn components via the `shadcn` CLI rather than hand-rolling variants, to stay consistent with existing primitives like `components/ui/button.tsx`.
  - `components/` (non-`ui`) — page-level/feature components, e.g. `Hero.tsx`.
- `@/*` path alias maps to the repo root (see `tsconfig.json`).
