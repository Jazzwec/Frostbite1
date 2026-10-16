# Frostbite: Meagan vs. the Cold — Game Design Brief

Oct 16, 2026 · @Jan

## Concept & pitch

Frostbite is a cosy incremental survival game for one player: Meagan keeps a furnace burning through an endless winter while rescuing an ever-growing crowd of frozen Jans and putting them to work. Keep the heat up, rescue more Jans, build more, survive the blizzards, and when the thaw comes start again with a stronger city.

It plays like the Whiteout Survival ads: a furnace at the centre, survivors staggering in from the snow, a city that grows outward. The twist is that every survivor is Jan, every line of dialogue is written for Meagan, and every milestone is an in-joke. It is a love letter disguised as an idle game.

- Platform: web game built for iPhone Safari, installed from Share → Add to Home Screen so it runs full-screen like an app; portrait, one-handed play
- Session shape: 10 to 30 minute sittings; the game pauses when closed and nothing happens between sessions
- Tone: warm, silly, slightly dramatic in the way survival games are; never grim
- Audience: one person. Nothing about the game needs to work for anyone else

## Characters

Meagan is the only leader; the Jans are the only survivors. There are no other named characters.

**Meagan** is the player avatar. She stands by the furnace, walks out to rescue arriving Jans when tapped, and is the one every Jan reports to. Her stats are the city's stats: heat, population, output. She never dies; the Jans are the ones at risk, which keeps the stakes warm rather than punishing.

**The Jans** are identical in silhouette and different in one visible quirk each. A newly rescued Jan is a plain Jan; variants unlock as the city grows and are assigned on rescue by weighted chance. Each variant has a small job bonus and a short bio on the collection screen.

| Variant | Visible tell | Job bonus | Unlock |
| --- | --- | --- | --- |
| Plain Jan | Parka, red nose | None | Start |
| Chef Jan | Apron, ladle | +25% food from Hunting | Kitchen built |
| Sleepy Jan | Blanket, half-shut eyes | Works 20% slower, eats 50% less | Tier 2 |
| Spreadsheet Jan | Clipboard | +25% Research | Research Hut built |
| Lost-His-Keys Jan | Patting pockets | Finds random bonus resources on rescue | Tier 2 |
| Lumberjack Jan | Axe, checked shirt | +25% wood from Chopping | Lumber Yard upgraded |
| DJ Jan | Headphones | +10% to every job while adjacent | Tier 3 |
| Veteran Jan | Grey beard, medal | Carries over through prestige, +5% all | First prestige |

Add two or three more variants from real quirks; the collection screen should end up with 10 to 12 Jans in total so there is always one more to find.

## Core loop

The furnace is the single thing to protect; everything else exists to feed it or to grow because of it.

The loop, as a cycle: Furnace heat → rescue arriving Jans → assign Jans to jobs → spend output on buildings → furnace capacity grows → more Jans. Blizzards are the one external pressure acting on the furnace.

Heat decays constantly. Jans burn wood to keep it up, but each Jan also adds to the drain, so the city only grows when furnace capacity grows first. That dependency is the exponential: capacity gates population, population drives output, output buys capacity.

A session plays like this:

1. Open the app. The city is exactly as it was left; a short welcome-back card recaps heat, population and the next blizzard.
2. Tap arriving Jans. Meagan walks over, the Jan thaws, a line of dialogue plays, and the Jan joins the idle pool.
3. Drag or tap idle Jans onto jobs. Spare Jans can be left idle at no cost beyond their food.
4. Spend resources on the cheapest useful upgrade. The game should always surface one affordable or nearly affordable thing to buy.
5. Check the forecast. If a blizzard is coming, stockpile wood or pull Jans off research onto chopping.
6. Close the app. The game pauses; nothing burns, nothing grows and nobody arrives until the next sitting.

## Resources

Five resources, and only Heat can run out with consequences. Everything else just slows you down when it is short.

