// Build tab: every building with its level, effect, next cost and delivery progress, and a Go button that sends
// Meagan there (building itself happens on the map by carrying). A switch at the top shows the Research tree.
import { buildingEffect, buildingName, researchDescription, researchName } from '../../content';
import { BUILDINGS, GEAR, RESEARCH, type ResearchKey } from '../../engine/balance';
import { canAfford, gearCost, isUnlocked, kitCost, nextCost, researchCost, type Cost } from '../../engine/economy';
import { siteIndexOf } from '../../engine/map';
import type { BuildingKey, GearKey, StoredResource } from '../../engine/types';
import { engine } from '../../game/runtime';
import { RESOURCE_LABELS, formatCost, formatNumber } from '../format';
import { fill, h } from './dom';
import type { Screen } from './Shell';

type Group = 'placed' | 'buildable' | 'locked';
const GROUP_ORDER: Group[] = ['placed', 'buildable', 'locked'];
type Mode = 'buildings' | 'research';

export function buildScreen(close: () => void): Screen {
  let mode: Mode = 'buildings';
  const tabs = h('div', { class: 'segmented' });
  const body = h('div');
  const el = h('section', {}, h('h1', {}, 'Build'), tabs, body);
  let sig = '';

  function setMode(m: Mode): void {
    mode = m;
    sig = '';
    refresh();
  }

  function refresh(): void {
    tabs.replaceChildren(
      h('button', { class: `seg ${mode === 'buildings' ? 'on' : ''}`, onclick: () => setMode('buildings') }, 'Buildings'),
      h('button', { class: `seg ${mode === 'research' ? 'on' : ''}`, onclick: () => setMode('research') }, 'Research'),
    );
    if (mode === 'buildings') renderBuildings();
    else renderResearch();
  }

  function renderBuildings(): void {
    const s = engine.state;
    const freePlot = engine.nearestFreePlot() >= 0;
    const rows = (Object.keys(BUILDINGS) as BuildingKey[]).map((key) => {
      const site = siteIndexOf(s, key);
      const group: Group = site >= 0 ? 'placed' : isUnlocked(s, key) ? 'buildable' : 'locked';
      const level = s.buildings[key];
      const maxed = level >= BUILDINGS[key].max;
      const cost = nextCost(s, key);
      const progress = site >= 0 && s.sites[site].upgrading ? s.sites[site].progress : null;
      return { key, site, group, level, maxed, cost, progress };
    });
    rows.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    // Gear buttons depend on what's in the piles, so the Barracks adds them to the signature.
    const armoury = s.buildings.barracks > 0 ? [s.gear, s.resources, s.jans.filter((j) => j.job === 'guard').map((j) => j.hasKit)] : null;
    const next = JSON.stringify(['b', rows.map((r) => [r.key, r.group, r.level, r.cost, r.progress && progressText(r.cost, r.progress)]), freePlot, armoury]);
    if (next === sig) return;
    sig = next;

    body.replaceChildren(
      h('p', {}, 'Tap Go and Meagan heads there. Carry what it needs and it builds itself.'),
      ...rows.map((r) => {
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
            r.maxed ? null : h('div', { class: 'cost' }, r.group === 'placed' && r.level > 0 ? `Next level: ${formatCost(r.cost)}` : `Costs ${formatCost(r.cost)}`),
            r.progress ? progressBar(r.cost, r.progress) : null,
            r.key === 'barracks' && r.level > 0 ? armouryBlock() : null,
          ),
          action,
        );
      }),
    );
  }

  function renderResearch(): void {
    const s = engine.state;
    const cost = researchCost(s);
    const knowledge = Math.floor(s.resources.knowledge);
    const next = JSON.stringify(['r', knowledge, s.research]);
    if (next === sig) return;
    sig = next;

    const keys = Object.keys(RESEARCH.nodes) as ResearchKey[];
    const learned = keys.filter((k) => s.research.includes(k));
    fill(
      body,
      h('p', {}, `Knowledge: ${formatNumber(knowledge)} · next discovery costs ${formatNumber(cost)}`),
      s.buildings.researchHut > 0 ? null : h('p', {}, 'Build a Research Hut and put Jans on Research to earn Knowledge.'),
      h('p', {}, `${learned.length} of ${keys.length} learned. Each one makes the next a little dearer.`),
      ...keys.map((k) => {
        const owned = s.research.includes(k);
        return h(
          'div',
          { class: `job-row ${owned ? 'done' : ''}` },
          h('div', { class: 'job-info' }, h('b', {}, researchName(k)), h('div', { class: 'detail' }, researchDescription(k))),
          owned
            ? h('span', { class: 'hint' }, '✓ Learned')
            : h(
                'button',
                {
                  class: 'btn',
                  disabled: knowledge < cost,
                  onclick: () => {
                    engine.buyResearch(k);
                    refresh();
                  },
                },
                'Learn',
              ),
        );
      }),
    );
  }

  /** Weapons, Armour and guard kits, crafted at the Barracks from the piles. */
  function armouryBlock(): HTMLElement {
    const s = engine.state;
    const craft = (label: string, detail: string, can: boolean, act: () => boolean): HTMLElement =>
      h(
        'div',
        { class: 'gear-row' },
        h('div', { class: 'job-info' }, h('div', {}, label), h('div', { class: 'cost' }, detail)),
        h(
          'button',
          {
            class: 'btn',
            disabled: !can,
            onclick: () => {
              act();
              refresh();
            },
          },
          'Craft',
        ),
      );
    const gearRow = (key: GearKey, label: string): HTMLElement => {
      const level = s.gear[key];
      if (level >= GEAR.max) return h('div', { class: 'gear-row' }, h('div', {}, `${label} Lv ${level} · max`));
      const cost = gearCost(level);
      return craft(`${label} Lv ${level} → ${level + 1}`, formatCost(cost), canAfford(s, cost), () => engine.buyGear(key));
    };
    const guards = s.jans.filter((j) => j.job === 'guard');
    const kitted = guards.filter((j) => j.hasKit).length;
    const kit = kitCost(s.gear);
    return h(
      'div',
      { class: 'armoury' },
      gearRow('weapons', 'Weapons'),
      gearRow('armour', 'Armour'),
      craft(
        `Guard kits: ${kitted} of ${guards.length} guards`,
        guards.length > kitted ? formatCost(kit) : 'Every guard has one',
        guards.length > kitted && canAfford(s, kit),
        () => engine.buyKit(),
      ),
    );
  }

  /** Go closes the screen so you can watch her walk. */
  function goButton(go: () => boolean): HTMLElement {
    return h('button', { class: 'btn primary', onclick: () => go() && close() }, 'Go');
  }

  return { el, refresh };
}

function progressText(cost: Cost, progress: Partial<Record<StoredResource, number>>): string {
  return (Object.entries(cost) as Array<[StoredResource, number]>)
    .map(([r, v]) => `${formatNumber(Math.min(v, progress[r] ?? 0))}/${formatNumber(v)} ${RESOURCE_LABELS[r]}`)
    .join(' · ');
}

function progressBar(cost: Cost, progress: Partial<Record<StoredResource, number>>): HTMLElement {
  let have = 0;
  let need = 0;
  for (const [r, v] of Object.entries(cost) as Array<[StoredResource, number]>) {
    have += Math.min(v, progress[r] ?? 0);
    need += v;
  }
  const pct = need > 0 ? Math.round((have / need) * 100) : 100;
  return h(
    'div',
    { class: 'progress' },
    h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width: ${pct}%` })),
    h('div', { class: 'detail' }, `Delivered ${progressText(cost, progress)}`),
  );
}
