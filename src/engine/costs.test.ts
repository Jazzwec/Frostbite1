import { describe, expect, it } from 'vitest';
import { BUILDINGS, GEAR } from './balance';
import { buildingCost, curve, gearCost, kitCost } from './economy';
import { GameEngine } from './GameEngine';

describe('cost curve', () => {
  it('is base × growth^n', () => {
    expect(curve(15, 1.12, 0)).toBe(15);
    expect(curve(15, 1.12, 1)).toBeCloseTo(16.8);
    expect(curve(100, 1.8, 3)).toBeCloseTo(583.2);
  });

  it('prices brief buildings from their table rows, rounded up', () => {
    // Lumber Yard starts at Lv 1, so its first upgrade is n = 0.
    expect(buildingCost('lumberYard', 1)).toEqual({ wood: 15 });
    expect(buildingCost('lumberYard', 2)).toEqual({ wood: 17 }); // 16.8 → 17
    expect(buildingCost('huntingLodge', 11)).toEqual({ wood: Math.ceil(15 * 1.12 ** 10) });
    // Storehouse starts at 0.
    expect(buildingCost('storehouse', 0)).toEqual({ wood: 40, materials: 5 });
    expect(buildingCost('workshop', 2)).toEqual({ wood: Math.ceil(60 * 1.15 ** 2), materials: Math.ceil(10 * 1.15 ** 2) });
    expect(buildingCost('bunkhouse', 1)).toEqual({ wood: 150, materials: Math.ceil(37.5) });
  });

  it('makes the first Furnace upgrade Wood only, then Wood + Materials', () => {
    expect(buildingCost('furnace', 1)).toEqual({ wood: 100 });
    expect(buildingCost('furnace', 2)).toEqual({ wood: 180, materials: 36 });
    expect(buildingCost('furnace', 9)).toEqual({ wood: Math.ceil(100 * 1.8 ** 8), materials: Math.ceil(20 * 1.8 ** 8) });
  });

  it('prices the new buildings like their class', () => {
    expect(buildingCost('sledShed', 0)).toEqual({ wood: 30 });
    expect(buildingCost('sledShed', 1)).toEqual({ wood: 39 });
    expect(buildingCost('barracks', 0)).toEqual({ wood: 60, materials: 10 });
    expect(buildingCost('signalBeacon', 0)).toEqual({ wood: 120, materials: 30 });
    expect(buildingCost('signalBeacon', 3)).toEqual({ wood: Math.ceil(120 * 1.25 ** 3), materials: Math.ceil(30 * 1.25 ** 3) });
  });

  it('grows every building cost strictly with level', () => {
    for (const key of Object.keys(BUILDINGS) as Array<keyof typeof BUILDINGS>) {
      const def = BUILDINGS[key];
      for (let lvl = def.start; lvl < def.max - 1; lvl++) {
        expect(buildingCost(key, lvl + 1).wood!).toBeGreaterThan(buildingCost(key, lvl).wood!);
      }
    }
  });

  it('prices gear levels and makes kits dearer as gear improves', () => {
    expect(gearCost(0)).toEqual({ wood: 50, materials: 15 });
    expect(gearCost(2)).toEqual({ wood: Math.ceil(50 * 1.3 ** 2), materials: Math.ceil(15 * 1.3 ** 2) });
    expect(kitCost({ weapons: 0, armour: 0 })).toEqual({ wood: 20, materials: 5 });
    expect(kitCost({ weapons: 2, armour: 1 })).toEqual({
      wood: Math.ceil(20 * GEAR.growth ** 3),
      materials: Math.ceil(5 * GEAR.growth ** 3),
    });
  });
});

describe('buying', () => {
  it('spends the cost and raises the level', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.resources.wood = 100;
    expect(e.buy('lumberYard')).toBe(true);
    expect(e.state.buildings.lumberYard).toBe(2);
    expect(e.state.resources.wood).toBe(85);
  });

  it('refuses when unaffordable, locked or maxed', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.resources.wood = 10;
    expect(e.buy('lumberYard')).toBe(false);
    e.state.resources = { wood: 1000, food: 0, materials: 1000, knowledge: 0 };
    expect(e.buy('workshop')).toBe(false); // needs Furnace Lv 2
    e.state.buildings.hotSprings = 5;
    e.state.buildings.furnace = 7;
    expect(e.buy('hotSprings')).toBe(false); // max 5
  });
});
