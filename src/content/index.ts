// Typed access to the player-facing writing in src/content/*.json.
import type { BuildingKey, VariantKey } from '../engine/types';
import buildings from './buildings.json';
import jans from './jans.json';

export function buildingName(key: BuildingKey): string {
  return (buildings as Record<BuildingKey, { name: string }>)[key].name;
}

const JANS = jans as Record<VariantKey, { name: string; bonus: string }>;

export function variantName(v: VariantKey): string {
  return JANS[v].name;
}

export function variantBonus(v: VariantKey): string {
  return JANS[v].bonus;
}
