// Jans tab: who's on which job, −/+ to move them by hand, and the Auto-assign switch.
import { buildingName, variantName } from '../../content';
import { AUTO_JOB, JOBS } from '../../engine/balance';
import { foodEaten, janCap, jobRate, jobUnlocked } from '../../engine/economy';
import type { JobKey, VariantKey } from '../../engine/types';
import { engine } from '../../game/runtime';
import { JOB_LABELS, RESOURCE_LABELS, formatRate } from '../format';
import { h } from './dom';
import type { Screen } from './Shell';

const JOB_ORDER: JobKey[] = ['chop', 'hunt', 'build', 'research', 'scavenge', 'guard'];

export function jansScreen(): Screen {
  const body = h('div');
  const el = h('section', {}, h('h1', {}, 'Jans'), body);
  let sig = '';
  let notice = '';

  /** Run a hand move; if it switched Auto-assign off, say so. */
  const move = (act: () => boolean): void => {
    const wasAuto = engine.state.autoAssign;
    if (act() && wasAuto) notice = "Auto-assign is off — you're choosing jobs by hand.";
    refresh();
  };

  function refresh(): void {
    const s = engine.state;
    const rows = JOB_ORDER.map((job) => {
      const variants: Partial<Record<VariantKey, number>> = {};
      for (const j of s.jans) if (j.job === job) variants[j.variant] = (variants[j.variant] ?? 0) + 1;
      return { job, open: jobUnlocked(s, job), rate: formatRate(jobRate(s, job)), variants };
    });
    const idle = s.jans.filter((j) => j.job === 'idle').length;
    const hunted = jobRate(s, 'hunt') * 60;
    const eaten = foodEaten(s) * 60;
    const auto = { on: s.autoAssign, can: engine.canAutoAssign() };
    const next = JSON.stringify([rows, idle, s.jans.length, janCap(s), Math.round(hunted), Math.round(eaten), auto, notice]);
    if (next === sig) return;
    sig = next;

    body.replaceChildren(
      h(
        'div',
        {},
        h('p', {}, `${s.jans.length} of ${janCap(s)} Jans · ${idle} idle`),
        h(
          'p',
          { class: hunted < eaten ? 'warn' : '' },
          `Food: +${formatRate(hunted)}/min hunted · −${formatRate(eaten)}/min eaten`,
        ),
        h(
          'div',
          { class: 'auto-row' },
          h(
            'button',
            {
              class: `btn ${auto.on ? 'primary' : ''}`,
              disabled: !auto.can,
              onclick: () => {
                engine.setAutoAssign(!engine.state.autoAssign);
                notice = '';
                refresh();
              },
            },
            `Auto-assign: ${auto.on ? 'On' : 'Off'}`,
          ),
          h('span', { class: 'hint' }, auto.can ? 'Keeps everyone on the jobs that need them' : `Unlocks at Furnace Lv ${AUTO_JOB.unlockFurnace}`),
        ),
        notice ? h('p', { class: 'note' }, notice) : null,
        idle > 0 ? h('div', { class: 'job-row idle' }, h('div', { class: 'job-info' }, h('b', {}, 'Idle')), h('div', { class: 'count' }, String(idle))) : null,
        ...rows.map((r) => jobRow(r.job, r.open, r.rate, r.variants)),
      ),
    );
  }

  function jobRow(job: JobKey, open: boolean, rate: string, variants: Partial<Record<VariantKey, number>>): HTMLElement {
    const s = engine.state;
    const building = JOBS[job].building;
    const n = Object.values(variants).reduce((a, b) => a + (b ?? 0), 0);
    const resource = JOBS[job].resource;
    const detail = open
      ? `${buildingName(building)} Lv ${s.buildings[building]}${resource ? ` · ${rate} ${RESOURCE_LABELS[resource]}/s` : ''}`
      : `Build a ${buildingName(building)}`;
    const pills = (Object.entries(variants) as Array<[VariantKey, number]>).map(([v, c]) => h('span', { class: 'pill' }, `${variantName(v)} ×${c}`));
    return h(
      'div',
      { class: `job-row ${open ? '' : 'locked'}` },
      h('div', { class: 'job-info' }, h('b', {}, JOB_LABELS[job]), h('div', { class: 'detail' }, detail), pills.length ? h('div', { class: 'pills' }, ...pills) : null),
      h(
        'div',
        { class: 'stepper' },
        h('button', { class: 'btn step', 'aria-label': `Fewer on ${JOB_LABELS[job]}`, disabled: n === 0, onclick: () => move(() => engine.removeFromJob(job)) }, '−'),
        h('div', { class: 'count' }, String(n)),
        h('button', { class: 'btn step', 'aria-label': `More on ${JOB_LABELS[job]}`, disabled: !open, onclick: () => move(() => engine.addToJob(job)) }, '+'),
      ),
    );
  }

  return { el, refresh };
}
