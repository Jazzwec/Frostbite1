// Generates game art, using only Node built-ins. Two backends:
//   --codex   the Codex app's image generation (signed in with ChatGPT; no API key, uses the ChatGPT plan)
//   default   the OpenAI Images API (needs OPENAI_API_KEY)
//
//   npm run art -- --list                 show every asset and whether it exists
//   npm run art -- furnace jan --codex    generate these (skips ones that already exist)
//   npm run art -- jan --redo             regenerate; the old image moves to art/rejects/
//   npm run art -- --missing              generate everything not made yet (respects the budget)
//   npm run art -- --adopt pine <file>    take an image made elsewhere as an asset (counts toward the budget)
//   npm run art -- --shrink               re-crop and re-shrink every asset from its full-size original
//   add --over to go past the budget in art/prompts.json
//
// Images are cropped to their visible pixels and shrunk to at most "maxSize" px (prompts.json) into
// src/assets/art/<id>.png, where the game picks them up. Full-size originals stay in art/originals/ (not committed).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareArt } from './png.mjs';

const ROOT = new URL('../', import.meta.url);
const CONFIG = new URL('art/prompts.json', ROOT);
const LOG = new URL('art/log.json', ROOT);
const OUT = new URL('src/assets/art/', ROOT);
const REJECTS = new URL('art/rejects/', ROOT);
const ORIGINALS = new URL('art/originals/', ROOT);
const API = 'https://api.openai.com/v1/images';

const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
/** The CLI inside the Codex desktop app (override with CODEX_PATH or "codexPath" in prompts.json). */
const CODEX =
  process.env.CODEX_PATH ?? config.codexPath ?? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe');
/** Where Codex keeps the images it generates. */
const CODEX_IMAGES = join(homedir(), '.codex', 'generated_images');
const CODEX_TIMEOUT_MS = 10 * 60 * 1000;
const byId = new Map(config.assets.map((a) => [a.id, a]));
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : { generated: 0, entries: [] };
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const ids = args.filter((a) => !a.startsWith('--'));

const fileFor = (id) => new URL(`${id}.png`, OUT);
const has = (id) => existsSync(fileFor(id));

