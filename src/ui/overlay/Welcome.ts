// The card on launch: a welcome back with the city's state, or a first-time hello. Both carry a survival tip.
import { MESSAGES, tip } from '../../content';
import { heatCap, janCap } from '../../engine/economy';
import { engine } from '../../game/runtime';
import { formatAway, formatClock } from '../format';
import { h } from './dom';

export function showWelcome(layer: HTMLElement, lastSeen: number | null): void {
  const s = engine.state;
  const close = (): void => card.remove();
  const lines: Array<HTMLElement | null> =
    lastSeen === null
      ? [
          h('b', {}, 'Keep the fire going, Meagan'),
          h('p', {}, 'Tap the forest to gather Wood, then tap the furnace to feed it. Frozen Jans will wander in. Go and thaw them.'),
        ]
      : [
          h('b', {}, 'Welcome back, Meagan'),
          h('p', {}, `You were away ${formatAway(Date.now() - lastSeen)}. ${MESSAGES.welcomeBack}`),
          h('p', {}, `Heat ${Math.round((s.heat / heatCap(s)) * 100)}% · ${s.jans.length} of ${janCap(s)} Jans`),
          h('p', {}, s.blizzard.active ? 'A blizzard is blowing right now!' : `Next blizzard in about ${formatClock(s.blizzard.next - s.t)}.`),
        ];
  const card = h(
    'div',
    { class: 'card-pop welcome' },
    h('div', { class: 'card-kicker' }, lastSeen === null ? 'Frostbite' : '❄ Welcome back'),
    ...lines,
    h('p', { class: 'tip' }, `Tip: ${tip()}`),
    h('button', { class: 'btn primary', onclick: close }, lastSeen === null ? "Let's go" : 'Back to the fire'),
  );
  layer.append(card);
}
