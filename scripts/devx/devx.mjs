#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = resolve(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = process.env.MISTRAL_API_KEY;
if (!KEY) { console.error('MISTRAL_API_KEY manquante dans .env.local'); process.exit(1); }
const API_URL = 'https://api.mistral.ai/v1/chat/completions';

const CORE = `Tu es devx, agent code d'Optimus Formation Medicale (app pedagogique pour etudiants en medecine a Madagascar).

STACK : Vite 8, React 19, TanStack Start, TypeScript, Zustand, Supabase, Cloudflare Pages, Lemon Squeezy, Upstash Redis.
PALETTE : Oxford (parchemin #EDE0C8, olive #3E4A2A, or #A67C1E).
REPO : ~/grok-medical-app · main protege (PR + squash --admin).

REGLES ABSOLUES :
1. JAMAIS de posologie chiffree (dose, mg, mg/kg, ampoules, ml). Refuse, renvoie vers medx.
2. Aucun secret en clair dans code/logs.
3. TypeScript strict, typecheck vert avant PR.
4. Un chantier = une PR = commits atomiques.
5. Termux mobile : heredocs > 100 lignes tronquent — decoupe.
6. Reponse concise, code pret a PR, pas de blabla.
7. Citer sources medicales (HAS, OMS, Colleges) si contenu medical.

FORMAT : d'abord le code/diff, puis 1-2 lignes d'explication max. Si incertain, dis-le plutot qu'inventer.`;

const MED = [/\bposologie\b/i, /\bdose\b/i, /\bmg\s*\/\s*kg\b/i, /\bmilligrammes?\b/i, /\bampoules?\b/i, /\bgrammes?\b/i];
function guard(t) {
  const hit = MED.find(re => re.test(t));
  if (hit) { console.error(`Refuse (regle 1) : "${hit}"`); process.exit(2); }
}

function buildSystem(full) {
  if (!full) return CORE;
  const a = existsSync(resolve(ROOT, 'AGENTS.md')) ? readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8') : '';
  const c = existsSync(resolve(ROOT, 'CONTEXT.md')) ? readFileSync(resolve(ROOT, 'CONTEXT.md'), 'utf8') : '';
  return `${CORE}\n\n===== AGENTS.md =====\n${a}\n===== CONTEXT.md =====\n${c}`;
}

async function callMistral(messages, model, maxTokens) {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokens }),
  });
  if (!r.ok) { console.error(`Mistral ${r.status}:`, await r.text()); process.exit(3); }
  return r.json();
}

function parseArgs(argv) {
  const o = { full: false, chat: false, small: false, model: null, max: 800, write: null, files: [], task: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--full') o.full = true;
    else if (a === '--chat') o.chat = true;
    else if (a === '--small') o.small = true;
    else if (a === '--model') o.model = argv[++i];
    else if (a === '--max') o.max = parseInt(argv[++i], 10) || 800;
    else if (a === '--write') o.write = argv[++i];
    else if (a.startsWith('--file=')) o.files.push(...a.slice(7).split(','));
    else if (a.startsWith('--')) { console.error(`Flag inconnu : ${a}`); process.exit(1); }
    else o.task.push(a);
  }
  o.task = o.task.join(' ');
  o.model = o.model || (o.small ? 'mistral-small-latest' : (process.env.DEVX_MODEL || 'codestral-latest'));
  return o;
}

function injectFiles(task, files) {
  let msg = task;
  for (const f of files) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) { console.error(`Fichier introuvable : ${f}`); process.exit(1); }
    msg += `\n\n===== ${f} =====\n${readFileSync(p, 'utf8')}`;
  }
  return msg;
}

function report(res) {
  const i = res.usage?.prompt_tokens ?? '?', o = res.usage?.completion_tokens ?? '?';
  const est = (typeof i === 'number' && typeof o === 'number')
    ? ` · ~${((i * 0.3 + o * 0.9) / 1e6).toFixed(5)}$` : '';
  console.error(`[in=${i} out=${o}${est}]`);
}

async function runOnce(o) {
  guard(o.task);
  const userMsg = injectFiles(o.task, o.files);
  console.log(`devx (${o.model}, max=${o.max}${o.full ? ', full' : ''})...`);
  const res = await callMistral([{ role: 'system', content: buildSystem(o.full) }, { role: 'user', content: userMsg }], o.model, o.max);
  const out = res.choices?.[0]?.message?.content ?? '';
  if (o.write) {
    const p = resolve(ROOT, o.write);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, out);
    console.log(`ecrit : ${o.write}`);
  } else console.log(out);
  report(res);
}

async function runChat(o) {
  console.log(`devx chat (${o.model}). /exit pour quitter, /new pour reset.\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let history = [{ role: 'system', content: buildSystem(o.full) }];
  while (true) {
    const line = (await rl.question('> ')).trim();
    if (!line) continue;
    if (line === '/exit' || line === '/quit') break;
    if (line === '/new') { history = [{ role: 'system', content: buildSystem(o.full) }]; console.log('(reset)\n'); continue; }
    guard(line);
    history.push({ role: 'user', content: line });
    const res = await callMistral(history, o.model, o.max);
    const out = res.choices?.[0]?.message?.content ?? '';
    history.push({ role: 'assistant', content: out });
    console.log(`\n${out}\n`);
    report(res);
  }
  rl.close();
}

const o = parseArgs(process.argv.slice(2));
if (o.chat) await runChat(o);
else if (!o.task) { console.error('Usage : devx "tache" [--full] [--small] [--model=X] [--max=800] [--file=a,b] [--write=out]  |  devx --chat'); process.exit(1); }
else await runOnce(o);
