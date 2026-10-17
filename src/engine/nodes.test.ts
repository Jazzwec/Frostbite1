import { describe, expect, it } from 'vitest';
import { MEAGAN, NODES } from './balance';
import { GameEngine } from './GameEngine';
import { ARRIVAL_SPOTS, CARAVAN_SPOTS, MAP_BOUNDS, RESOURCE_NODES, SITES, distance } from './map';
import { isBlocked } from './pathfinding';
import { deserialize, serialize } from './save';

const forests = RESOURCE_NODES.map((n, i) => ({ ...n, i })).filter((n) => n.kind === 'forest');

function at(i: number): GameEngine {
  const e = new GameEngine({ seed: 1 });
  e.setMeaganPosition(RESOURCE_NODES[i].at);
  return e;
}

describe('resource spots', () => {
  it('are scattered around the town, inside the map, and walkable', () => {
    expect(new Set(RESOURCE_NODES.map((n) => n.kind))).toEqual(new Set(['forest', 'hunting', 'scrap']));
    const e = new GameEngine({ seed: 1 });
    for (const n of RESOURCE_NODES) {
      expect(isBlocked(e.nav, n.at)).toBe(false);
      // Well clear of every building site.
      for (const site of SITES) expect(distance(n.at, site.drop)).toBeGreaterThan(MEAGAN.gatherRange + 60);
    }
    expect(MAP_BOUNDS.maxX - MAP_BOUNDS.minX).toBeGreaterThan(1200);
  });

  it('start full, and gathering takes from the spot she stands on only', () => {
    const [a, b] = forests;
    const e = at(a.i);
    expect(e.state.nodes[a.i]).toBe(NODES.forest.stock);
    for (let i = 0; i < 20; i++) e.tick();
    expect(e.state.meagan.bag.wood).toBeCloseTo(MEAGAN.woodPerSecond * 2);
    expect(e.state.nodes[a.i]).toBeLessThan(NODES.forest.stock);
    expect(e.state.nodes[b.i]).toBe(NODES.forest.stock);
  });

  it('run dry, then gathering stops', () => {
    const [a] = forests;
    const e = at(a.i);
    e.state.nodes[a.i] = 3;
    for (let i = 0; i < 20; i++) e.tick();
    // 3 Wood taken, plus what regrew in those 2 seconds.
    expect(e.state.meagan.bag.wood).toBeLessThan(3 + 2);
    expect(e.state.nodes[a.i]).toBeLessThan(1);
  });

  it('grow back to full in their regrow time, and no further', () => {
    const e = new GameEngine({ seed: 1 });
    const [a] = forests;
    e.state.nodes[a.i] = 0;
    for (let i = 0; i < (NODES.forest.regrowSeconds / 2) * 10; i++) e.tick();
    expect(e.state.nodes[a.i]).toBeCloseTo(NODES.forest.stock / 2, 0);
    for (let i = 0; i < NODES.forest.regrowSeconds * 10; i++) e.tick();
    expect(e.state.nodes[a.i]).toBe(NODES.forest.stock);
  });

  it('load full from saves made before they existed', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.nodes[0] = 5;
    expect(deserialize(serialize(e.state))!.state.nodes[0]).toBe(5);
    const raw = JSON.parse(serialize(e.state));
    delete raw.state.nodes;
    expect(deserialize(JSON.stringify(raw))!.state.nodes).toEqual(RESOURCE_NODES.map((n) => NODES[n.kind].stock));
  });
});

describe('the map edges', () => {
  it('have walkable arrival and caravan spots', () => {
    const e = new GameEngine({ seed: 1 });
    for (const p of [...ARRIVAL_SPOTS, ...CARAVAN_SPOTS]) expect(isBlocked(e.nav, p)).toBe(false);
  });
});
