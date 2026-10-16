// Player-facing number and cost formatting.
import type { Cost } from '../engine/economy';
import type { ResourceKey } from '../engine/types';

const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/** 999 → "999", 1234 → "1.2K", 3_400_000 → "3.4M". */
export function formatNumber(n: number): string {
  let v = Math.floor(n);
  let i = 0;
  while (Math.abs(v) >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i++;
  }
  return i === 0 ? String(v) : `${(Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, '')}${SUFFIXES[i]}`;
}

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  wood: 'Wood',
  food: 'Food',
  materials: 'Mat',
  knowledge: 'Know',
};

/** { wood: 40, materials: 5 } → "40 Wood · 5 Mat". */
export function formatCost(cost: Cost): string {
  return (Object.entries(cost) as Array<[ResourceKey, number]>)
    .map(([k, v]) => `${formatNumber(v)} ${RESOURCE_LABELS[k]}`)
    .join(' · ');
}
