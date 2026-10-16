import { describe, expect, it } from 'vitest';
import { CARAVAN, MEAGAN, RESEARCH, type ResearchKey } from './balance';
import { arrivalInterval, carryLimit, caravanWait, foodEaten, heatDrain, heatPerWood, jobRate, nextCost, researchCost } from './economy';
import { GameEngine } from './GameEngine';
import { deserialize, serialize } from './save';
import type { Jan } from './types';

/** Far enough right that she walks in a straight line from the furnace drop point for half a second. */
const MEAGAN_X_GOAL = 300;

function rich(): GameEngine {
  const e = new GameEngine({ seed: 1 });
  e.state.resources.knowledge = 10_000;
  return e;
}

/** Value of `measure` before and after learning `key`. */
function effect(key: ResearchKey, measure: (e: GameEngine) => number): [number, number] {
  const e = rich();
  for (let i = 0; i < 6; i++) e.state.jans.push({ id: 900 + i, variant: 'plain', job: 'hunt', hasKit: false } satisfies Jan);
  const before = measure(e);
  expect(e.buyResearch(key)).toBe(true);
  return [before, measure(e)];
}

describe('research', () => {
  it('costs 10 Knowledge, then 1.5× more per node bought', () => {
    const e = rich();
    expect(researchCost(e.state)).toBe(10);
    e.buyResearch('sharpAxes');
    expect(e.state.resources.knowledge).toBe(10_000 - 10);
    expect(researchCost(e.state)).toBe(15);
    e.buyResearch('lampOil');
    expect(researchCost(e.state)).toBe(Math.ceil(10 * 1.5 ** 2));
  });

  it('can be learned once, only with enough Knowledge', () => {
    const e = new GameEngine({ seed: 1 });
    expect(e.buyResearch('sharpAxes')).toBe(false);
    e.state.resources.knowledge = 10;
    expect(e.buyResearch('sharpAxes')).toBe(true);
    e.state.resources.knowledge = 100;
    expect(e.buyResearch('sharpAxes')).toBe(false);
    expect(e.buyResearch('nonsense' as ResearchKey)).toBe(false);
  });

  it('has 15 to 20 nodes, as the brief asks', () => {
    const n = Object.keys(RESEARCH.nodes).length;
    expect(n).toBeGreaterThanOrEqual(15);
    expect(n).toBeLessThanOrEqual(20);
  });

  it('boosts job output', () => {
    const [a, b] = effect('snareLines', (e) => jobRate(e.state, 'hunt'));
    expect(b).toBeCloseTo(a * 1.15);
    const [c, d] = effect('secondShift', (e) => jobRate(e.state, 'hunt'));
    expect(d).toBeCloseTo(c * 1.1);
  });

  it('lets Meagan carry more and walk faster', () => {
    const [a, b] = effect('biggerSled', (e) => carryLimit(e.state));
    expect(b).toBe(a + 10);
    const e = rich();
    e.buyResearch('warmBoots');
    e.walkTo({ x: MEAGAN_X_GOAL, y: 50 });
    e.tick(0.5);
    expect(e.state.meagan.x).toBeCloseTo(MEAGAN.walkSpeed * 1.2 * 0.5);
  });

  it('warms and protects the furnace', () => {
    const [a, b] = effect('stokerDoor', (e) => heatPerWood(e.state));
    expect(b).toBeCloseTo(a * 1.1);
    const [c, d] = effect('insulation', (e) => heatDrain(e.state));
    expect(d).toBeCloseTo(c * 0.9);
    const [f, g] = effect('stormShutters', (e) => heatDrain(e.state, true));
    expect(g).toBeCloseTo(f * 0.8);
    const [h, i] = effect('furnacePlans', (e) => nextCost(e.state, 'furnace').wood!);
    expect(i).toBe(Math.ceil(h * 0.9));
  });

  it('brings Jans sooner, feeds them cheaper and keeps caravans longer', () => {
    const [a, b] = effect('signalFlags', (e) => arrivalInterval(e.state));
    expect(b).toBeCloseTo(a * 0.85);
    const [c, d] = effect('preserves', (e) => foodEaten(e.state));
    expect(d).toBeCloseTo(c * 0.9);
    const [, f] = effect('warmBlankets', (e) => caravanWait(e.state));
    expect(f).toBeCloseTo(CARAVAN.waitSeconds * 1.5);
  });

  it('is saved, and old saves load with none learned', () => {
    const e = rich();
    e.buyResearch('drillYard');
    expect(deserialize(serialize(e.state))!.state.research).toEqual(['drillYard']);
    const raw = JSON.parse(serialize(e.state));
    delete raw.state.research;
    expect(deserialize(JSON.stringify(raw))!.state.research).toEqual([]);
  });
});
