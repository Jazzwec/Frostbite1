// Sound effects synthesised with WebAudio: no audio files, no dependencies. Muting is a per-device preference.
import { bus } from './bus';

const MUTE_KEY = 'frostbite.muted';
const MASTER_GAIN = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let wind: AudioBufferSourceNode | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(on: boolean): void {
  muted = on;
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0');
  } catch {
    // The choice just won't be remembered.
  }
  if (master) master.gain.value = on ? 0 : MASTER_GAIN;
}

/** A short tone with a quick attack and exponential fade; `slideTo` bends the pitch. */
function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, delay = 0, slideTo?: number): void {
  const c = audio();
  if (!c || !master || muted) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** A thump of filtered noise (building, hammering). */
function thud(delay = 0, gain = 0.4): void {
  const c = audio();
  if (!c || !master || muted) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.2);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  thaw: (): void => [660, 880, 1320].forEach((f, i) => tone(f, 0.35, 'triangle', 0.15, i * 0.07)),
  pickup: (): void => tone(900, 0.07, 'square', 0.04, 0, 1300),
  deliver: (): void => tone(520, 0.09, 'triangle', 0.08, 0, 330),
  build: (): void => {
    thud(0);
    thud(0.14);
    tone(392, 0.4, 'triangle', 0.12, 0.28);
  },
  upgrade: (): void => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, i * 0.09)),
  howl: (): void => tone(380, 1.4, 'sawtooth', 0.05, 0, 620),
  milestone: (): void => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, 'sine', 0.14, i * 0.11)),
};

/** The blizzard's wind: looping filtered noise until it ends. */
function startWind(): void {
  const c = audio();
  if (!c || !master || wind) return;
  wind = c.createBufferSource();
  wind.buffer = noiseBuffer(c, 2);
  wind.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 500;
  filter.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0.12;
  wind.connect(filter).connect(g).connect(master);
  wind.start();
}

function stopWind(): void {
  wind?.stop();
  wind = null;
}

/** Hook sounds to engine events, unlock audio on the first tap (iOS rule) and go quiet when hidden. */
export function wireSound(blizzardActive: () => boolean): void {
  const unlock = (): void => {
    const c = audio();
    if (c && c.state !== 'running') void c.resume();
    if (blizzardActive()) startWind();
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
  bus.on((e) => {
    if (e.type === 'rescued') sfx.thaw();
    else if (e.type === 'buildingUpgraded') (e.level === 1 ? sfx.build : sfx.upgrade)();
    else if (e.type === 'attackStart') sfx.howl();
    else if (e.type === 'blizzardStart') startWind();
    else if (e.type === 'blizzardEnd') stopWind();
  });
}
