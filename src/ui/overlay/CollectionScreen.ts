// Collection tab: every kind of Jan, met ones in colour with their bio, the rest as silhouettes with an unlock hint.
import { buildingName, variantBio, variantBonus, variantName } from '../../content';
import { VARIANTS } from '../../engine/balance';
import type { VariantKey } from '../../engine/types';
import { engine } from '../../game/runtime';
import { h } from './dom';
import { janPortrait } from './portrait';
import type { Screen } from './Shell';

const ORDER: VariantKey[] = ['plain', 'chef', 'spreadsheet', 'lumberjack', 'sleepy', 'keys', 'dj'];

export function collectionScreen(): Screen {
  const body = h('div');
  const el = h('section', {}, h('h1', {}, 'Collection'), body);
  let sig = '';

  function refresh(): void {
    const s = engine.state;
    const here: Partial<Record<VariantKey, number>> = {};
    for (const j of s.jans) here[j.variant] = (here[j.variant] ?? 0) + 1;
    const next = JSON.stringify([s.meta.found, s.meta.stats.rescued, here]);
    if (next === sig) return;
    sig = next;

    const seen = ORDER.filter((v) => s.meta.found[v] > 0).length;
    body.replaceChildren(
      h('p', {}, `${seen} of ${ORDER.length} kinds of Jan found · ${s.meta.stats.rescued} rescued in all`),
      h(
        'div',
        { class: 'grid2' },
        ...ORDER.map((v) => {
          const met = s.meta.found[v];
          const portrait = h('div', { class: 'portrait' });
          portrait.innerHTML = janPortrait(v, met > 0); // static SVG built from theme colours
          if (met === 0) {
            return h('div', { class: 'jan-card unfound' }, portrait, h('b', {}, '???'), h('div', { class: 'hint' }, unlockHint(v)));
          }
          const now = here[v] ?? 0;
          return h(
            'div',
            { class: 'jan-card' },
            portrait,
            h('b', {}, variantName(v)),
            h('div', { class: 'bonus' }, variantBonus(v)),
            h('p', {}, variantBio(v)),
            h('div', { class: 'hint' }, `Met × ${met}${now > 0 ? ` · ${now} here now` : ''}`),
          );
        }),
      ),
    );
  }

  return { el, refresh };
}

/** "Arrives once there's a Kitchen", "Arrives from Furnace Lv 4", "Arrives once the Lumber Yard is Lv 2". */
function unlockHint(v: VariantKey): string {
  const { building, level } = VARIANTS[v].unlock;
  if (building === 'furnace') return `Arrives from Furnace Lv ${level}`;
  if (level <= 1) return `Arrives once there's a ${buildingName(building)}`;
  return `Arrives once the ${buildingName(building)} is Lv ${level}`;
}
