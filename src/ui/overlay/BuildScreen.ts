// Build tab: every building with its level, effect, next cost and delivery progress, and a Go button that sends
// Meagan there. Building itself still happens on the map by carrying.
import { buildingEffect, buildingName } from '../../content';
import { BUILDINGS } from '../../engine/balance';
import { buildingCost, isUnlocked } from '../../engine/economy';
import { siteIndexOf } from '../../engine/map';
import type { BuildingKey, StoredResource } from '../../engine/types';
import { engine } from '../../game/runtime';
import { RESOURCE_LABELS, formatCost, formatNumber } from '../format';
import { h } from './dom';
import type { Screen } from './Shell';

type Group = 'placed' | 'buildable' | 'locked';
const GROUP_ORDER: Group[] = ['placed', 'buildable', 'locked'];

export function buildScreen(close: () => void): Screen {
  const body = h('div');
  const el = h('section', {}, h('h1', {}, 'Build'), body);
  let sig = '';

  function refresh(): void {
    const s = engine.state;
    const freePlot = engine.nearestFreePlot() >= 0;
    const rows = (Object.keys(BUILDINGS) as BuildingKey[]).map((key) => {
      const site = siteIndexOf(s, key);
      const group: Group = site >= 0 ? 'placed' : isUnlocked(s, key) ? 'buildable' : 'locked';
      const level = s.buildings[key];
      const maxed = level >= BUILDINGS[key].max;
      const progress = site >= 0 && s.sites[site].upgrading ? s.sites[site].progress : null;
      return { key, site, group, level, maxed, progress };
    });
    rows.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    const next = JSON.stringify([rows.map((r) => [r.key, r.group, r.level, r.progress && progressText(r.key, r.level, r.progress)]), freePlot]);
    if (next === sig) return;
    sig = next;

    body.replaceChildren(
      h('p', {}, 'Tap Go and Meagan heads there. Carry what it needs and it builds itself.'),
      ...rows.map((r) => {
        const cost = buildingCost(r.key, r.level);
        let action: HTMLElement;
        if (r.group === 'locked') action = h('span', { class: 'hint' }, `Furnace Lv ${BUILDINGS[r.key].unlockFurnace}`);
        else if (r.maxed) action = h('span', { class: 'hint' }, 'Max level');
        else if (r.group === 'placed') action = goButton(() => engine.tapSite(r.site));
        else action = freePlot ? goButton(() => engine.goBuild(r.key)) : h('span', { class: 'hint' }, 'No free plot');

        const status =
          r.group === 'placed' ? `Lv ${r.level}/${BUILDINGS[r.key].max}${r.level === 0 ? ' · under construction' : ''}` : 'Not built';
        return h(
          'div',
          { class: `job-row ${r.group === 'locked' ? 'locked' : ''}` },
          h(
            'div',
            { class: 'job-info' },
            h('b', {}, buildingName(r.key)),
            h('div', { class: 'detail' }, status),
            h('div', { class: 'detail' }, buildingEffect(r.key)),
            r.maxed ? null : h('div', { class: 'cost' }, r.group === 'placed' && r.level > 0 ? `Next level: ${formatCost(cost)}` : `Costs ${formatCost(cost)}`),
            r.progress ? progressBar(r.key, r.level, r.progress) : null,
          ),
          action,
        );
      }),
    );
  }

  /** Go closes the screen so you can watch her walk. */
  function goButton(go: () => boolean): HTMLElement {
    return h('button', { class: 'btn primary', onclick: () => go() && close() }, 'Go');
  }

  return { el, refresh };
}

function progressText(key: BuildingKey, level: number, progress: Partial<Record<StoredResource, number>>): string {
  return (Object.entries(buildingCost(key, level)) as Array<[StoredResource, number]>)
    .map(([r, v]) => `${formatNumber(Math.min(v, progress[r] ?? 0))}/${formatNumber(v)} ${RESOURCE_LABELS[r]}`)
    .join(' · ');
}

function progressBar(key: BuildingKey, level: number, progress: Partial<Record<StoredResource, number>>): HTMLElement {
  let have = 0;
  let need = 0;
  for (const [r, v] of Object.entries(buildingCost(key, level)) as Array<[StoredResource, number]>) {
    have += Math.min(v, progress[r] ?? 0);
    need += v;
  }
  const pct = need > 0 ? Math.round((have / need) * 100) : 100;
  return h(
    'div',
    { class: 'progress' },
    h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width: ${pct}%` })),
    h('div', { class: 'detail' }, `Delivered ${progressText(key, level, progress)}`),
  );
}
