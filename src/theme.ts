// Palette from the prototype: daylight snow and ice, with the furnace ember as the only warm colour.
export const COLOURS = {
  sky: 0xc9dbe7,
  snow: 0xe4ecf2,
  snowDeep: 0xd3dfe8,
  ice: 0xf5f9fb,
  line: 0xc6d4df,
  ink: 0x1a2938,
  slate: 0x586a7c,
  stone: 0x6f8193,
  frost: 0x3a86a6,
  frostSoft: 0x8fc2da,
  ember: 0xdd5b1a,
  emberDeep: 0xb8460f,
  emberGlow: 0xf6b04a,
  pine: 0x2f5d50,
  timber: 0x8b5e3c,
  skin: 0xf1c7a1,
  hair: 0x6b3f2a,
  parka: 0x3a86a6,
  danger: 0xd9534f,
} as const;

/** Roof colours for placeholder buildings, picked per building. */
export const ROOFS = [0xb8460f, 0x3a86a6, 0x586a7c, 0x8b5e3c, 0x2f5d50, 0x9b4f8f] as const;

export const CSS = {
  ink: '#1A2938',
  ice: '#F5F9FB',
  ember: '#DD5B1A',
  slate: '#586A7C',
  snow: '#E4ECF2',
} as const;

export const FONT = "'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, -apple-system, sans-serif";

/** Logical game size: an iPhone (390×844) at 2× so shapes and text stay crisp on Retina. */
export const GAME_WIDTH = 780;
export const GAME_HEIGHT = 1688;
