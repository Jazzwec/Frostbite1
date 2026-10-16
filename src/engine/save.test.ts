import { describe, expect, it } from 'vitest';
import { GameEngine } from './GameEngine';
import { SITES, distance } from './map';
import { deserialize, exportCode, importCode, serialize } from './save';

function played(): GameEngine {
  const e = new GameEngine({ seed: 7 });
  e.state.fuel = 12.5;
  e.state.meagan.bag.wood = 8;
  e.state.buildings.furnace = 2; // attacks scheduled from here on
  e.chooseBuilding(3, 'workshop');
  for (let i = 0; i < 700; i++) e.tick();
  return e;
}

describe('save', () => {
  it('round-trips the whole state', () => {
    const e = played();
    const loaded = deserialize(serialize(e.state, 1234))!;
    expect(loaded.savedAt).toBe(1234);
    expect(loaded.state).toEqual(e.state);
  });

  it('keeps Infinity (no attack scheduled yet)', () => {
    const e = new GameEngine({ seed: 1 });
    expect(e.state.attack.next).toBe(Infinity);
    expect(deserialize(serialize(e.state))!.state.attack.next).toBe(Infinity);
  });

  it('rejects anything that is not a save', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"v":99,"state":{}}')).toBeNull();
    expect(deserialize('[1,2,3]')).toBeNull();
    expect(importCode('%%%')).toBeNull();
  });

  it('fills missing or mistyped fields from a fresh winter', () => {
    const e = played();
    const raw = JSON.parse(serialize(e.state));
    delete raw.state.meta.found;
    delete raw.state.meagan.bag;
    raw.state.fuel = 'lots';
    raw.state.sites = raw.state.sites.slice(0, 5); // an older layout with fewer plots
    const s = deserialize(JSON.stringify(raw))!.state;
    expect(s.meta.found.plain).toBe(0);
    expect(s.meagan.bag).toEqual({ wood: 0, food: 0, materials: 0 });
    expect(s.fuel).toBe(0);
    expect(s.sites).toHaveLength(SITES.length);
    expect(s.sites[3].building).toBe('workshop');
    expect(s.resources).toEqual(e.state.resources);
  });

  it('exports a code that imports back to the same state', () => {
    const e = played();
    expect(importCode(exportCode(e.state))!.state).toEqual(e.state);
  });

  it('loads into an engine, which then carries on playing', () => {
    const e = played();
    const fresh = new GameEngine({ seed: 1 });
    const before = fresh.loadCount;
    fresh.load(deserialize(serialize(e.state))!.state);
    expect(fresh.loadCount).toBe(before + 1);
    expect(fresh.state.sites[3].building).toBe('workshop');
    const start = { x: fresh.state.meagan.x, y: fresh.state.meagan.y };
    expect(fresh.walkTo({ x: 0, y: 300 })).toBe(true);
    for (let i = 0; i < 20; i++) fresh.tick();
    expect(distance(fresh.state.meagan, start)).toBeGreaterThan(0);
  });
});
