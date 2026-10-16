// A strip under the city strip for weather and attack news: warnings, starts and ends.
import { MESSAGES, blizzardWarningLine } from '../../content';
import { bus } from '../../game/bus';
import { formatClock } from '../format';
import { h } from './dom';

type Tone = 'cold' | 'alert' | 'calm';
const SHOW_MS = 7000;

export class Banner {
  private readonly el = h('div', { class: 'banner', role: 'status' });
  private timer = 0;

  constructor(layer: HTMLElement) {
    this.el.addEventListener('click', () => this.hide());
    layer.append(this.el);
    bus.on((e) => {
      if (e.type === 'blizzardWarn')
        this.show(`${e.long ? MESSAGES.longNightWarning : blizzardWarningLine()} (${formatClock(e.startsIn)})`, 'cold');
      else if (e.type === 'blizzardStart') this.show(e.long ? MESSAGES.longNightStart : MESSAGES.blizzardStart, 'alert');
      else if (e.type === 'blizzardEnd') this.show(MESSAGES.blizzardEnd, 'calm');
      else if (e.type === 'attackWarn') this.show(`Animals spotted! Here in ${formatClock(e.startsIn)}`, 'alert');
      else if (e.type === 'attackStart') this.show(`${e.animals} animals are coming for the furnace!`, 'alert');
      else if (e.type === 'attackEnd')
        this.show(e.repelled ? 'The animals ran off. Well defended!' : 'The animals got away with some supplies.', 'calm');
    });
  }

  show(text: string, tone: Tone): void {
    window.clearTimeout(this.timer);
    this.el.textContent = text;
    this.el.className = `banner show ${tone}`;
    this.timer = window.setTimeout(() => this.hide(), SHOW_MS);
  }

  private hide(): void {
    this.el.className = 'banner';
  }
}
