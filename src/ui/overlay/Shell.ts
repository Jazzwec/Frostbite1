// The HTML layer over the canvas: city strip, tab bar and the screen host. Reads engine.state; acts only via engine/runtime.
import Phaser from 'phaser';
import { janCap } from '../../engine/economy';
import { engine } from '../../game/runtime';
import { COLOURS, GAME_WIDTH, TAB_BAR_HEIGHT } from '../../theme';
import { formatClock, formatNumber } from '../format';
import { h } from './dom';

export interface Screen {
  /** The screen's root element, built once when the tab opens. */
  readonly el: HTMLElement;
  /** Called about four times a second while open. */
  refresh(): void;
}

export type TabKey = 'city' | 'build' | 'jans' | 'collection' | 'settings';
/** Builds a screen when its tab opens; `close` returns to the city. */
export type ScreenFactory = (close: () => void) => Screen;

const TABS: Array<{ key: TabKey; icon: string; label: string }> = [
  { key: 'city', icon: '🔥', label: 'City' },
  { key: 'build', icon: '🔨', label: 'Build' },
  { key: 'jans', icon: '🧑', label: 'Jans' },
  { key: 'collection', icon: '📖', label: 'Collection' },
  { key: 'settings', icon: '⚙️', label: 'Settings' },
];

const REFRESH_MS = 250;
/** The strip's numbers glide to new values over roughly this long instead of jumping. */
const COUNT_EASE_MS = 180;

type Counted = 'jans' | 'wood' | 'food' | 'materials';

export class Shell {
  private readonly layer: HTMLElement;
  private readonly strip = h('div', { class: 'strip' });
  private readonly counts = h('span');
  private readonly weather = h('span');
  private shown: Record<Counted, number>;
  private countsText = '';
  private lastFrame = 0;
  private readonly tabButtons = new Map<TabKey, HTMLButtonElement>();
  private active: TabKey = 'city';
  private screen: Screen | null = null;

  constructor(
    private readonly game: Phaser.Game,
    private readonly screens: Partial<Record<TabKey, ScreenFactory>>,
  ) {
    this.layer = document.getElementById('ui')!;
    this.setPalette();
    this.strip.append(this.counts, this.weather);
    this.shown = this.actualCounts();
    requestAnimationFrame((t) => this.animate(t));

    const bar = h('nav', { class: 'tabbar', style: `height: calc(var(--u) * ${TAB_BAR_HEIGHT})` });
    for (const t of TABS) {
      const b = h('button', { class: 'tab', onclick: () => this.select(t.key) }, h('span', { class: 'icon' }, t.icon), t.label);
      this.tabButtons.set(t.key, b);
      bar.append(b);
    }
    this.layer.append(this.strip, bar);
    this.markActive();

    // Keep the layer glued to the canvas, wherever FIT scaling puts it.
    const fit = (): void => this.fit();
    const attach = (): void => {
      new ResizeObserver(fit).observe(game.canvas);
      fit();
    };
    if (game.canvas) attach();
    else game.events.once(Phaser.Core.Events.READY, attach);
    game.scale.on(Phaser.Scale.Events.RESIZE, fit);
    window.addEventListener('resize', fit);

    window.setInterval(() => this.refresh(), REFRESH_MS);
    this.refresh();
  }

  /** Open a tab's screen; the City tab (or the open tab again) closes it. */
  select(key: TabKey): void {
    this.screen?.el.remove();
    this.screen = null;
    const factory = this.screens[key];
    if (key === 'city' || key === this.active || !factory) {
      this.active = 'city';
    } else {
      this.active = key;
      this.screen = factory(() => this.select('city'));
      this.screen.el.classList.add('screen');
      this.screen.el.style.bottom = `calc(var(--u) * ${TAB_BAR_HEIGHT})`;
      this.layer.append(this.screen.el);
      this.screen.refresh();
    }
    this.markActive();
  }

  private markActive(): void {
    for (const [key, b] of this.tabButtons) b.classList.toggle('active', key === this.active);
  }

  private fit(): void {
    const r = this.game.canvas.getBoundingClientRect();
    const st = this.layer.style;
    st.left = `${r.left}px`;
    st.top = `${r.top}px`;
    st.width = `${r.width}px`;
    st.height = `${r.height}px`;
    st.setProperty('--u', `${r.width / GAME_WIDTH}px`);
  }

  /** The canvas palette as CSS variables (--ink, --snow-deep, …), so theme.ts stays the one source of colour. */
  private setPalette(): void {
    for (const [k, v] of Object.entries(COLOURS)) {
      const name = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      this.layer.style.setProperty(`--${name}`, `#${v.toString(16).padStart(6, '0')}`);
    }
  }

  private refresh(): void {
    const s = engine.state;
    const bz = s.blizzard;
    const name = bz.long ? 'Long Night' : 'Blizzard';
    if (bz.active) this.setWeather(`❄ ${name}! ${formatClock(bz.end - s.t)} left`, 'blizzard now');
    else if (bz.warned) this.setWeather(`❄ ${name} in ${formatClock(bz.next - s.t)}`, 'blizzard');
    else this.setWeather('', '');
    this.screen?.refresh();
  }

  private setWeather(text: string, cls: string): void {
    if (this.weather.textContent !== text) this.weather.textContent = text;
    if (this.weather.className !== cls) this.weather.className = cls;
  }

  private actualCounts(): Record<Counted, number> {
    const s = engine.state;
    return { jans: s.jans.length, wood: s.resources.wood, food: s.resources.food, materials: s.resources.materials };
  }

  /** Every frame, ease the shown numbers towards the real ones (numbers animate when they change, per the brief). */
  private animate(now: number): void {
    const k = 1 - Math.exp(-(now - this.lastFrame) / COUNT_EASE_MS);
    this.lastFrame = now;
    const actual = this.actualCounts();
    for (const key of Object.keys(actual) as Counted[]) {
      const d = actual[key] - this.shown[key];
      this.shown[key] = Math.abs(d) < 0.5 ? actual[key] : this.shown[key] + d * k;
    }
    const v = this.shown;
    const text = `Jans ${Math.round(v.jans)}/${janCap(engine.state)} · Wood ${formatNumber(v.wood)} · Food ${formatNumber(v.food)} · Mat ${formatNumber(v.materials)}`;
    if (text !== this.countsText) this.counts.textContent = this.countsText = text;
    requestAnimationFrame((t) => this.animate(t));
  }
}
