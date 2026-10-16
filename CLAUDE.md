# Frostbite

A personalised incremental game for Meagan. The player character is Meagan;
every NPC is a Jan. Inspired by the Whiteout Survival ads, but all art,
names and text are original.

## Source of truth
- docs/design-brief.md is the design. Follow it. If something is unclear, ask before guessing.
- The constants in the brief's Economy section are the starting balance. Keep them in one file (src/engine/balance.ts) so they can be tuned without touching logic.

## Stack
- Vite + TypeScript + Phaser 3, mobile-first web app, portrait, touch controls.
- No backend, no accounts, no ads, no analytics. Saves go to localStorage with an export/import code.
- No offline progress: the game pauses the moment the tab is hidden.
- Must work in Safari on iPhone as a home-screen web app (manifest + iOS meta tags).

## How to work
- Plan before coding anything larger than a one-file change, and show the plan first.
- One feature at a time; keep the game runnable after every change.
- Run `npm run dev` to test; tell me what to check in the browser after each change.
- Keep the economy logic separate from the Phaser rendering so it can be unit-tested.
- Big numbers formatted as 1.2K, 3.4M, 5.6B.
- Ask before adding any dependency.
