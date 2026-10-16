// Generates game art with the OpenAI Images API, using only Node built-ins (fetch, FormData, Blob).
//
//   npm run art -- --list                 show every asset and whether it exists
//   npm run art -- furnace jan            generate these (skips ones that already exist)
//   npm run art -- jan --redo             regenerate; the old image moves to art/rejects/
//   npm run art -- --missing              generate everything not made yet (respects the budget)
//   add --over to go past the budget in art/prompts.json
//
// Needs OPENAI_API_KEY in the environment. Images land in src/assets/art/<id>.png, where the game picks them up.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const CONFIG = new URL('art/prompts.json', ROOT);
const LOG = new URL('art/log.json', ROOT);
const OUT = new URL('src/assets/art/', ROOT);
const REJECTS = new URL('art/rejects/', ROOT);
const API = 'https://api.openai.com/v1/images';

const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
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

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error('OPENAI_API_KEY is not set. Set it in your terminal (setx OPENAI_API_KEY "..." on Windows, then reopen it).');
  process.exit(1);
}

const byId = new Map(config.assets.map((a) => [a.id, a]));
const todo = flags.has('--missing') ? config.assets.filter((a) => !has(a.id)).map((a) => a.id) : ids;
if (todo.length === 0) {
  console.error('Nothing to do. Name asset ids, or use --missing. See --list.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(REJECTS, { recursive: true });

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
    const png = asset.refs?.length ? await edit(prompt, size, asset.refs) : await generate(prompt, size);
    if (has(id)) renameSync(fileFor(id), new URL(`${id}-${Date.now()}.png`, REJECTS));
    writeFileSync(fileFor(id), png);
    log.generated++;
    log.entries.push({ id, at: new Date().toISOString(), model: asset.refs?.length ? config.editModel : config.generateModel, size });
    writeFileSync(LOG, `${JSON.stringify(log, null, 2)}\n`);
    console.log(`done in ${Math.round((Date.now() - started) / 1000)} s (${log.generated}/${config.budget})`);
  } catch (err) {
    console.log('failed');
    console.error(`  ${err.message}`);
  }
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
