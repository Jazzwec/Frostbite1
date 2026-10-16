// Placeholder Jan portraits as inline SVG: the canvas JanSprite's look, head and shoulders, one accessory per variant.
import type { VariantKey } from '../../engine/types';
import { COLOURS } from '../../theme';

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** An SVG string for the Collection card; `found = false` gives a flat silhouette of the same shape. */
export function janPortrait(v: VariantKey, found: boolean): string {
  const ink = hex(COLOURS.ink);
  const shade = hex(COLOURS.slate);
  const c = (colour: number): string => (found ? hex(colour) : shade);
  const line = found ? `stroke="${ink}" stroke-width="4" stroke-linejoin="round"` : '';

  const coat = v === 'lumberjack' ? c(COLOURS.danger) : c(COLOURS.timber);
  const checks =
    found && v === 'lumberjack'
      ? `<path d="M36 92v40M52 86v46M68 86v46M84 92v40M22 104h76M22 118h76" stroke="${ink}" stroke-width="2" opacity="0.45"/>`
      : '';

  let hat: string;
  if (v === 'chef') {
    hat = `<rect x="38" y="4" width="44" height="30" rx="14" fill="${c(COLOURS.ice)}" ${line}/>
           <rect x="36" y="28" width="48" height="12" rx="4" fill="${c(COLOURS.ice)}" ${line}/>`;
  } else if (v === 'sleepy') {
    hat = `<path d="M33 42 Q55 2 100 28 L90 42 Z" fill="${c(COLOURS.frostSoft)}" ${line}/>
           <circle cx="100" cy="28" r="7" fill="${c(COLOURS.ice)}" ${line}/>`;
  } else {
    hat = `<rect x="33" y="28" width="54" height="20" rx="9" fill="${c(COLOURS.frost)}" ${line}/>
           <circle cx="60" cy="25" r="7" fill="${c(COLOURS.ice)}" ${line}/>`;
  }

  let face = '';
  if (found) {
    face =
      v === 'sleepy'
        ? `<path d="M64 57 q6 5 12 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
        : `<circle cx="70" cy="56" r="3.2" fill="${ink}"/>`;
    if (v === 'spreadsheet') {
      face += `<g fill="none" stroke="${ink}" stroke-width="3"><circle cx="52" cy="56" r="9"/><circle cx="72" cy="56" r="9"/><path d="M61 56h2"/></g>`;
    }
  }

  const headphones =
    v === 'dj'
      ? `<path d="M34 62 Q34 28 60 28 Q86 28 86 62" fill="none" stroke="${found ? ink : shade}" stroke-width="5"/>
         <rect x="27" y="54" width="12" height="20" rx="5" fill="${c(COLOURS.ember)}" ${line}/>
         <rect x="81" y="54" width="12" height="20" rx="5" fill="${c(COLOURS.ember)}" ${line}/>`
      : '';

  const key =
    v === 'keys'
      ? `<g ${found ? '' : 'opacity="0"'}><circle cx="40" cy="100" r="7" fill="none" stroke="${hex(COLOURS.emberGlow)}" stroke-width="4"/>
         <path d="M47 100h14v6M56 100v5" fill="none" stroke="${hex(COLOURS.emberGlow)}" stroke-width="4"/></g>`
      : '';

  return `<svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="18" y="84" width="84" height="56" rx="26" fill="${coat}" ${line}/>
    ${checks}
    <circle cx="60" cy="60" r="26" fill="${c(COLOURS.skin)}" ${line}/>
    <ellipse cx="62" cy="76" rx="20" ry="11" fill="${c(COLOURS.hair)}"/>
    ${face}
    ${hat}
    ${headphones}
    ${key}
  </svg>`;
}
