# NOTES

What to check on the phone, and what's still open. Log anything that feels wrong under "Felt wrong"; this file is the prompt for the next session.

## Felt wrong on the phone

_(nothing logged yet)_

## Phone checklist (all of this was built without being seen on a screen)

Run `npm run dev -- --host` and open the address on the iPhone. Console helpers (dev only, desktop): `frostbite.skip(60)`, `frostbite.fill('materials', 10)`, `frostbite.state()`, `frostbite.debugPath = true`.

**Map and walking**
- [ ] Tap the snow: Meagan walks there around buildings; tap targets feel big enough.
- [ ] Forest → bag fills; furnace → fuel goes in, heat rises, the fire grows through its 5 stages.
- [ ] Scrap heap behind the furnace gives Materials; Sled Shed (30 Wood) raises the bag limit.
- [ ] Tap a "+" plot → the build sheet sits above the tab bar; pick one → construction site → deliver → built (squash + sound).
- [ ] Nothing on the map is hidden under the tab bar.

**Jans**
- [ ] A frozen Jan appears at the edge about once a minute; tap → she walks out → he thaws, says a line, hops, walks to work.
- [ ] Working Jans chat in bubbles every 20–30 s while calm.
- [ ] At the Jan cap, "No room!" shows and he stays frozen.
- [ ] Caravans line up along the top with shrinking rings.

**Screens**
- [ ] Build: Go on a building and Go on an unbuilt one; Research switch; Barracks crafting row.
- [ ] Jans: −/+ moves Jans; Auto-assign locked until Furnace Lv 4, then rebalances.
- [ ] Collection fills in; silhouettes show unlock hints; bios read well.
- [ ] ⚙: Sound on/off, Copy code → Start over → Load brings the city back.

**Events**
- [ ] Blizzard: banner warning, strip countdown, wind sound, banner on start and end (`frostbite.skip(840)` reaches the first one).
- [ ] Animal attack (Furnace Lv 2+): animals visible with HP bars, guards move out, Meagan fights, loot floaters.
- [ ] Milestone cards pop one at a time with a chime.
- [ ] Reload: the welcome-back card shows time away, heat, Jans and the next blizzard.

**The thaw**
- [ ] `frostbite.state().buildings.furnace = 10` → "☀ The thaw is here" in the strip → story → tokens → pick Veterans → shop → Start A New Winter.
- [ ] New winter starts at Furnace Lv 1 (Lv 2 with Warm start) with the Veterans, tokens, collection and milestones kept.

**Tier looks**
- [ ] Furnace Lv 4: string lights and glowing windows. Furnace Lv 7: flags, lanterns, deeper drifts.

**Install and offline**
- [ ] `npm run build && npx vite preview --host`, add to Home Screen, open once online, then airplane mode and reopen.
- [ ] Sound plays after the first tap (iOS needs that tap).

## Numbers to confirm (not in the brief)

Walk 160, bag 20 (+10 per Sled Shed level), magnet 80 units / 20 per s, fuel 30 per Furnace level, Sled Shed 30 Wood ×1.3, scrap heap 1 Materials/s, job shares 3:2:2:1, Auto-assign every 5 s from Furnace Lv 4, the 16 Research nodes, DJ +5% per DJ (max 3), shop ranks at flat cost, gear paid from the piles. All in `src/engine/balance.ts`.

## Still open

- **Writing:** everything in `src/content/` is a placeholder draft (rescue lines, bios, milestones, chatter, blizzard/thaw lines, tips). The secret milestone in `milestones.json` needs its date and words.
- **Roster:** the brief wants 10–12 kinds of Jan; there are 7. Adding one is a `VARIANTS` row in `balance.ts`, an entry in `jans.json`, a portrait accessory in `src/ui/overlay/portrait.ts` and optional lines in `rescue_lines.json`.
- **Art:** the real Meagan and Jan avatars, and an app icon of Meagan at the furnace (`npm run icons` makes placeholders).
- **Deploy:** decide public vs private repo, then repo Settings → Pages → Source "GitHub Actions" and push to main.
- **Balance:** the greedy-bot simulator isn't built; pacing against the brief's targets (Furnace Lv 2 in 15 min, Tier 2 in 1.5 h …) is untested.
- **Canteen** idea (better meals boost Jans) needs numbers.
