// Browser glue around the engine: load and autosave, pause on hide, resume on show, and a dev-only console hook.
import { SAVE, TICK_SECONDS } from '../engine/balance';
import { GameEngine, newWinterState } from '../engine/GameEngine';
import { PLACES, type PlaceKey } from '../engine/map';
import { deserialize, exportCode, importCode, serialize, type LoadedSave } from '../engine/save';
import type { StoredResource } from '../engine/types';

const SAVE_KEY = 'frostbite.save';

/** Storage can throw (private mode, blocked site data); the game then simply plays without saving. */
function readSave(): LoadedSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

const loaded = readSave();

export const engine = new GameEngine({ state: loaded?.state });

/** When the save we started from was written (ms since epoch), for the welcome-back card; null on a first run. */
export const lastSeen: number | null = loaded?.savedAt ?? null;

/** Dev-only switches the renderer reads. */
export const devFlags = { debugPath: false };

export function saveNow(): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(engine.state));
  } catch {
    // Nothing to do: the export code is the backup.
  }
}

/** Replace the game from an export code. False if the code isn't a save. */
export function importSave(code: string): boolean {
  const save = importCode(code);
  if (!save) return false;
  engine.load(save.state);
  saveNow();
  return true;
}

export function newWinter(): void {
  engine.load(newWinterState());
  saveNow();
}

export function currentExportCode(): string {
  return exportCode(engine.state);
}

window.setInterval(saveNow, SAVE.autosaveSeconds * 1000);

// No offline progress: the clock stops the moment the tab or home-screen app is hidden. Save on the way out,
// because iOS may never bring the page back.
function syncVisibility(): void {
  if (document.hidden) {
    engine.pause();
    saveNow();
  } else engine.resume();
}
document.addEventListener('visibilitychange', syncVisibility);
window.addEventListener('pagehide', saveNow);
syncVisibility();

if (import.meta.env.DEV) {
  // Console helpers: frostbite.meaganTo('forest'), frostbite.fill('materials', 10), frostbite.skip(60),
  // frostbite.exportCode(), frostbite.importSave(code), frostbite.newWinter(), frostbite.debugPath = true.
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
    exportCode: currentExportCode,
    importSave,
    newWinter,
    get debugPath() {
      return devFlags.debugPath;
    },
    set debugPath(on: boolean) {
      devFlags.debugPath = on;
    },
  };
}
