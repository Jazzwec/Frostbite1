// Minimal PNG tools for the art pipeline (Node built-ins only): read 8-bit RGB/RGBA, crop to visible pixels,
// shrink with area averaging, write RGBA.
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Decode an 8-bit, non-interlaced RGB or RGBA PNG to RGBA pixels. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG.');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const depth = buf[24];
  const type = buf[25];
  const interlace = buf[28];
  if (depth !== 8 || (type !== 6 && type !== 2) || interlace !== 0) throw new Error(`Unsupported PNG (depth ${depth}, type ${type}).`);
  const chunks = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') chunks.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const bpp = type === 6 ? 4 : 3;
  const stride = width * bpp;
  const rows = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rows[y * stride + x - bpp] : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? rows[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rows[y * stride + x] = v & 255;
    }
  }
  if (bpp === 4) return { width, height, data: rows };
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rows[i * 3];
    data[i * 4 + 1] = rows[i * 3 + 1];
    data[i * 4 + 2] = rows[i * 3 + 2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** Crop to the box around pixels with alpha above `cutoff`, plus `pad` px of margin. */
export function cropToContent(img, cutoff = 8, pad = 2) {
  const { width, height, data } = img;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= cutoff) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return img;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) data.copy(out, y * w * 4, ((y0 + y) * width + x0) * 4, ((y0 + y) * width + x0 + w) * 4);
  return { width: w, height: h, data: out };
}

/** Shrink so the longer side is at most `max`, averaging with premultiplied alpha (no dark fringes). */
export function shrinkTo(img, max) {
  const { width, height, data } = img;
  const scale = Math.min(1, max / Math.max(width, height));
  if (scale === 1) return img;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = Buffer.alloc(w * h * 4);
  for (let oy = 0; oy < h; oy++) {
    const sy0 = Math.floor((oy * height) / h);
    const sy1 = Math.max(sy0 + 1, Math.floor(((oy + 1) * height) / h));
    for (let ox = 0; ox < w; ox++) {
      const sx0 = Math.floor((ox * width) / w);
      const sx1 = Math.max(sx0 + 1, Math.floor(((ox + 1) * width) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * width + sx) * 4;
          const al = data[i + 3];
          r += data[i] * al;
          g += data[i + 1] * al;
          b += data[i + 2] * al;
          a += al;
          n++;
        }
      }
      const o = (oy * w + ox) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round(a / n);
    }
  }
  return { width: w, height: h, data: out };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

/** Encode RGBA pixels as a PNG (Sub filter on every row, maximum compression). */
export function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 1; // Sub
    for (let x = 0; x < stride; x++) {
      const v = data[y * stride + x];
      const left = x >= 4 ? data[y * stride + x - 4] : 0;
      raw[y * (stride + 1) + 1 + x] = (v - left) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Crop and shrink a generated PNG for the game. */
export function prepareArt(png, maxSize) {
  return encodePng(shrinkTo(cropToContent(decodePng(png)), maxSize));
}
