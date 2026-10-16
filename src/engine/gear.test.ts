import { describe, expect, it } from 'vitest';
import { gearCost, kitCost } from './economy';
import { GameEngine } from './GameEngine';

function armed(): GameEngine {
  const e = new GameEngine({ seed: 1 });
  e.state.buildings.barracks = 1;
  e.state.resources = { wood: 300, food: 0, materials: 100, knowledge: 0 };
  e.state.jans.push({ id: 50, variant: 'plain', job: 'guard', hasKit: false });
  return e;
}

describe('Barracks crafting', () => {
  it('crafts gear levels from the piles', () => {
    const e = armed();
    const cost = gearCost(0);
    expect(e.buyGear('weapons')).toBe(true);
    expect(e.state.gear.weapons).toBe(1);
    expect(e.state.resources.wood).toBe(300 - cost.wood!);
    expect(e.state.resources.materials).toBe(100 - cost.materials!);
  });

  it('makes a kit for a guard without one, and only while one needs it', () => {
    const e = armed();
    const cost = kitCost(e.state.gear);
    expect(e.buyKit()).toBe(true);
    expect(e.state.jans[0].hasKit).toBe(true);
    expect(e.state.resources.wood).toBe(300 - cost.wood!);
    expect(e.buyKit()).toBe(false);
  });

  it('needs a Barracks and enough in the piles', () => {
    const e = armed();
    e.state.buildings.barracks = 0;
    expect(e.buyGear('armour')).toBe(false);
    e.state.buildings.barracks = 1;
    e.state.resources.wood = 0;
    expect(e.buyGear('armour')).toBe(false);
  });
});
