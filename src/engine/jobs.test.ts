import { describe, expect, it } from 'vitest';
import { AUTO_JOB } from './balance';
import { jobTargets, pickJanFor } from './economy';
import { GameEngine } from './GameEngine';
import { rebalanceJobs } from './jobs';
import { deserialize, serialize } from './save';
import type { Assignment, GameState, Jan } from './types';

function withJans(jobs: Assignment[]): GameEngine {
  const e = new GameEngine({ seed: 1 });
  jobs.forEach((job, i) => e.state.jans.push({ id: 100 + i, variant: 'plain', job, hasKit: false } satisfies Jan));
  return e;
}

function count(s: GameState, job: Assignment): number {
  return s.jans.filter((j) => j.job === job).length;
}

describe('moving Jans by hand', () => {
  it('+ takes the newest idle Jan first', () => {
    const e = withJans(['chop', 'idle', 'idle']);
    expect(pickJanFor(e.state, 'hunt')).toBe(102);
    expect(e.addToJob('hunt')).toBe(true);
    expect(e.state.jans.find((j) => j.id === 102)!.job).toBe('hunt');
  });

  it('+ with nobody idle takes from the job furthest over its share', () => {
    // Chopping 3/3 = 1 per share vs Hunting 1/2: Chopping gives one up.
    const e = withJans(['chop', 'chop', 'chop', 'hunt']);
    e.state.buildings.workshop = 1;
    expect(e.addToJob('build')).toBe(true);
    expect(count(e.state, 'chop')).toBe(2);
    expect(count(e.state, 'build')).toBe(1);
  });

  it('− sends the newest Jan on that job to idle', () => {
    const e = withJans(['chop', 'chop']);
    expect(e.removeFromJob('chop')).toBe(true);
    expect(e.state.jans.find((j) => j.id === 101)!.job).toBe('idle');
    expect(e.removeFromJob('hunt')).toBe(false);
  });

  it("won't put Jans on a job whose building doesn't exist", () => {
    const e = withJans(['idle']);
    expect(e.addToJob('build')).toBe(false);
  });

  it('turns Auto-assign off', () => {
    const e = withJans(['chop', 'idle']);
    e.state.buildings.furnace = AUTO_JOB.unlockFurnace;
    e.setAutoAssign(true);
    e.removeFromJob('chop');
    expect(e.state.autoAssign).toBe(false);
  });
});

describe('Auto-assign', () => {
  it('unlocks at its Furnace level', () => {
    const e = withJans([]);
    expect(e.setAutoAssign(true)).toBe(false);
    e.state.buildings.furnace = AUTO_JOB.unlockFurnace;
    expect(e.setAutoAssign(true)).toBe(true);
    expect(e.state.autoAssign).toBe(true);
  });

  it('targets every pooled Jan, Lumber Yard first, then food, then the shares', () => {
    const e = withJans(['idle', 'idle', 'idle', 'idle', 'idle', 'guard']);
    const t = jobTargets(e.state);
    expect(t.chop + t.hunt + t.build + t.research).toBe(5); // the guard isn't in the pool
    expect(t.chop).toBeGreaterThanOrEqual(1);
    expect(t.hunt).toBeGreaterThanOrEqual(1);
  });

  it('moves only the surplus and never touches guards or scavengers', () => {
    const e = withJans(['chop', 'chop', 'chop', 'chop', 'chop', 'chop', 'guard', 'scavenge']);
    e.state.buildings.barracks = 1;
    e.state.buildings.expeditionPost = 1;
    const moves = rebalanceJobs(e.state);
    const t = jobTargets(e.state);
    expect(count(e.state, 'chop')).toBe(t.chop);
    expect(count(e.state, 'hunt')).toBe(t.hunt);
    expect(moves).toBe(6 - t.chop);
    expect(count(e.state, 'guard')).toBe(1);
    expect(count(e.state, 'scavenge')).toBe(1);
    expect(rebalanceJobs(e.state)).toBe(0); // already balanced
  });

  it('rebalances on its own every few seconds while on', () => {
    const e = withJans(['chop', 'chop', 'chop']);
    e.state.buildings.furnace = AUTO_JOB.unlockFurnace;
    e.setAutoAssign(true);
    const hunters = count(e.state, 'hunt');
    expect(hunters).toBeGreaterThan(0);
    e.state.jans.forEach((j) => (j.job = 'chop')); // undo behind its back
    for (let i = 0; i < AUTO_JOB.rebalanceSeconds * 10 + 1; i++) e.tick();
    expect(count(e.state, 'hunt')).toBe(hunters);
  });

  it('loads as off from a save made before it existed', () => {
    const e = withJans([]);
    const raw = JSON.parse(serialize(e.state));
    delete raw.state.autoAssign;
    delete raw.state.autoAssignTimer;
    expect(deserialize(JSON.stringify(raw))!.state).toMatchObject({ autoAssign: false, autoAssignTimer: 0 });
  });
});