| Resource | Produced by | Spent on | Cap | Notes |
| --- | --- | --- | --- | --- |
| Heat | Burning Wood at the Furnace | Drains automatically; each Jan adds to drain | Furnace level × 100 | Below 30%: jobs at half speed. At 0: one Jan leaves per minute until heat returns |
| Wood | Chopping | Furnace burn, most buildings | Lumber Yard level | The pacing resource; wood income vs burn rate is the core tension |
| Food | Hunting | Each Jan eats 1/min; Kitchen upgrades | Storehouse level | Short food = Jans work 25% slower. Never kills |
| Materials | Building job, Scavenging after Tier 2 | Higher-tier buildings, furnace upgrades | Storehouse level | The slow resource that gates each tier |
| Knowledge | Research | Permanent multipliers in the Research tree | None | Only resource that is never wasted; always a good sink for spare Jans |

A sixth resource, Warmth Tokens, is earned only at prestige and spent on permanent bonuses. It never resets.

## Jobs

Five jobs, each tied to one building that sets its rate. Output per Jan is the building's base rate times the Jan's variant bonus times Research multipliers.

| Job | Building | Produces | Base rate per Jan | Unlocks at | Upgrade effect per level |
| --- | --- | --- | --- | --- | --- |
| Chopping | Lumber Yard | Wood | 1.0 / s | Start | +15% rate, +50 Wood cap |
| Hunting | Hunting Lodge | Food | 0.6 / s | Start | +15% rate |
| Building | Workshop | Materials | 0.1 / s | Furnace Lv 2 | +20% rate |
| Research | Research Hut | Knowledge | 0.05 / s | Furnace Lv 3 | +20% rate |
| Scavenging | Expedition Post | Random Wood, Food or Materials in bursts | 1 burst / 90 s | Tier 2 | Shorter interval, bigger bursts |

Idle Jans still eat and still add to heat drain, so the game nudges players to assign everyone. A one-tap "auto-assign" that fills jobs by current need unlocks early in Tier 2 so the late game does not become micromanagement.

## Buildings & upgrades

The Furnace is the tier gate: each Furnace level raises the Jan cap and unlocks the next ring of buildings. Everything else is a level-up of one job or one cap.

| Building | Role | Max level | Jan cap effect | Unlocks |
| --- | --- | --- | --- | --- |
| Furnace | Heat cap and burn efficiency | 10 | +4 Jans per level | Each level opens new buildings and Jan variants |
| Lumber Yard | Chopping rate and Wood cap | 25 | — | — |
| Hunting Lodge | Hunting rate | 25 | — | — |
| Storehouse | Food and Materials cap | 15 | — | — |
| Workshop | Building rate; Materials | 20 | — | Furnace Lv 2 |
| Kitchen | Food consumed per Jan, down 5% per level | 10 | — | Furnace Lv 2; unlocks Chef Jan |
| Research Hut | Research rate | 20 | — | Furnace Lv 3; unlocks Spreadsheet Jan |
| Bunkhouse | Jan cap without raising heat drain | 10 | +2 Jans per level | Furnace Lv 3 |
| Expedition Post | Scavenging | 10 | — | Tier 2 (Furnace Lv 4) |
| Watchtower | Blizzard warning time, longer per level | 5 | — | Tier 2 |
| Hot Springs | Heat drain down 10% per level | 5 | — | Tier 3 (Furnace Lv 7) |

Tiers are just Furnace level bands: Tier 1 is Furnace 1 to 3, Tier 2 is 4 to 6, Tier 3 is 7 to 10. Each tier changes the city's look (snow depth, lights, decorations) so progress is visible without reading numbers.

The Research tree is a separate list of 15 to 20 one-off purchases bought with Knowledge: percentage multipliers to each job, cheaper Furnace levels, Jan arrival rate, blizzard resistance. It is the long-tail sink once buildings cap out.

## Economy & cost curves

Every repeatable cost follows one formula, so balancing is a matter of tuning a handful of constants in the simulator rather than editing tables.

```latex
\text{cost}(n) = \text{base} \times \text{growth}^{\,n}
```

where n is the number already owned. Starting constants, all to be tuned in the simulator before any game code is written:

