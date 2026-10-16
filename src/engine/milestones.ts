// Milestone triggers: pure checks against the state. The definitions (and their text) live in src/content/milestones.json.
import { VARIANTS } from './balance';
import type { BuildingKey, GameState, VariantKey } from './types';

export type MilestoneTrigger =
  | { type: 'building'; key: BuildingKey; level: number }
  | { type: 'jans'; count: number }
  | { type: 'rescued'; count: number }
  | { type: 'variant'; key: VariantKey }
  | { type: 'allVariants' }
  | { type: 'blizzards'; count: number }
  | { type: 'attacksRepelled'; count: number }
  | { type: 'research'; count: number }
  /** Fires once the unlock date has come. */
  | { type: 'date' };

export interface MilestoneDef {
  id: string;
  trigger: MilestoneTrigger;
  /** "YYYY-MM-DD": never fires before this local date. An empty string switches the milestone off. */
  unlockDate?: string;
}

export function triggerMet(s: GameState, t: MilestoneTrigger): boolean {
  switch (t.type) {
    case 'building':
      return s.buildings[t.key] >= t.level;
    case 'jans':
      return s.jans.length >= t.count;
    case 'rescued':
      return s.meta.stats.rescued >= t.count;
    case 'variant':
      return s.meta.found[t.key] > 0;
    case 'allVariants':
      return (Object.keys(VARIANTS) as VariantKey[]).every((v) => s.meta.found[v] > 0);
    case 'blizzards':
      return s.meta.stats.blizzardsSurvived >= t.count;
    case 'attacksRepelled':
      return s.meta.stats.attacksRepelled >= t.count;
    case 'research':
      return s.research.length >= t.count;
    case 'date':
      return true;
  }
}

/** Local midnight of a "YYYY-MM-DD" date, or null if it isn't one. */
function localDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Ids of milestones met now that haven't been shown yet, in definition order. */
export function checkMilestones(s: GameState, defs: MilestoneDef[], now: Date): string[] {
  return defs
    .filter((d) => {
      if (s.meta.milestones.includes(d.id)) return false;
      if (d.unlockDate !== undefined) {
        const from = localDate(d.unlockDate);
        if (!from || now < from) return false;
      }
      return triggerMet(s, d.trigger);
    })
    .map((d) => d.id);
}
