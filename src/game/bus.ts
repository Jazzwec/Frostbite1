// Engine events fan out to the HTML overlays and the sound, after CityScene drains them each frame.
import type { EngineEvent } from '../engine/types';

type Listener = (e: EngineEvent) => void;
const listeners: Listener[] = [];

export const bus = {
  on(fn: Listener): void {
    listeners.push(fn);
  },
  emit(e: EngineEvent): void {
    for (const fn of listeners) fn(e);
  },
};
