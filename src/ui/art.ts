// Generated art (src/assets/art/*.png, made by scripts/gen-art.mjs). Every sprite uses its image when one exists and
// falls back to its drawn placeholder shape when it doesn't, so art can arrive one piece at a time.
import Phaser from 'phaser';

/** Every PNG in src/assets/art, found at build time; a missing file simply isn't listed. */
const URLS = import.meta.glob('../assets/art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const key = (id: string): string => `art:${id}`;
/** Frame name for the image cropped to its visible pixels (generated images have empty margins). */
const TRIM = 'trim';
/** Pixels at or below this alpha count as empty when cropping. */
const ALPHA_CUTOFF = 8;

export function preloadArt(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(URLS)) {
    const id = path.split('/').pop()!.replace(/\.png$/, '');
    if (!scene.textures.exists(key(id))) scene.load.image(key(id), url);
  }
}

export function hasArt(scene: Phaser.Scene, id: string): boolean {
  return scene.textures.exists(key(id));
}

/** Add a 'trim' frame to each art texture: the box around its visible pixels. Run once after loading. */
export function trimArt(scene: Phaser.Scene): void {
  for (const tex of scene.textures.getTextureKeys()) {
    if (!tex.startsWith('art:')) continue;
    const texture = scene.textures.get(tex);
    if (texture.has(TRIM)) continue;
    const img = texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] <= ALPHA_CUTOFF) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) texture.add(TRIM, 0, 0, 0, width, height);
    else texture.add(TRIM, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
  }
}

/** Size an art image by height or by width, keeping its proportions. */
export type ArtFit = { height: number } | { width: number };

/** An art image standing on (x, y): bottom-centre origin, cropped, scaled to fit. */
export function artImage(scene: Phaser.Scene, id: string, x: number, y: number, fit: ArtFit): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, key(id), scene.textures.get(key(id)).has(TRIM) ? TRIM : undefined).setOrigin(0.5, 1);
  const scale = 'height' in fit ? fit.height / img.height : fit.width / img.width;
  return img.setScale(scale);
}