| Item | Base cost | Growth | Currency |
| --- | --- | --- | --- |
| Lumber Yard, Hunting Lodge | 15 Wood | 1.12 | Wood |
| Storehouse, Kitchen | 40 Wood + 5 Materials | 1.15 | Wood, Materials |
| Workshop, Research Hut | 60 Wood + 10 Materials | 1.15 | Wood, Materials |
| Bunkhouse, Watchtower, Hot Springs | 120 Wood + 30 Materials | 1.25 | Wood, Materials |
| Furnace level | 100 Wood + 20 Materials | 1.8 | Wood, Materials |
| Research tree node | 10 Knowledge | 1.5 per node bought | Knowledge |

Heat drain per second = 0.5 + 0.1 per Jan, reduced by Hot Springs. Each Wood burned gives 10 Heat. So a city of 20 Jans burns 0.25 Wood/s just to stand still, and a Lumber Yard at level 10 with 8 Jans chopping makes about 3.5 Wood/s. That headroom is what players spend on growth.

Target pacing for a first winter, measured by the simulator with an attentive player:

| Milestone | Target time |
| --- | --- |
| Furnace Lv 2, first Chef Jan | 15 minutes |
| Tier 2 (Furnace Lv 4) | 1.5 hours |
| Tier 3 (Furnace Lv 7) | 4 to 5 hours |
| Furnace Lv 10, first prestige available | 10 to 12 hours |

There is no offline progress. The game runs only while open and pauses the moment it is backgrounded, so heat never drains between sessions and nothing is lost by closing the app. Every time in this brief is active play time, which is why the pacing is compressed compared with a typical idle game.

Numbers display as 1.2K, 3.4M, 5.6B and so on from 1,000 upward; the simulator decides whether anything ever reaches B. Jan arrivals: one every 60 seconds at base, slowing as the city nears its cap, so new Jans always feel wanted.

## Events & pressure

Blizzards are the only threat and they are always announced. The game is about preparing, not reacting.

| Event | Trigger | Effect | Counter |
| --- | --- | --- | --- |
| Blizzard | Every 20 to 40 minutes of active play, warned 3 minutes ahead (longer with Watchtower) | Heat drain ×3 for 2 minutes; no Jan arrivals | Stockpile Wood, move Jans to Chopping, buy Hot Springs |
| Long Night | Once per Tier, warned 10 minutes ahead | Blizzard lasting 5 minutes | Same, and the first one is the game's tutorial for prestige pressure |
| Jan caravan | Random, roughly once an hour | 3 to 5 Jans arrive at once, one guaranteed rare variant | Have cap free, or they wait at the edge for 10 minutes |
| Found a cache | Random on Scavenging | A burst of Materials or a free building level | None needed |
| Lost-His-Keys Jan finds something | On rescue of that variant | Small random bonus | None needed |

If Heat reaches zero, one Jan wanders off into the snow each minute. They return at the next caravan, so nothing is permanently lost. The loss should sting a little and never ruin a run.

## Prestige: A New Winter

At Furnace level 10 the thaw arrives. Meagan can choose to start A New Winter: the city resets, but Warmth Tokens and Veteran Jans carry over, so the second winter runs roughly twice as fast.

**Reset:** all buildings, resources, Research nodes and Jans except Veterans. The Jan collection is never reset.

**Kept:**

- Warmth Tokens, earned as 1 per Furnace level reached plus 1 per 10 Jans in the city at the thaw. First prestige yields about 14.
- Up to 3 Jans promoted to Veteran Jan (the player picks which). Veterans start the new winter already rescued, keep their variant bonus, and add +5% to all output each.
- Unlocked Jan variants stay unlockable from the start of the next winter.

**Warmth Token shop** (permanent, bought between winters):

| Bonus | Cost | Effect |
| --- | --- | --- |
| Warm start | 3 | Begin with Furnace Lv 2 and 50 Wood |
| Thick walls | 4 | Heat drain −5% per rank, 5 ranks |
| Fast feet | 4 | Jan arrival interval −10% per rank, 5 ranks |
| Deep pockets | 5 | Storehouse and Wood caps +25% per rank, 3 ranks |
| Old friends | 6 | +1 Veteran slot per rank, 2 ranks |
| Head start | 8 | All job rates +10% per rank, 5 ranks |

There is no hard ending. The simulator should confirm that by the fourth or fifth winter a full run takes under 3 hours of play, which is where the game settles into a comfortable daily habit rather than a grind.

