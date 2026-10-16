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

export class Shell {
  private readonly layer: HTMLElement;
  private readonly strip = h('div', { class: 'strip' });
  private readonly tabButtons = new Map<TabKey, HTMLButtonElement>();
  private active: TabKey = 'city';
  private screen: Screen | null = null;

  constructor(
    private readonly game: Phaser.Game,
    private readonly screens: Partial<Record<TabKey, ScreenFactory>>,
  ) {
    this.layer = document.getElementById('ui')!;
    this.setPalette();

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
    const r = s.resources;
    const bz = s.blizzard;
    const name = bz.long ? 'Long Night' : 'Blizzard';
    let weather: HTMLElement | null = null;
    if (bz.active) weather = h('span', { class: 'blizzard now' }, `❄ ${name}! ${formatClock(bz.end - s.t)} left`);
    else if (bz.warned) weather = h('span', { class: 'blizzard' }, `❄ ${name} in ${formatClock(bz.next - s.t)}`);
    this.strip.replaceChildren(
      `Jans ${s.jans.length}/${janCap(s)} · Wood ${formatNumber(r.wood)} · Food ${formatNumber(r.food)} · Mat ${formatNumber(r.materials)}`,
      ...(weather ? [weather] : []),
    );
    this.screen?.refresh();
  }
}
