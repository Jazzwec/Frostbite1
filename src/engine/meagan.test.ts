import { describe, expect, it } from 'vitest';
import { FUEL, MAGNET, MEAGAN } from './balance';
import { GameEngine } from './GameEngine';
import { FOREST, MEAGAN_START, SCRAP_HEAP, SITES, distance } from './map';
import { isBlocked } from './pathfinding';
import type { EngineEvent } from './types';

const PLOT = 3; // first empty plot
const LUMBER_YARD = 1;
/** Open snow out of magnet reach of every site. */
const AWAY = { x: -150, y: 200 };

function run(e: GameEngine, seconds: number): EngineEvent[] {
  const events: EngineEvent[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    e.tick();
    events.push(...e.drainEvents());
  }
  return events;
}

describe('walking', () => {
  it('starts in front of the furnace, not inside it', () => {
    const e = new GameEngine({ seed: 1 });
    expect(e.state.meagan).toMatchObject(MEAGAN_START);
    expect(isBlocked(e.nav, e.state.meagan)).toBe(false);
  });

  it('walks at her speed and arrives', () => {
    const e = new GameEngine({ seed: 1 });
    const to = { x: MEAGAN_START.x + 160, y: MEAGAN_START.y };
    expect(e.walkTo(to)).toBe(true);
    e.tick(0.5);
    expect(e.state.meagan.x).toBeCloseTo(MEAGAN_START.x + MEAGAN.walkSpeed * 0.5);
    run(e, 2);
    expect(e.state.meagan).toMatchObject(to);
    expect(e.state.meagan.path).toEqual([]);
  });

  it('goes around the furnace rather than through it', () => {
    const e = new GameEngine({ seed: 1 });
    e.walkTo({ x: 0, y: -300 });
    let crossed = false;
    for (let i = 0; i < 100; i++) {
      e.tick();
      if (isBlocked(e.nav, e.state.meagan)) crossed = true;
    }
    expect(crossed).toBe(false);
    expect(distance(e.state.meagan, { x: 0, y: -300 })).toBeLessThan(1);
  });

  it("can't walk while injured", () => {
    const e = new GameEngine({ seed: 1 });
    e.state.meagan.injured = true;
    expect(e.walkTo({ x: 100, y: 100 })).toBe(false);
  });
});

describe('carrying', () => {
  it('fills her bag in the forest up to the carry limit, not the Wood pile', () => {
    const e = new GameEngine({ seed: 1 });
    e.setMeaganPosition(FOREST);
    run(e, 10);
    expect(e.state.meagan.bag.wood).toBeCloseTo(MEAGAN.carryLimit);
    expect(e.state.resources.wood).toBe(0);
  });

  it('scavenges Materials by hand at the scrap heap', () => {
    const e = new GameEngine({ seed: 1 });
    e.setMeaganPosition(SCRAP_HEAP);
    run(e, 5);
    expect(e.state.meagan.bag.materials).toBeCloseTo(MEAGAN.materialsPerSecond * 5);
  });

  it('carries more with each Sled Shed level', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.buildings.sledShed = 2;
    e.setMeaganPosition(FOREST);
    run(e, 20);
    expect(e.state.meagan.bag.wood).toBeCloseTo(MEAGAN.carryLimit + 2 * MEAGAN.carryPerSledLevel);
  });

  it('feeds the furnace up to its fuel cap', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.meagan.bag.wood = 20;
    e.state.heat = 100;
    e.state.fuel = FUEL.capPerFurnaceLevel - 5;
    run(e, 3);
    // Only the 5 Wood of room plus the little a full furnace burns at the drain rate.
    expect(e.state.fuel).toBeLessThanOrEqual(FUEL.capPerFurnaceLevel);
    expect(e.state.meagan.bag.wood).toBeGreaterThan(14.5);
    expect(e.state.meagan.bag.wood).toBeLessThan(15);
  });

  it('picks up from the Lumber Yard pile when she walks past', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.resources.wood = 50;
    e.walkTo(SITES[LUMBER_YARD].drop); // walking, not tapping: tapping would start an upgrade
    run(e, 5);
    expect(e.state.meagan.bag.wood).toBeCloseTo(MEAGAN.carryLimit);
    expect(e.state.resources.wood).toBeCloseTo(50 - MEAGAN.carryLimit);
  });

  it('moves at most the magnet rate per second', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.resources.wood = 50;
    e.setMeaganPosition(SITES[LUMBER_YARD].drop);
    run(e, 0.5);
    expect(e.state.meagan.bag.wood).toBeCloseTo(MAGNET.perSecond * 0.5);
  });
});