## Personalisation content

The mechanics are generic; the writing is what makes this hers. All of it lives in plain JSON files so it can be edited without touching game code, and so Claude Code can scaffold the game before the writing is finished.

**Rescue lines** (`rescue_lines.json`): one short line a Jan says when thawed. Target 40 lines, 1 to 12 words each, weighted so rare lines appear less often. Variant Jans get 3 to 5 lines each in their own voice; plain Jans draw from the main pool.

**Jan collection bios** (`jans.json`): one or two sentences per variant for the collection screen, written as if cataloguing a species.

**Milestones** (`milestones.json`): 20 to 25 achievements that pop a card with a one-line message. Mix generic progress (first Furnace level) with dated or personal ones. Fields: id, trigger, title, message, optional unlock date (for ones that should only fire on or after a real date).

**Blizzard warnings and thaw message**: 5 warning lines, 1 thaw cutscene of 3 to 4 lines, 1 message for the first prestige.

**Idle chatter**: 15 to 20 lines that float above random Jans every 20 to 30 seconds while the city is calm. These do the most work for tone.

**Loading tips**: 10 fake survival tips in the style of the genre.

- [ ] Write 40 rescue lines
- [ ] Write 10 to 12 Jan variant bios and pick the final roster
- [ ] Write 20 to 25 milestones with triggers
- [ ] Write blizzard, thaw and prestige lines
- [ ] Write 15 to 20 idle chatter lines
- [ ] Write 10 loading tips
- [ ] Decide the one secret: a milestone that only fires on a date that matters

## Screens & UI

Four screens plus overlays. The City screen is where 90% of play happens and it must work with one thumb.

| Screen | Purpose | What it shows |
| --- | --- | --- |
| City | Main play | Top bar: Heat gauge, Jan count vs cap, Wood, Food, Materials. Centre: the city as a scrolling 2D scene with Meagan at the furnace, Jans on their job tiles, arrivals at the edge. Bottom: a "next upgrade" card showing the cheapest useful purchase, and the blizzard forecast strip |
| Build | Spend resources | List of buildings with level, next cost, effect of next level, and a buy button; greyed if unaffordable with time-to-afford shown |
| Jans | Manage population | Job slots as rows with Jan portraits; drag or tap to reassign; auto-assign toggle; idle pool at the top |
| Collection | Reward | Grid of all Jan variants, discovered ones in colour with bio and count rescued, undiscovered as silhouettes |

Overlays: rescue moment (Meagan walks out, speech bubble, Jan joins), milestone card, blizzard warning banner, welcome-back card on launch showing the city's state and the next blizzard timer, thaw cutscene, Warmth Token shop.

Tap targets at least 44 pt; no gesture more complex than drag. Numbers animate when they change. A small bounce and sound on rescue and on purchase (iPhone home-screen web apps cannot trigger haptics). No ads, no timers to skip, no currency to buy.

## Tech & build plan

A mobile-first web game built on Windows with Claude Code and published to GitHub Pages; no Mac, Xcode or App Store account is involved. Meagan installs it from Safari with Add to Home Screen, where it opens full-screen with its own icon. The constants in the Economy section are the source of truth for the engine; tune them with a simulator (a small script that plays the game with a greedy bot and reports time-to-milestone) before changing them in code.

**Stack**

- Vite + TypeScript + Phaser 3 for the City scene; plain HTML/CSS overlays (or Phaser UI) for menus and cards
- One `GameEngine` module in `src/engine/` that owns the tick loop and all rules, with no Phaser or DOM code inside it, so it can be unit-tested with Vitest
- Fixed 10 ticks per second; the renderer reads state and never mutates it directly
- No offline progress: pause on `visibilitychange` (tab hidden or app backgrounded), resume on return
- Save: a JSON snapshot to `localStorage` on every purchase and every 30 seconds, plus a `lastSeen` timestamp for the welcome-back card; an Export save button that shows a copy-able code and an Import save that takes one back, because Safari can clear site storage
- Web app manifest, iOS `apple-mobile-web-app` meta tags, 192 px and 512 px icons, and a service worker so it loads offline once installed
- Content: `jans.json`, `rescue_lines.json`, `milestones.json`, `buildings.json`, `research.json` in `src/content/`; a `balance.ts` holding every constant from the Economy section
- Big-number formatting as a small helper (1.2K, 3.4M, 5.6B); plain JavaScript numbers are enough unless the simulator shows values past 1e15
- Unit tests on `GameEngine`: cost curve, pause and resume, heat-zero behaviour, prestige carry-over
- No backend, no analytics, no accounts, no ads

