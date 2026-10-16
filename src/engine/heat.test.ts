import { describe, expect, it } from 'vitest';
import { heatCap, heatDrain, heatPerWood } from './economy';
import { GameEngine, newWinterState } from './GameEngine';
import type { GameState, Jan } from './types';

function withJans(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s.jans.push({ id: 1000 + i, variant: 'plain', job: 'idle', hasKit: false } satisfies Jan);
  return s;
}

describe('heat drain', () => {
  it('starts at base + the two starting buildings', () => {
    // 0.5 base + 0.05 × (Lumber Yard 1 + Hunting Lodge 1)
    expect(heatDrain(newWinterState())).toBeCloseTo(0.6);
  });

  it('adds 0.1 per Jan', () => {
    expect(heatDrain(withJans(newWinterState(), 20))).toBeCloseTo(0.6 + 2);
  });

  it('adds 0.05 per non-Furnace building level, ignoring the Furnace', () => {
    const s = newWinterState();
    s.buildings.lumberYard = 10;
    s.buildings.storehouse = 4;
    s.buildings.furnace = 9;
    expect(heatDrain(s)).toBeCloseTo(0.5 + 0.05 * (10 + 1 + 4));
  });

  it('is cut 10% per Hot Springs level (which also counts as a building)', () => {
    const s = newWinterState();
    s.buildings.hotSprings = 3;
    expect(heatDrain(s)).toBeCloseTo((0.5 + 0.05 * 5) * 0.7);
  });

  it('triples in a blizzard', () => {
    const s = withJans(newWinterState(), 10);
    expect(heatDrain(s, true)).toBeCloseTo(heatDrain(s, false) * 3);
    s.blizzard.active = true;
    expect(heatDrain(s)).toBeCloseTo(heatDrain(s, false) * 3);
  });
});

describe('furnace', () => {
  it('has 100 heat cap per level and gets 5% more heat per Wood per level', () => {
    const s = newWinterState();
    expect(heatCap(s)).toBe(100);
    expect(heatPerWood(s)).toBe(10);
    s.buildings.furnace = 10;
    expect(heatCap(s)).toBe(1000);
    expect(heatPerWood(s)).toBeCloseTo(14.5);
  });

  it('starts a winter cold', () => {
    expect(new GameEngine({ seed: 1 }).state.heat).toBe(0);
  });

  it('burns stocked Wood to fill up, then holds steady at the drain rate', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.resources.wood = 50;
    e.tick(1);
    expect(e.state.heat).toBeCloseTo(100);
    // Filled 100 heat plus 0.6 drain at 10 heat per Wood.
    expect(e.state.resources.wood).toBeCloseTo(50 - 100.6 / 10);
    const before = e.state.resources.wood;
    e.tick(10);
    expect(e.state.heat).toBeCloseTo(100);
    expect(before - e.state.resources.wood).toBeCloseTo((0.6 * 10) / 10);
  });

  it('loses heat at the drain rate once Wood runs out, and never below 0', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.heat = 100;
    e.tick(10);
    expect(e.state.heat).toBeCloseTo(100 - 6);
    e.tick(1000);
    expect(e.state.heat).toBe(0);
  });

  it('lets Meagan warm it up by chopping in the forest', () => {
    const e = new GameEngine({ seed: 1 });
    e.setMeaganPosition({ x: -320, y: -260 }); // the forest
    for (let i = 0; i < 300; i++) e.tick();
    expect(e.state.heat).toBeCloseTo(100);
  });
});

describe('pause', () => {
  it('ignores time while paused and does not catch up on resume', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.heat = 100;
    e.pause();
    expect(e.advance(60_000)).toBe(0);
    expect(e.state.t).toBe(0);
    e.resume();
    // A huge first frame after resuming is capped to 1 s.
    expect(e.advance(60_000)).toBe(10);
    expect(e.state.t).toBeCloseTo(1);
  });

  it('runs 10 fixed ticks per second of real time', () => {
    const e = new GameEngine({ seed: 1 });
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += e.advance(1000 / 60);
    expect(ticks).toBe(10);
  });
});
