// Save format: versioned JSON (stored in localStorage by runtime.ts) and a copy-able export code. Pure: no storage here.
import { newWinterState } from './GameEngine';
import type { GameState } from './types';

export const SAVE_VERSION = 1;

export interface LoadedSave {
  state: GameState;
  /** When it was written (ms since epoch): the "last seen" time for the welcome-back card. */
  savedAt: number;
}

/** JSON has no Infinity (attack.next uses it until attacks unlock), so it travels as a marker string. */
const INFINITY = '__Infinity__';

export function serialize(state: GameState, savedAt = Date.now()): string {
  return JSON.stringify({ v: SAVE_VERSION, savedAt, state }, (_k, v: unknown) => (v === Infinity ? INFINITY : v));
}

/** Parse a save; missing or mistyped fields fall back to a fresh winter's values. Null if it isn't a save at all. */
export function deserialize(json: string): LoadedSave | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json, (_k, v: unknown) => (v === INFINITY ? Infinity : v));
  } catch {
    return null;
  }
  if (!isObject(raw) || raw.v !== SAVE_VERSION || !isObject(raw.state)) return null;
  migrate(raw.state);
  const fresh = newWinterState();
  const state = merge(fresh, raw.state) as GameState;
  // A layout change can add plots: keep saved sites, fill the rest fresh.
  state.sites = fresh.sites.map((site, i) => (isObject(state.sites[i]) ? merge(site, state.sites[i]) : site)) as GameState['sites'];
  return { state, savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now() };
}

/** Save as a base64 code the player can copy somewhere safe (Safari can clear site storage). */
export function exportCode(state: GameState): string {
  const bytes = new TextEncoder().encode(serialize(state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importCode(code: string): LoadedSave | null {
  try {
    const bin = atob(code.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return deserialize(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Saves from before prestige kept the collection, milestones and lifetime stats at the top level. */
function migrate(state: Record<string, unknown>): void {
  if (isObject(state.meta)) return;
  state.meta = { found: state.found, milestones: state.milestones, stats: state.stats };
  delete state.found;
  delete state.milestones;
  delete state.stats;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Saved values over defaults, key by key: objects merge, arrays and primitives must match the default's type. */
function merge(def: unknown, saved: unknown): unknown {
  if (saved === undefined) return def;
  if (def === null) return saved;
  if (Array.isArray(def)) return Array.isArray(saved) ? saved : def;
  if (isObject(def)) {
    if (!isObject(saved)) return def;
    const out: Record<string, unknown> = { ...saved };
    for (const k of Object.keys(def)) out[k] = merge(def[k], saved[k]);
    return out;
  }
  return typeof saved === typeof def ? saved : def;
}
