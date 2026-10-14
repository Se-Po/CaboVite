// Rulează toate probele `verifica-*` și le adună într-un singur rezumat.
//
//   npm run verifica                 toate, în paralel
//   npm run verifica -- --strict     o secțiune sărită (fără date-sursa/, fără git) e un eșec
//   npm run verifica -- --serie      una după alta, cu memoria unei singure probe
//   npm run verifica -- --tot        tipărește și jurnalele întregi
//   npm run verifica -- teren pagina numai acelea
//
// Nu scrie nimic. Fiecare probă rulează într-un proces al ei, cu VERIFICA_REZUMAT=1, și își
// încheie ieșirea cu o linie `##verifica {"ok":…,"picate":…,"sarite":…}`, scrisă de
// scripts/comun/proba.mjs. O probă care iese fără linia aceasta — o excepție, o ieșire
// timpurie, un script care n-a ajuns la rezumat — e „căzută”, oricare i-ar fi codul. Din
// fiecare se tipăresc rândurile PICĂ, SĂRIT și avertismentele neașteptate.
//
// `verifica-livrare` cere dist/ la zi: dacă lipsește sau e mai vechi decât src/, index.html,
// public/ sau vite.config.js, se sare, cu mesaj (sub --strict, eșec): rulează întâi
// `npm run build`.
//
// Înainte de probe, hamul se verifică pe el însuși: câteva scripturi de câte un rând, în
// directorul temporar, trebuie clasate exact (o probă bună, una picată, o excepție, o
// săritură cu și fără --strict, o ieșire fără rezumat, un avertisment neașteptat). Dacă nu,
// rezumatul de mai jos n-ar dovedi nimic, deci se oprește aici.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROBE = ['tiff', 'teren', 'sanctuar', 'cladiri', 'imprejurimi', 'controale', 'pagina', 'livrare', 'documentatie'];
const arg = process.argv.slice(2);
const STRICT = arg.includes('--strict');
const SERIE = arg.includes('--serie');
const TOT = arg.includes('--tot');
const alese = arg.filter((a) => !a.startsWith('--'));
const necunoscute = alese.filter((a) => !PROBE.includes(a));
if (necunoscute.length) throw new Error(`probe necunoscute: ${necunoscute.join(', ')}; există ${PROBE.join(', ')}`);
const DE_RULAT = alese.length ? PROBE.filter((p) => alese.includes(p)) : PROBE;

