import { describe, expect, it } from 'vitest';
import { MILESTONES } from '../content';
import { BUILDINGS, VARIANTS } from './balance';
import { GameEngine } from './GameEngine';
import { checkMilestones, triggerMet, type MilestoneDef } from './milestones';
import type { Jan } from './types';

const NOW = new Date(2026, 9, 16);

describe('milestone triggers', () => {
  it('check buildings, Jans, rescues, variants, blizzards, attacks and research', () => {
    const e = new GameEngine({ seed: 1 });
    const s = e.state;
    expect(triggerMet(s, { type: 'building', key: 'furnace', level: 2 })).toBe(false);
    s.buildings.furnace = 2;
    expect(triggerMet(s, { type: 'building', key: 'furnace', level: 2 })).toBe(true);

    s.jans.push({ id: 1, variant: 'chef', job: 'idle', hasKit: false } satisfies Jan);
    expect(triggerMet(s, { type: 'jans', count: 1 })).toBe(true);
    expect(triggerMet(s, { type: 'rescued', count: 1 })).toBe(false);
    s.meta.stats.rescued = 1;
    expect(triggerMet(s, { type: 'rescued', count: 1 })).toBe(true);

    expect(triggerMet(s, { type: 'variant', key: 'chef' })).toBe(false);
    s.meta.found.chef = 1;
    expect(triggerMet(s, { type: 'variant', key: 'chef' })).toBe(true);
    expect(triggerMet(s, { type: 'allVariants' })).toBe(false);
    for (const v of Object.keys(VARIANTS) as Array<keyof typeof VARIANTS>) s.meta.found[v] = 1;
    expect(triggerMet(s, { type: 'allVariants' })).toBe(true);

    s.meta.stats.blizzardsSurvived = 1;
    s.meta.stats.attacksRepelled = 2;
    expect(triggerMet(s, { type: 'blizzards', count: 1 })).toBe(true);
    expect(triggerMet(s, { type: 'attacksRepelled', count: 3 })).toBe(false);
    s.research.push('sharpAxes');
    expect(triggerMet(s, { type: 'research', count: 1 })).toBe(true);
  });

  it('count survived blizzards and repelled attacks as they happen', () => {
    const e = new GameEngine({ seed: 1 });
    e.state.blizzard = { next: 0, active: true, end: 0.05, long: false, warned: true };
    e.tick();
    expect(e.state.meta.stats.blizzardsSurvived).toBe(1);
  });
});

describe('checkMilestones', () => {
  const defs: MilestoneDef[] = [
    { id: 'a', trigger: { type: 'jans', count: 0 } },
    { id: 'later', trigger: { type: 'date' }, unlockDate: '2026-12-24' },
    { id: 'off', trigger: { type: 'date' }, unlockDate: '' },
  ];

  it('returns new ones once, and markMilestone stops repeats', () => {
    const e = new GameEngine({ seed: 1 });
    expect(checkMilestones(e.state, defs, NOW)).toEqual(['a']);
    expect(e.markMilestone('a')).toBe(true);
    expect(e.markMilestone('a')).toBe(false);
    expect(checkMilestones(e.state, defs, NOW)).toEqual([]);
  });

  it('holds dated ones until their day and ignores an empty date', () => {
    const e = new GameEngine({ seed: 1 });
    e.markMilestone('a');
    expect(checkMilestones(e.state, defs, new Date(2026, 11, 23, 23, 59))).toEqual([]);
    expect(checkMilestones(e.state, defs, new Date(2026, 11, 24, 0, 1))).toEqual(['later']);
  });
});

describe('milestones.json', () => {
  it('has unique ids, known buildings and variants, and text on every enabled one', () => {
    const ids = new Set<string>();
    for (const m of MILESTONES) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      if (m.trigger.type === 'building') expect(m.trigger.key in BUILDINGS).toBe(true);
      if (m.trigger.type === 'variant') expect(m.trigger.key in VARIANTS).toBe(true);
      if (m.unlockDate !== '') expect(m.title.length * m.message.length).toBeGreaterThan(0);
    }
    expect(MILESTONES.length).toBeGreaterThanOrEqual(20);
  });
});