**Phases for Claude Code**, each a separate session with `CLAUDE.md` and this brief in the repository:

1. **Scaffold.** Vite + TypeScript + Phaser project, portrait layout scaled to an iPhone screen, manifest and iOS meta tags, a snowy background with the furnace and a heat bar. Runs with `npm run dev`.
2. **Engine.** Implement the Economy section in `src/engine/`: resources, Jans, jobs, buildings, costs, blizzards, tick loop, pause on hide, save/load, export/import code, and the unit tests. Wire the heat bar to the real engine.
3. **Meagan.** A controllable character with a placeholder sprite: tap to walk with pathfinding around buildings; tapping a building walks her there and performs its action.
4. **Carrying and rescues.** Meagan carries wood from the Lumber Yard to the furnace and food to the Jans, with an upgradable carry limit; frozen Jans arrive at the map edge and she must walk out to thaw them.
5. **Screens.** Build, Jans and Collection screens as overlays driven by the engine; placeholder shapes for art.
6. **Content and juice.** Load the JSON content, milestones, rescue bubbles, idle chatter, blizzard banner, welcome-back card, number animations, sound effects.
7. **Prestige and polish.** Thaw cutscene, Warmth Token shop, tier visuals, app icon, GitHub Pages deployment with a GitHub Actions workflow.

Each phase ends with the game running on an iPhone: over Wi-Fi from the dev server (`npm run dev -- --host`) during development, and from the GitHub Pages link once deployed. Keep a `NOTES.md` in the repo where you log what felt wrong on the phone; it becomes the prompt for the next session.

## Art & assets

A flat, chunky cartoon style with thick outlines reads well at phone size and is forgiving of mixed sources. Avoid anything that copies the look of Whiteout Survival's assets; the loop is fair game, the art is not.

| Asset | Count | Source |
| --- | --- | --- |
| Meagan sprite, 4 directions, idle and walk | 1 set | Jan supplies: a cartoon avatar app or a commissioned artist, from photos |
| Base Jan sprite, same frames | 1 set | Same source as Meagan |
| Variant overlays (apron, blanket, clipboard, headphones, beard, axe) | 10 to 12 | Claude can generate as SVG; export to PNG at 2x and 3x |
| Buildings, 3 tier states each | 11 × 3 | Claude can generate placeholder SVG; replace later if wanted |
| Furnace with 5 heat states | 1 set | Claude SVG placeholder |
| Resource icons | 6 | Claude SVG |
| UI icons | \~15 | Inline SVG, Claude can generate |
| Snow, embers, breath puffs | particles | Phaser particle emitters, Claude can write them |
| App icon | 1 | Meagan at the furnace, as 192 px and 512 px PNG for the web manifest; needs the real avatar |
| Sound | \~10 effects, 1 ambient wind loop | Free CC0 packs; no music needed |

Start with coloured rectangles and the real text. The game is playable and tunable long before any art exists, and the avatars are the only assets that genuinely have to be good.

## Open questions

Decisions that change the build and are yours to make. None of them block Phase 1.

- [ ] Working title: Frostbite is a placeholder. The real title probably comes from an in-joke.
- [ ] Is the game a surprise? If yes, the avatars need to be made without her, which rules out photo-based apps on her phone.
- [ ] Public or private GitHub repository? GitHub Pages on a free account only publishes public repositories; private means testing over Wi-Fi until you make it public.
- [ ] Does tapping a building auto-route Meagan there and perform the action, or does she only act when walked over by hand? Auto-routing plays better one-handed and matches the ads.
- [ ] Should any Jans be people other than you (a dog, a friend) or is it strictly all-Jans?
- [ ] Target launch moment, if any. The milestone list and the secret date depend on it.