/** Rulează un script Node și îl clasează după linia `##verifica`. */
function ruleaza(script, { strict = STRICT } = {}) {
  return new Promise((gata) => {
    const t0 = performance.now();
    const env = { ...process.env, VERIFICA_REZUMAT: '1' };
    if (strict) env.VERIFICA_STRICT = '1';
    else delete env.VERIFICA_STRICT;
    const p = spawn(process.execPath, [script], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let iesire = '', erori = '';
    p.stdout.setEncoding('utf8').on('data', (d) => { iesire += d; });
    p.stderr.setEncoding('utf8').on('data', (d) => { erori += d; });
    p.on('close', (cod) => {
      const linie = iesire.split(/\r?\n/).find((l) => l.startsWith('##verifica '));
      let r = null;
      try { r = linie ? JSON.parse(linie.slice('##verifica '.length)) : null; } catch { r = null; }
      gata({ script, cod, r, iesire, erori, s: (performance.now() - t0) / 1000, cazut: r === null });
    });
  });
}

/** Cu câte procese deodată: toate, ori unul cu --serie. */
async function laRand(lista, f, cate) {
  const rez = new Array(lista.length);
  let urm = 0;
  await Promise.all(Array.from({ length: Math.min(cate, lista.length) }, async () => {
    while (urm < lista.length) { const i = urm++; rez[i] = await f(lista[i]); }
  }));
  return rez;
}

// ------------------------------------------------------------ hamul, cu controalele lui

const URL_PROBA = pathToFileURL(join(process.cwd(), 'scripts/comun/proba.mjs')).href;
const HAM = [
  ['o probă bună', `proba(true, 'x'); rezumat();`, {}, (x) => !x.cazut && x.cod === 0 && x.r.ok === 1],
  ['o probă picată', `proba(false, 'x'); rezumat();`, {}, (x) => !x.cazut && x.cod === 1 && x.r.picate === 1],
  ['o excepție', `proba(true, 'x'); throw new Error('probă');`, {}, (x) => x.cazut],
  ['o săritură', `sari('x'); rezumat();`, { strict: false }, (x) => !x.cazut && x.cod === 0 && x.r.sarite === 1],
  ['o săritură, sub --strict', `sari('x'); rezumat();`, { strict: true }, (x) => !x.cazut && x.cod === 1],
  ['o ieșire 0 fără rezumat', `proba(true, 'x'); process.exit(0);`, {}, (x) => x.cazut && x.cod === 0],
  ['un avertisment neașteptat', `console.warn('x'); proba(true, 'x'); rezumat();`, {}, (x) => !x.cazut && x.cod === 1 && x.r.picate === 1],
  ['o ieșire grăbită', `proba(false, 'x'); await rezumat({ iesi: true }); proba(true, 'după');`, {}, (x) => !x.cazut && x.cod === 1 && !x.iesire.includes('după')],
];
{
  const dir = mkdtempSync(join(tmpdir(), 'cabo-verifica-'));
  try {
    const rez = await Promise.all(HAM.map(([, cod, opt], i) => {
      const f = join(dir, `ham-${i}.mjs`);
      writeFileSync(f, `import { proba, rezumat, sari } from '${URL_PROBA}';\n${cod}\n`);
      return ruleaza(f, opt);
    }));
    const gresite = HAM.filter(([, , , bun], i) => !bun(rez[i])).map(([nume]) => nume);
    if (gresite.length) {
      console.log(`Hamul nu-și clasează corect cazurile de probă: ${gresite.join('; ')}. Rezumatul n-ar dovedi nimic.`);
      process.exit(1);
    }
    console.log(`Hamul: ${HAM.length} cazuri de probă clasate corect.`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ------------------------------------------------------------ dist/ la zi, pentru livrare

const celMaiNou = (cale) => {
  if (!existsSync(cale)) return 0;
  const st = statSync(cale);
  if (!st.isDirectory()) return st.mtimeMs;
  return readdirSync(cale).reduce((m, f) => Math.max(m, celMaiNou(join(cale, f))), st.mtimeMs);
};
const distLaZi = () => {
  if (!existsSync('dist/index.html')) return 'lipsește dist/';
  const dist = statSync('dist/index.html').mtimeMs;
  const surse = Math.max(...['src', 'public', 'index.html', 'vite.config.js'].map(celMaiNou));
  return surse > dist ? 'dist/ e mai vechi decât sursele' : null;
};

// ------------------------------------------------------------ probele

const deRulat = DE_RULAT.filter((p) => p !== 'livrare' || !distLaZi());
const livrareSarita = DE_RULAT.includes('livrare') && distLaZi();
// Câte deodată: cel mult câte procesoare sunt și cât încape, cu ~1,5 GiB de probă, în jumătate
// din memorie (o alegere: vârful cel mai mare, al lui verifica-teren, a fost de 1,25 GiB).
const cate = SERIE ? 1 : Math.max(1, Math.min(deRulat.length, cpus().length, Math.floor(totalmem() / 2 / (1.5 * 2 ** 30))));
console.log(`Rulez ${deRulat.length} probe${SERIE ? ', una după alta' : `, câte ${cate} deodată`}${STRICT ? ', cu --strict' : ''}.\n`);
const t0 = performance.now();
const rezultate = await laRand(deRulat, (p) => ruleaza(`scripts/verifica-${p}.mjs`), cate);
const durata = (performance.now() - t0) / 1000;

let ok = 0, picate = 0, sarite = 0, cazute = 0, memorie = 0;
for (const x of rezultate) {
  const nume = x.script.replace(/^scripts\//, '').replace(/\.mjs$/, '');
  const randuri = x.iesire.split(/\r?\n/);
  if (x.cazut) {
    cazute++;
    console.log(`  CĂZUT ${nume}: cod ${x.cod}, fără rezumat (${x.s.toFixed(1)} s)`);
    for (const l of [...randuri.filter((l) => /^  PICĂ/.test(l)), ...x.erori.trim().split(/\r?\n/).slice(-6)]) if (l) console.log(`        ${l}`);
    continue;
  }
  ok += x.r.ok; picate += x.r.picate; sarite += x.r.sarite; memorie += x.r.memorie_mib ?? 0;
  const eticheta = x.r.picate ? '  PICĂ ' : x.r.sarite ? '  --   ' : '  ok   ';
  console.log(`${eticheta}${nume}: ${x.r.ok} ok, ${x.r.picate} picate, ${x.r.sarite} sărite (${x.s.toFixed(1)} s, ${x.r.memorie_mib} MiB)`);
  for (const l of randuri.filter((l) => /^  (PICĂ|--  )/.test(l) || /avertisment neașteptat/.test(l))) console.log(`      ${l}`);
  if (TOT) console.log(x.iesire.replace(/^/gm, '      | '));
}
if (livrareSarita) {
  sarite++;
  console.log(`  --    verifica-livrare: SĂRIT, ${livrareSarita}; rulează întâi npm run build`);
}

const cod = picate || cazute || (STRICT && sarite) ? 1 : 0;
console.log(`\n${ok} ok, ${picate} picate, ${sarite} sărite${cazute ? `, ${cazute} ${cazute === 1 ? 'probă căzută' : 'probe căzute'}` : ''}, în ${durata.toFixed(1)} s`
  + `${SERIE ? '' : ` (memoria proceselor, adunată: ${memorie} MiB)`}.`);
console.log(cod ? 'Probele NU au trecut.' : sarite ? 'Probele care au rulat au trecut.' : 'Toate probele au trecut.');
process.exitCode = cod;
