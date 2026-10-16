// Browser glue around the engine: pause on hide, resume on show, and a dev-only console hook.
import { TICK_SECONDS } from '../engine/balance';
import { GameEngine } from '../engine/GameEngine';
import { PLACES, type PlaceKey } from '../engine/map';
import type { StoredResource } from '../engine/types';

export const engine = new GameEngine();

/** Dev-only switches the renderer reads. */
export const devFlags = { debugPath: false };

// No offline progress: the clock stops the moment the tab or home-screen app is hidden.
function syncVisibility(): void {
  if (document.hidden) engine.pause();
  else engine.resume();
}
document.addEventListener('visibilitychange', syncVisibility);
syncVisibility();

if (import.meta.env.DEV) {
  // Console helpers: frostbite.meaganTo('forest'), frostbite.fill('materials', 10), frostbite.skip(60), frostbite.debugPath = true.
  (window as unknown as Record<string, unknown>).frostbite = {
    engine,
    state: () => engine.state,
    meaganTo: (place: PlaceKey) => engine.setMeaganPosition(PLACES[place]),
    /** Put resources straight into Meagan's bag, ignoring the carry limit. */
    fill: (res: StoredResource, n: number) => {
      engine.state.meagan.bag[res] += n;
    },
    /** Fast-forward the game clock (e.g. skip(60) for the next Jan, skip(600) for the first caravan). */
    skip: (seconds: number) => {
      for (let i = 0; i < seconds / TICK_SECONDS; i++) engine.tick();
    },
    get debugPath() {
      return devFlags.debugPath;
    },
    set debugPath(on: boolean) {
      devFlags.debugPath = on;
    },
  };
}