if (flags.has('--list')) {
  for (const a of config.assets) console.log(`${has(a.id) ? '✓' : '·'} ${a.id}${a.refs ? `  (refs: ${a.refs.join(', ')})` : ''}`);
  console.log(`\n${log.generated} images generated so far; budget ${config.budget}.`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(REJECTS, { recursive: true });
mkdirSync(ORIGINALS, { recursive: true });
const originalFor = (id) => new URL(`${id}.png`, ORIGINALS);

if (flags.has('--shrink')) {
  for (const a of config.assets) {
    // Assets made before originals were kept: their current file is the original.
    if (has(a.id) && !existsSync(originalFor(a.id))) renameSync(fileFor(a.id), originalFor(a.id));
    if (!existsSync(originalFor(a.id))) continue;
    writeFileSync(fileFor(a.id), prepareArt(readFileSync(originalFor(a.id)), config.maxSize));
    console.log(`shrunk ${a.id}`);
  }
  process.exit(0);
}

if (flags.has('--adopt')) {
  const [id, file] = ids;
  if (!byId.has(id) || !file || !existsSync(file)) {
    console.error('Usage: npm run art -- --adopt <asset id> <png file>');
    process.exit(1);
  }
  save(id, readFileSync(file), 'adopted');
  console.log(`adopted ${file} as ${id} (${log.generated}/${config.budget})`);
  process.exit(0);
}

const useCodex = flags.has('--codex');
const key = process.env.OPENAI_API_KEY;
if (useCodex && !existsSync(CODEX)) {
  console.error(`Codex CLI not found at ${CODEX}. Set CODEX_PATH to codex.exe.`);
  process.exit(1);
}
if (!useCodex && !key) {
  console.error('OPENAI_API_KEY is not set. Use --codex, or set the key in your terminal (setx OPENAI_API_KEY "...").');
  process.exit(1);
}

const todo = flags.has('--missing') ? config.assets.filter((a) => !has(a.id)).map((a) => a.id) : ids;
if (todo.length === 0) {
  console.error('Nothing to do. Name asset ids, or use --missing. See --list.');
  process.exit(1);
}

for (const id of todo) {
  const asset = byId.get(id);
  if (!asset) {
    console.error(`Unknown asset "${id}" (not in art/prompts.json).`);
    continue;
  }
  if (has(id) && !flags.has('--redo')) {
    console.log(`skip ${id} (exists; use --redo to replace)`);
    continue;
  }
  if (log.generated >= config.budget && !flags.has('--over')) {
    console.error(`Budget of ${config.budget} images reached. Stopping (use --over to continue).`);
    break;
  }
  const missingRefs = (asset.refs ?? []).filter((r) => !has(r));
  if (missingRefs.length > 0) {
    console.error(`skip ${id}: generate its references first (${missingRefs.join(', ')}).`);
    continue;
  }

  const prompt = `${config.style}\n\n${asset.prompt}`;
  const size = asset.size ?? '1024x1024';
  process.stdout.write(`${id} … `);
  const started = Date.now();
  try {
    let png;
    let model;
    if (useCodex) {
      png = codex(prompt, size, asset.refs ?? []);
      model = 'codex';
    } else {
      png = asset.refs?.length ? await edit(prompt, size, asset.refs) : await generate(prompt, size);
      model = asset.refs?.length ? config.editModel : config.generateModel;
    }
    save(id, png, model, size);
    console.log(`done in ${Math.round((Date.now() - started) / 1000)} s (${log.generated}/${config.budget})`);
  } catch (err) {
    console.log('failed');
    console.error(`  ${err.message}`);
  }
}

/** Keep the full-size original, write the cropped and shrunk game copy, and count it in art/log.json. */
function save(id, png, model, size) {
  if (existsSync(originalFor(id))) renameSync(originalFor(id), new URL(`${id}-${Date.now()}.png`, REJECTS));
  writeFileSync(originalFor(id), png);
  writeFileSync(fileFor(id), prepareArt(png, config.maxSize));
  log.generated++;
  log.entries.push({ id, at: new Date().toISOString(), model, size });
  writeFileSync(LOG, `${JSON.stringify(log, null, 2)}\n`);
}

/**
 * Ask Codex to generate one image (references attached with -i), then take the newest PNG it saved under
 * ~/.codex/generated_images. Codex only generates; it never touches the repo.
 */
function codex(prompt, size, refs) {
  const since = Date.now();
  const [w, h] = size.split('x');
  const instruction = [
    'Use your image generation tool to create exactly ONE image, then reply "done".',
    'Do not run shell commands, write code or create any files yourself.',
    refs.length ? 'The attached image(s) are references: match their art style and, for characters, the same character.' : '',
    `Image size: ${w}x${h} (${Number(w) > Number(h) ? 'landscape' : Number(w) < Number(h) ? 'portrait' : 'square'}).`,
    'Background: fully transparent PNG.',
    '',
    prompt,
  ].join('\n');
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '-C', fileURLToPath(ROOT)];
  for (const r of refs) args.push('-i', fileURLToPath(fileFor(r)));
  args.push('-');
  const run = spawnSync(CODEX, args, { input: instruction, encoding: 'utf8', timeout: CODEX_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 });
  if (run.error) throw new Error(`Codex didn't run: ${run.error.message}`);
  const image = newestImage(CODEX_IMAGES, since);
  if (!image) throw new Error(`Codex made no image. Its last words:\n${(run.stdout + run.stderr).trim().split('\n').slice(-8).join('\n')}`);
  return readFileSync(image);
}

/** The most recently written .png under `dir` (any depth) newer than `since`, or null. */
function newestImage(dir, since) {
  let best = null;
  let bestTime = since;
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.png') && st.mtimeMs > bestTime) {
        best = p;
        bestTime = st.mtimeMs;
      }
    }
  };
  walk(dir);
  return best;
}

async function generate(prompt, size) {
  const res = await fetch(`${API}/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.generateModel,
      prompt,
      size,
      quality: config.quality,
      background: 'transparent',
      output_format: 'png',
      n: 1,
    }),
  });
  return decode(res);
}

/** Same request with reference images, so characters and style stay consistent. */
async function edit(prompt, size, refs) {
  const form = new FormData();
  form.append('model', config.editModel);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', config.quality);
  form.append('background', 'transparent');
  form.append('output_format', 'png');
  for (const r of refs) form.append('image[]', new Blob([readFileSync(fileFor(r))], { type: 'image/png' }), `${r}.png`);
  const res = await fetch(`${API}/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  return decode(res);
}

async function decode(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${body.error?.message ?? res.statusText}`);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image in the response.');
  return Buffer.from(b64, 'base64');
}
