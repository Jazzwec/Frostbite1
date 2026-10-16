// Player-facing number and cost formatting.
import type { Cost } from '../engine/economy';
import type { Assignment, ResourceKey } from '../engine/types';

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

/** Per-second rates: 0.45 → "0.5", 2.4 → "2.4", 12.3 → "12", 4567 → "4.5K". */
export function formatRate(n: number): string {
  return n < 10 ? (Math.round(n * 10) / 10).toString() : formatNumber(n);
}

/** How long she was away: "a moment", "12 minutes", "2 hours 5 minutes", "3 days". */
export function formatAway(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'a moment';
  const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (min < 60) return plural(min, 'minute');
  const hours = Math.floor(min / 60);
  if (hours < 24) return min % 60 ? `${plural(hours, 'hour')} ${plural(min % 60, 'minute')}` : plural(hours, 'hour');
  return plural(Math.floor(hours / 24), 'day');
}

/** 150 → "2:30". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  wood: 'Wood',
  food: 'Food',
  materials: 'Mat',
  knowledge: 'Know',
};

export const JOB_LABELS: Record<Assignment, string> = {
  chop: 'Chopping',
  hunt: 'Hunting',
  build: 'Building',
  research: 'Research',
  scavenge: 'Scavenging',
  guard: 'Guarding',
  idle: 'Idle',
};

/** { wood: 40, materials: 5 } → "40 Wood · 5 Mat". */
export function formatCost(cost: Cost): string {
  return (Object.entries(cost) as Array<[ResourceKey, number]>)
    .map(([k, v]) => `${formatNumber(v)} ${RESOURCE_LABELS[k]}`)
    .join(' · ');
}
