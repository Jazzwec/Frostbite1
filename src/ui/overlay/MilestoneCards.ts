// Milestone cards: once a second, check the milestones in content, record new ones, and pop them one at a time.
import { MILESTONES, type Milestone } from '../../content';
import { checkMilestones } from '../../engine/milestones';
import { engine } from '../../game/runtime';
import { h } from './dom';

const CHECK_MS = 1000;
/** A card closes itself after this long if not tapped. */
const AUTO_CLOSE_MS = 9000;

export class MilestoneCards {
  private readonly queue: Milestone[] = [];
  private showing: HTMLElement | null = null;
  private timer = 0;

  constructor(
    private readonly layer: HTMLElement,
    /** Called as each card appears (for the sound). */
    private readonly onShow: (m: Milestone) => void = () => {},
  ) {
    window.setInterval(() => this.check(), CHECK_MS);
  }

  private check(): void {
    if (engine.isPaused) return;
    for (const id of checkMilestones(engine.state, MILESTONES, new Date())) {
      if (!engine.markMilestone(id)) continue;
      const m = MILESTONES.find((x) => x.id === id);
      if (m) this.queue.push(m);
    }
    if (!this.showing) this.next();
  }

  private next(): void {
    const m = this.queue.shift();
    if (!m) return;
    this.showing = h(
      'div',
      { class: 'card-pop', role: 'status', onclick: () => this.close() },
      h('div', { class: 'card-kicker' }, '★ Milestone'),
      h('b', {}, m.title),
      h('p', {}, m.message),
      h('div', { class: 'hint' }, 'Tap to close'),
    );
    this.layer.append(this.showing);
    this.onShow(m);
    this.timer = window.setTimeout(() => this.close(), AUTO_CLOSE_MS);
  }

  private close(): void {
    window.clearTimeout(this.timer);
    this.showing?.remove();
    this.showing = null;
    window.setTimeout(() => this.next(), 300);
  }
}
