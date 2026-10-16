// Browser glue around the engine: pause on hide, resume on show, and a dev-only console hook.
import { GameEngine } from '../engine/GameEngine';
import { PLACES, type PlaceKey } from '../engine/map';

export const engine = new GameEngine();

// No offline progress: the clock stops the moment the tab or home-screen app is hidden.
function syncVisibility(): void {
  if (document.hidden) engine.pause();
  else engine.resume();
}
document.addEventListener('visibilitychange', syncVisibility);
syncVisibility();

if (import.meta.env.DEV) {
  // Until Meagan can walk (Phase 3), move her from the console: frostbite.meaganTo('forest').
  (window as unknown as Record<string, unknown>).frostbite = {
    engine,
    state: () => engine.state,
    meaganTo: (place: PlaceKey) => engine.setMeaganPosition(PLACES[place]),
  };
}
