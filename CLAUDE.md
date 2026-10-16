# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Frostbite

A personalised incremental game for Meagan. The player character is Meagan;
every NPC is a Jan. Inspired by the Whiteout Survival ads, but all art,
names and text are original.

## Current state
- Phases 1–4 are done: a Phaser `CityScene` (`src/scenes/`) draws the snow, the furnace, a `HeatBar`, building sites (`SiteView`), Meagan (`MeaganSprite`) and the `BuildPicker` sheet (`src/ui/`), all driven by the engine. Logical size 780×1688 scaled with `Scale.FIT`; palette in `src/theme.ts`; map units map 1:1 to logical px via `src/scenes/coords.ts`. Research effects, prestige and the Build/Jans/Collection screens aren't built yet. Thawed Jans pick a job with `neediestJob` (an early auto-assign); `JanSprite` walking to work is cosmetic, output starts at assignment.
- Phase 3 brought carrying forward: `state.resources` wood/food/materials are the piles at the producers, Meagan carries a `bag`, the furnace burns `state.fuel`, and buildings level up from deliveries into `state.sites[i].progress` (see "Carrying and building" in the brief). `buy()` remains only as a test/dev shortcut.
- The brief was extended during Phase 2 planning (empty-start winters, Meagan gathering, animal attacks with guards/gear, Barracks, Signal Beacon, building heat drain). Those sections of the brief are now authoritative.
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

## Architecture
- `src/engine/` is plain TypeScript with no Phaser or DOM imports. `GameEngine` owns the `GameState`, runs fixed 0.1 s ticks via `advance(ms)` (accumulator, max 1 s per call), and handles `pause()`/`resume()` with no catch-up. Actions: `walkTo`, `tapSite`, `tapArrival`, `chooseBuilding`, `buy`, `buyGear`, `buyKit`, `assign`, `rescue`, `setMeaganPosition` (dev teleport). It queues `EngineEvent`s that the renderer reads with `drainEvents()`.
- Rules are split into `economy.ts` (pure derived values: costs, caps, drain, rates), `events.ts` (blizzards, arrivals, caravans, scavenging, heat-zero), `combat.ts` (animal attacks on the `map.ts` coordinate space, with the furnace at the origin) and `meagan.ts` (walking, arrival actions, gathering, the bag/pile/site magnet). `pathfinding.ts` is pure grid A* with line-of-sight smoothing; the engine rebuilds its `NavGrid` when a site gets a building. `map.ts` holds `SITES` (footprint, drop point; index 0 is the furnace), the gathering spots, `ARRIVAL_SPOTS`/`CARAVAN_SPOTS` and `jobSite()`. Rescue rules live in `events.ts` (`rescueArrival`). Randomness comes from an injected `Rng` (`rng.ts`, seeded) so runs are deterministic in tests.
- `src/game/runtime.ts` is the only browser glue. It creates the engine singleton and wires `visibilitychange` to pause/resume. In dev it exposes `window.frostbite` (`frostbite.meaganTo('forest')`, `frostbite.state()`, `frostbite.fill('materials', 10)`, `frostbite.skip(60)`, `frostbite.exportCode()`, `frostbite.importSave(code)`, `frostbite.newWinter()`, `frostbite.debugPath = true`).
- Renderer code (the Phaser City scene, plus the HTML/CSS overlays in `src/ui/overlay/`) reads `engine.state` and calls engine actions; it never mutates state directly.
- Overlays: `Shell.ts` glues the `#ui` layer to the canvas rect and sets `--u` (CSS px per logical game px) plus the `theme.ts` palette as CSS variables; size everything as `calc(var(--u) * N)` in logical px. It owns the city strip, the tab bar (`TAB_BAR_HEIGHT`, keep map content above it) and the screen host; a screen is `{ el, refresh() }` built by a factory when its tab opens. Use the `h()` helper in `dom.ts`; no framework.
- `src/content/buildings.json` holds building names (read via `src/content/index.ts`). Planned: `jans.json`, `rescue_lines.json`, `milestones.json`, `research.json`. All player-facing writing lives in JSON so it can be edited without touching code.
- Save: `src/engine/save.ts` (pure: versioned JSON, Infinity-safe, missing fields filled from `newWinterState()`, base64 export code). `runtime.ts` loads `localStorage['frostbite.save']` at startup and saves every 30 s, on each build/upgrade and when hidden; `lastSeen` is the save's `savedAt`. `engine.load(state)` swaps the state and CityScene restarts when `engine.loadCount` changes.
- A simulator script (greedy bot reporting time-to-milestone) is used to tune balance against the brief's pacing targets.

## Commands
- `npm run dev` — dev server; `npm run dev -- --host` to open it on an iPhone over Wi-Fi.
- `npm run typecheck` — `tsc --noEmit`. `npm run build` — typecheck + production build to `dist/`.
- `npm run icons` — regenerates the placeholder PNG icons in `public/icons/` (Node built-ins only).
- `npm test` — Vitest, all tests once. Single file or test: `npx vitest run src/engine/heat.test.ts -t "blizzard"`. Tests sit next to the code as `src/engine/*.test.ts`.

## How to work
- Plan before coding anything larger than a one-file change, and show the plan first.
- One feature at a time; keep the game runnable after every change.
- Run `npm run dev` to test; tell me what to check in the browser after each change.
- Keep the economy logic separate from the Phaser rendering so it can be unit-tested.
- Big numbers formatted as 1.2K, 3.4M, 5.6B.
- Ask before adding any dependency.
- Log what felt wrong on the phone in `NOTES.md`; it becomes the prompt for the next session.
