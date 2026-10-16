// Auto-assign: move Jans between jobs towards jobTargets(), touching as few as possible.
import { AUTO_JOB } from './balance';
import { AUTO_JOBS, jobTargets } from './economy';
import type { GameState, Jan } from './types';

/** Move only the surplus: idle Jans and the newest Jans on over-target jobs go to under-target jobs. Returns moves made. */
export function rebalanceJobs(s: GameState): number {
  const targets = jobTargets(s);
  const spare: Jan[] = s.jans.filter((j) => j.job === 'idle');
  for (const job of AUTO_JOBS) {
    const on = s.jans.filter((j) => j.job === job).sort((a, b) => b.id - a.id);
    spare.push(...on.slice(0, Math.max(0, on.length - targets[job])));
  }
  let moves = 0;
  for (const job of AUTO_JOBS) {
    let short = targets[job] - s.jans.filter((j) => j.job === job).length;
    while (short > 0 && spare.length > 0) {
      const jan = spare.shift()!;
      jan.job = job;
      short--;
      moves++;
    }
  }
  return moves;
}

/** While Auto-assign is on, rebalance every AUTO_JOB.rebalanceSeconds. Guards and scavengers are never touched. */
export function updateAutoAssign(s: GameState, dt: number): void {
  if (!s.autoAssign) return;
  s.autoAssignTimer += dt;
  if (s.autoAssignTimer < AUTO_JOB.rebalanceSeconds) return;
  s.autoAssignTimer = 0;
  rebalanceJobs(s);
}
