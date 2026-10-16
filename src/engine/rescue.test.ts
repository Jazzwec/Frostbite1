import { describe, expect, it } from 'vitest';
import { CARAVAN } from './balance';
import { janCap, neediestJob } from './economy';
import { GameEngine } from './GameEngine';
import { ARRIVAL_SPOTS, CARAVAN_SPOTS, jobSite } from './map';
import { isBlocked } from './pathfinding';
import type { EngineEvent, Jan, JobKey } from './types';

function run(e: GameEngine, seconds: number): EngineEvent[] {
  const events: EngineEvent[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    e.tick();
    events.push(...e.drainEvents());
  }
  return events;
}

function addJans(e: GameEngine, job: JobKey, n: number): void {
  for (let i = 0; i < n; i++) e.state.jans.push({ id: 5000 + e.state.jans.length, variant: 'plain', job, hasKit: false } satisfies Jan);
}

describe('frozen Jans on the map', () => {
  it('arrive one at a time at free edge spots Meagan can reach', () => {
    const e = new GameEngine({ seed: 1 });
    run(e, 61);
    expect(e.state.waiting).toHaveLength(1);
    expect(e.state.waiting[0]).toMatchObject(ARRIVAL_SPOTS[0]);
    for (const p of ARRIVAL_SPOTS) expect(isBlocked(e.nav, p)).toBe(false);
    run(e, 60);
    expect(e.state.waiting[1]).toMatchObject(ARRIVAL_SPOTS[1]);
  });

  it('line caravans up along the top edge', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.t = CARAVAN.firstAt - 0.05;
    run(e, 0.1);
    const caravan = e.state.waiting.filter((w) => w.fromCaravan);
    expect(caravan.length).toBeGreaterThanOrEqual(CARAVAN.minJans);
    caravan.forEach((w, i) => expect(w).toMatchObject(CARAVAN_SPOTS[i]));
  });
});

describe('rescue by walking', () => {
  it('walks out to a tapped Jan and thaws him on arrival, sending him to work', () => {
    const e = new GameEngine({ seed: 1 });
    run(e, 61);
    const id = e.state.waiting[0].id;
    expect(e.tapArrival(id)).toBe(true);
    const events = run(e, 5);
    expect(e.state.waiting).toHaveLength(0);
    expect(e.state.jans).toHaveLength(1);
    expect(e.state.jans[0].job).toBe('chop');
    expect(events).toContainEqual(expect.objectContaining({ type: 'rescued', from: ARRIVAL_SPOTS[0] }));
  });

  it('counts each new Jan for the Collection, but not returning ones', () => {
    const e = new GameEngine({ seed: 1 });
    run(e, 61);
    const jan = e.rescue(e.state.waiting[0].id)!;
    expect(e.state.found[jan.variant]).toBe(1);
    expect(e.state.stats.rescued).toBe(1);
    e.state.waiting.push({ id: 999, x: 0, y: 300, variant: 'plain', fromCaravan: true, returning: true, leavesAt: null });
    e.rescue(999);
    expect(e.state.stats.rescued).toBe(1);
  });

  it('leaves him frozen when the city is full', () => {
    const e = new GameEngine({ seed: 1 });
    run(e, 61);
    addJans(e, 'chop', janCap(e.state));
    const id = e.state.waiting[0].id;
    e.tapArrival(id);
    const events = run(e, 5);
    expect(events).toContainEqual({ type: 'rescueBlocked', id });
    expect(e.state.waiting).toHaveLength(1);
  });
});

describe('neediest job', () => {
  it('fills the Lumber Yard first, then Hunting while eating outruns hunting', () => {
    const e = new GameEngine({ seed: 1 });
    expect(neediestJob(e.state)).toBe('chop');
    addJans(e, 'chop', 1);
    expect(neediestJob(e.state)).toBe('hunt');
  });

  it('then follows the job shares, including newly built buildings', () => {
    const e = new GameEngine({ seed: 1 });
    addJans(e, 'chop', 1);
    addJans(e, 'hunt', 1);
    expect(neediestJob(e.state)).toBe('chop'); // 1/3 below 1/2
    e.state.buildings.workshop = 1;
    expect(neediestJob(e.state)).toBe('build'); // 0/2
  });

  it('puts work spots beside the building, once it is placed', () => {
    const e = new GameEngine({ seed: 1 });
    expect(jobSite(e.state, 'chop')).not.toBeNull();
    expect(jobSite(e.state, 'build')).toBeNull();
    e.state.buildings.furnace = 2;
    e.chooseBuilding(3, 'workshop');
    const site = jobSite(e.state, 'build')!;
    expect(isBlocked(e.nav, site)).toBe(false);
  });
});
