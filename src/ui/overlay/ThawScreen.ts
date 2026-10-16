// The thaw: a short cutscene, the tokens earned, choosing Veterans, the Warmth Token shop, then A New Winter.
import { MESSAGES, shopDescription, shopName, variantName } from '../../content';
import { SHOP } from '../../engine/balance';
import { canBuyShop, thawTokens, veteranSlots } from '../../engine/prestige';
import type { Jan, ShopKey, VariantKey } from '../../engine/types';
import { engine } from '../../game/runtime';
import { fill, h } from './dom';
import type { Screen } from './Shell';

type Step = { kind: 'story'; line: number } | { kind: 'veterans' } | { kind: 'shop' };

export function thawScreen(close: () => void): Screen {
  const body = h('div');
  const el = h('section', { class: 'thaw' }, body);
  // Reopening after the tokens were banked skips the story.
  let step: Step = engine.state.thawed ? { kind: 'veterans' } : { kind: 'story', line: 0 };
  let earned = engine.state.thawed ? 0 : thawTokens(engine.state);
  /** How many Veterans of each variant she has picked. */
  const picks: Partial<Record<VariantKey, number>> = {};

  const go = (next: Step): void => {
    step = next;
    render();
  };
  const pick = (v: VariantKey, n: number): void => {
    picks[v] = n;
    render();
  };
  const buy = (key: ShopKey): void => {
    engine.buyShop(key);
    render();
  };

  function render(): void {
    if (step.kind === 'story') renderStory(step.line);
    else if (step.kind === 'veterans') renderVeterans();
    else renderShop();
  }

  function renderStory(line: number): void {
    const last = line >= MESSAGES.thaw.length - 1;
    fill(
      body,
      h('div', { class: 'card-kicker' }, '☀ The thaw'),
      ...MESSAGES.thaw.slice(0, line + 1).map((t) => h('p', { class: 'story' }, t)),
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () => {
            if (!last) return go({ kind: 'story', line: line + 1 });
            earned = engine.claimThaw() || earned;
            go({ kind: 'veterans' });
          },
        },
        last ? 'Gather everyone' : 'Next',
      ),
    );
  }

  function chosenIds(): number[] {
    const s = engine.state;
    const ids: number[] = [];
    for (const [v, n] of Object.entries(picks) as Array<[VariantKey, number]>) {
      // Existing Veterans first, so promoting the same Jan again doesn't count him twice.
      const pool = s.jans.filter((j) => j.variant === v).sort((a, b) => Number(!!b.veteran) - Number(!!a.veteran));
      ids.push(...pool.slice(0, n).map((j) => j.id));
    }
    return ids;
  }

  function renderVeterans(): void {
    const s = engine.state;
    const slots = veteranSlots(s);
    const picked = Object.values(picks).reduce((a, b) => a + (b ?? 0), 0);
    const byVariant = new Map<VariantKey, Jan[]>();
    for (const j of s.jans) byVariant.set(j.variant, [...(byVariant.get(j.variant) ?? []), j]);
    fill(
      body,
      h('h1', {}, 'A New Winter'),
      h('p', {}, earned > 0 ? `This winter earned ${earned} Warmth Tokens. You have ${s.meta.tokens}.` : `You have ${s.meta.tokens} Warmth Tokens.`),
      h('h2', {}, `Choose Veterans (${picked} of ${slots})`),
      h('p', {}, 'Veterans come with Meagan into the next winter, keep their knack, and add 5% to everything.'),
      ...[...byVariant.entries()].map(([v, jans]) => {
        const n = picks[v] ?? 0;
        const vets = jans.filter((j) => j.veteran).length;
        return h(
          'div',
          { class: 'job-row' },
          h('div', { class: 'job-info' }, h('b', {}, variantName(v)), h('div', { class: 'detail' }, `${jans.length} in town${vets ? ` · ${vets} already Veterans` : ''}`)),
          h(
            'div',
            { class: 'stepper' },
            h('button', { class: 'btn step', disabled: n === 0, onclick: () => pick(v, n - 1) }, '−'),
            h('div', { class: 'count' }, String(n)),
            h('button', { class: 'btn step', disabled: picked >= slots || n >= jans.length, onclick: () => pick(v, n + 1) }, '+'),
          ),
        );
      }),
      h(
        'div',
        { class: 'row-buttons thaw-actions' },
        h('button', { class: 'btn', onclick: () => go({ kind: 'shop' }) }, `Warmth Token shop (${s.meta.tokens})`),
        h('button', { class: 'btn primary', onclick: startWinter }, 'Start A New Winter'),
      ),
    );
  }

  function renderShop(): void {
    const s = engine.state;
    fill(
      body,
      h('h1', {}, 'Warmth Token shop'),
      h('p', {}, `You have ${s.meta.tokens} Warmth Tokens. Everything here lasts for every winter to come.`),
      ...(Object.keys(SHOP) as ShopKey[]).map((key) => {
        const rank = s.meta.shop[key];
        const maxed = rank >= SHOP[key].maxRank;
        return h(
          'div',
          { class: 'job-row' },
          h(
            'div',
            { class: 'job-info' },
            h('b', {}, shopName(key)),
            h('div', { class: 'detail' }, shopDescription(key)),
            h('div', { class: 'cost' }, maxed ? `Rank ${rank}/${SHOP[key].maxRank} · maxed` : `Rank ${rank}/${SHOP[key].maxRank} · ${SHOP[key].cost} tokens`),
          ),
          maxed
            ? null
            : h('button', { class: 'btn', disabled: !canBuyShop(s, key), onclick: () => buy(key) }, 'Buy'),
        );
      }),
      h('div', { class: 'row-buttons thaw-actions' }, h('button', { class: 'btn primary', onclick: () => go({ kind: 'veterans' }) }, 'Back to Veterans')),
    );
  }

  function startWinter(): void {
    if (!engine.startNewWinter(chosenIds())) return;
    close();
    if (engine.state.meta.winters === 1) firstWinterCard();
  }

  render();
  // The steps change only when she taps, so there's nothing to refresh on a timer.
  return { el, refresh: () => {} };
}

/** The one-off message for the first prestige. */
function firstWinterCard(): void {
  const layer = document.getElementById('ui');
  if (!layer) return;
  const card = h(
    'div',
    { class: 'card-pop', onclick: () => card.remove() },
    h('div', { class: 'card-kicker' }, '❄ Winter two'),
    h('p', {}, MESSAGES.firstPrestige),
    h('div', { class: 'hint' }, 'Tap to close'),
  );
  layer.append(card);
}
