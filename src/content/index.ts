// Typed access to the player-facing writing in src/content/*.json.
import type { BuildingKey } from '../engine/types';
import buildings from './buildings.json';

export function buildingName(key: BuildingKey): string {
  return (buildings as Record<BuildingKey, { name: string }>)[key].name;
}
