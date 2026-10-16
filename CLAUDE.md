# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Frostbite

A personalised incremental game for Meagan. The player character is Meagan;
every NPC is a Jan. Inspired by the Whiteout Survival ads, but all art,
names and text are original.

## Current state
- Phase 1 (Scaffold) is done: a Phaser `CityScene` (`src/scenes/`) draws the snow, furnace and a `HeatBar` (`src/ui/`) fixed at 100%. Logical size 780×1688 scaled with `Scale.FIT`; palette in `src/theme.ts`. Next is Phase 2 (Engine).
- `prototype/frostbite.html` is a self-contained, playable HTML/JS prototype of the whole game (engine, content, UI, save). It is a reference, not the codebase: port its logic into `src/engine/` rather than editing it.
- Its sections are marked `// ===== NAME =====`: `CONTENT` (sample text), `BAL` (constants), `JOBS`/`BLD`/`RESEARCH`/`VARIANTS`/`SHOP`/`MILESTONES` (data tables), then pure rule functions (`costOf`, `rates`, `caps`, `buy`, `rescue`, `autoAssignAll`, `doPrestige`, `tick(s, dt, ev)`), then save/format helpers and the DOM/canvas UI. `tick` mutates state and pushes events into `ev` for the UI to react to — a good model for the engine/renderer boundary.
## Source of truth
- docs/design-brief.md is the design. Follow it. If something is unclear, ask before guessing.
- The starting balance is the brief's numbers (Economy, Resources, Jobs, Buildings, Events, Prestige tables), not the prototype's `BAL`, which differs (e.g. Furnace 400 Wood + 100 Materials at growth 3.0 vs the brief's 100 + 20 at 1.8). Don't port prototype-only mechanics like `coldGrowth` or `gate` unless asked. Where the brief gives no number, ask.
- Every tunable number lives in src/engine/balance.ts as a named, commented constant. Engine logic reads from it and never hard-codes a number, so the balance can be retuned by editing that one file.

## Stack
- Vite + TypeScript + Phaser 3, mobile-first web app, portrait, touch controls.
- No backend, no accounts, no ads, no analytics. Saves go to localStorage with an export/import code.
- No offline progress: the game pauses the moment the tab is hidden.
- Must work in Safari on iPhone as a home-screen web app (manifest + iOS meta tags).
- Deploys to GitHub Pages via a GitHub Actions workflow (Phase 7).

## Planned architecture (from the brief)
- `src/engine/`: one `GameEngine` owning a fixed 10 ticks/s loop and all rules; no Phaser or DOM imports, unit-tested with Vitest. Tests cover cost curve, pause/resume, heat-zero behaviour, prestige carry-over.
- Renderer (Phaser City scene + HTML/CSS overlays for menus/cards) reads engine state and never mutates it directly.
- `src/content/`: `jans.json`, `rescue_lines.json`, `milestones.json`, `buildings.json`, `research.json`. All player-facing writing lives in JSON so it can be edited without touching code.
- Save: JSON snapshot to localStorage on every purchase and every 30 s, plus `lastSeen` for the welcome-back card.
- A simulator script (greedy bot reporting time-to-milestone) is used to tune balance against the brief's pacing targets.

## Commands
- `npm run dev` — dev server; `npm run dev -- --host` to open it on an iPhone over Wi-Fi.
- `npm run typecheck` — `tsc --noEmit`. `npm run build` — typecheck + production build to `dist/`.
- `npm run icons` — regenerates the placeholder PNG icons in `public/icons/` (Node built-ins only).
- Vitest arrives in Phase 2; add the test and single-test commands here then.

## How to work
- Plan before coding anything larger than a one-file change, and show the plan first.
- One feature at a time; keep the game runnable after every change.
- Run `npm run dev` to test; tell me what to check in the browser after each change.
- Keep the economy logic separate from the Phaser rendering so it can be unit-tested.
- Big numbers formatted as 1.2K, 3.4M, 5.6B.
- Ask before adding any dependency.
- Log what felt wrong on the phone in `NOTES.md`; it becomes the prompt for the next session.