describe('building', () => {
  it('asks what to build when she reaches an empty plot', () => {
    const e = new GameEngine({ seed: 1 });
    expect(e.tapSite(PLOT)).toBe(true);
    const events = run(e, 5);
    expect(events).toContainEqual({ type: 'plotReached', site: PLOT });
  });

  it('only places unlocked buildings that are not already standing', () => {
    const e = new GameEngine({ seed: 1 });
    expect(e.chooseBuilding(PLOT, 'workshop')).toBe(false); // needs Furnace Lv 2
    expect(e.chooseBuilding(PLOT, 'lumberYard')).toBe(false); // already placed
    expect(e.chooseBuilding(LUMBER_YARD, 'storehouse')).toBe(false); // not an empty plot
    expect(e.chooseBuilding(PLOT, 'storehouse')).toBe(true);
    expect(e.chooseBuilding(PLOT + 1, 'storehouse')).toBe(false); // only one Storehouse
  });

  it('constructs a plot once its whole cost is delivered', () => {
    const e = new GameEngine({ seed: 1 });
    e.chooseBuilding(PLOT, 'storehouse'); // 40 Wood + 5 Materials
    const m = e.state.meagan;
    e.setMeaganPosition(AWAY); // away from the furnace, which would take her Wood as fuel
    m.bag.wood = 15;
    m.bag.materials = 5;
    e.tapSite(PLOT);
    run(e, 6);
    expect(e.state.sites[PLOT].progress).toEqual({ wood: 15, materials: 5 });
    expect(e.state.buildings.storehouse).toBe(0);

    m.bag.wood = 20;
    run(e, 2);
    m.bag.wood = 20;
    const events = run(e, 2);
    expect(e.state.buildings.storehouse).toBe(1);
    expect(events).toContainEqual({ type: 'buildingUpgraded', site: PLOT, building: 'storehouse', level: 1 });
    expect(e.state.sites[PLOT]).toMatchObject({ upgrading: false, progress: {} });
    expect(m.bag.wood).toBeCloseTo(15); // only what was needed was taken
  });

  it('builds a Sled Shed from Wood alone', () => {
    const e = new GameEngine({ seed: 1 });
    e.setMeaganPosition(AWAY);
    expect(e.chooseBuilding(PLOT, 'sledShed')).toBe(true);
    e.state.meagan.bag.wood = 20;
    e.tapSite(PLOT);
    run(e, 4);
    e.state.meagan.bag.wood = 20;
    run(e, 2);
    expect(e.state.buildings.sledShed).toBe(1);
  });

  it('blocks walking once a plot has a building', () => {
    const e = new GameEngine({ seed: 1 });
    const f = SITES[PLOT].footprint;
    const centre = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
    expect(isBlocked(e.nav, centre)).toBe(false);
    e.chooseBuilding(PLOT, 'storehouse');
    expect(isBlocked(e.nav, centre)).toBe(true);
  });

  it('starts an upgrade when she reaches a built building, then levels it up on delivery', () => {
    const e = new GameEngine({ seed: 1 });
    e.setMeaganPosition(AWAY);
    e.state.meagan.bag.wood = 20;
    e.tapSite(LUMBER_YARD); // next level costs 15 Wood
    const events = run(e, 6);
    expect(events).toContainEqual({ type: 'upgradeStarted', site: LUMBER_YARD, building: 'lumberYard' });
    expect(e.state.buildings.lumberYard).toBe(2);
  });

  it('does not upgrade buildings she merely walks past', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.meagan.bag.wood = 20;
    e.setMeaganPosition(SITES[LUMBER_YARD].drop);
    run(e, 3);
    expect(e.state.buildings.lumberYard).toBe(1);
    expect(e.state.meagan.bag.wood).toBe(20);
  });
});
