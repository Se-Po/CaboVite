// Verifică, în Node, părți ale paginii pe care nu le acoperă celelalte probe — nici
// relieful (verifica-teren), nici sanctuarul și clădirile, nici împrejurimile, nici
// controalele.
//
//   npm run verifica-pagina
//
// Nu scrie nimic în depozit și nu cere rețea; modulele mutate stau o clipă în directorul
// temporar al sistemului. Iese cu cod 1 dacă pică vreo probă. Fiecare probă de fond are un
// control negativ: aceeași măsurătoare pe o greșeală cunoscută — codul de la REPER_VECHI sau o
// mutație a celui de azi — trebuie să pice; o mutație care nu se mai aplică pică și ea
// („MUTAȚIA NU S-A APLICAT”), iar fără git controalele pe REPER_VECHI pică fiecare cu mesajul
// lui, fără să oprească probele pe codul de azi. Textul paginii se citește cu capetele de rând
// aduse la LF (`textSursa`, `textVechi`): proba nu depinde de core.autocrlf. Ce verifică azi:
//   - textura Satelit când transcodorul KTX2 nu răspunde (loaders.js): limita de timp,
//     abandonul, pagina ascunsă, verificarea dinaintea descărcării și API-ul lui
//     KTX2Loader pe care se sprijină;
//   - foaia de stil (main.css): fără `:has()`, `dvh` numai cu rezervă, iar selecția
//     oprită numai pe hartă și pe butoanele ei;
//   - accesibilitatea foii: haloul `--bg` al focusului pe butoanele de peste hartă, cât
//     inelul generic plus 2 px, cu umbra lor păstrată; bifa lui Satelit în afara numelui, cu
//     rezervă; busola în contrast forțat, pe cascadă; panoul „Coordonate” fără text sub 14 px;
//   - ordinea de desenare (cer.js, mare.js): cerul ultimul, marea după teren, cu
//     `Less` strict pe mare, prin sortarea lui three însuși;
//   - mărimea canvasului (renderer.js): raportul de pixeli cel mult 2, plafonul de pixeli;
//   - cascada încărcării (loaders.js): stratul NDVI al fiecărei hărți se cere odată cu
//     sidecarul ei, nu după el; căile de eșec ale reliefului și ale stratului, neschimbate;
//   - garda pornirii (loaders.js, scena.js): un corp blocat abandonează pornirea după 20 s
//     fără niciun octet nicăieri; unul lent care curge și o cerere la coadă nu; opționalele
//     tac la abandon; pagina ascunsă și firul ocupat nu se numără; aceleași date ca fără ea;
//   - Satelit la pornire (satelit.js, loaders.js, scena.js): o singură treaptă — baza, peticul
//     și împrejurimile, toate întregi, cerute înaintea construcției și aplicate abia toate pe
//     placă —; progresul pe procente întregi, din octeții citiți; garda fotografiei, 20 s fără
//     niciun octet, care nu păzește și transcodarea; ieșirea `faraSatelit`, fără preferință;
//     peticul oprit fără compresie (`cuCompresie` față de alegerea transcodorului); nimic cu
//     preferința Relief; abandonul la dispose(); pe calea Relief → clic, un clic în timpul
//     descărcării rămâne pe Relief; `automat`, după care scena.js așteaptă fotografia; baza
//     căzută — fișierul sau sidecarul fără soarele zborului — oprește tot, pe loc;
//     `reanunta()`, care scrie din nou anunțul eșecului când harta apare;
//   - harta o singură dată (scena.js, pe sursă): datele → garda pornirii oprită →
//     descarcaSatelit → creeazaTeren → creeazaSatelit, cu progresul și ieșirea legate ca text
//     exact → compileAsync → așteptarea lui Satelit → bucla, iar așteptarea
//     (`asteaptaSatelitul`) se hotărăște la ieșire, nu respinge și nu lasă ascultători;
//   - foaia de stil, și animațiile: numai transform/opacity, oprite sub reduced-motion; panourile
//     ascunse și canvasul fără pointer până la `data-scena`; fără JavaScript versiunea se arată,
//     judecat pe cascadă (specificitatea și ordinea), nu pe textul regulii;
//   - mesajul de încărcare (main.js): faza fotografiei cu procentul, butonul care oprește
//     așteptarea, focusul mutat pe Satelit când harta apare, apoi `scena.arata()` o dată;
//   - compilarea înaintea primului cadru (scena.js): `compileAsync` după ultimul `scena.add`
//     și înaintea buclei, pe sursă; timpii, în pagină (CLAUDE.md);
//   - anunțurile după apariția hărții (scena.js, busola.js): `arata()` cheamă `reanunta()` pe
//     busolă și pe Satelit după două cadre ale paginii; busola, construită cu un DOM fals,
//     golește anunțul și îl scrie din nou;
//   - pagina fără scenă (main.js, src/chapters/sanctuar.js, index.html): textul fișei
//     sanctuarului, cu sursele, în `#continut`, după anunț; un singur `h1`, în afara lui, și niciun
//     id dublu, și după o excepție cu eticheta încă în pagină; fișa etichetei, la fel ca înainte
//     de extragerea capitolului, la outerHTML.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { WebGLRenderLists } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import * as L from '../src/scene/loaders.js';
import { creeazaCer } from '../src/scene/cer.js';
import { creeazaMare } from '../src/scene/mare.js';
import { creeazaLumini } from '../src/scene/lights.js';
import { incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';
import { redimensioneaza } from '../src/scene/renderer.js';
import { materialMareSatelit } from '../src/scene/satelit.js';
import { incarcaImprejurimi, NIVELURI_IMPREJURIMI } from '../src/scene/imprejurimi.js';

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

// ------------------------------------------------------------ uneltele

// Reperul controalelor pe codul de dinainte: 0.1.5.02, cu Satelit cerut după construcție, în două
// trepte. Fără el — fără git, sau fără commitul acesta —, fiecare control pe el pică cu mesajul
// lui, iar probele pe codul de azi rulează mai departe.
const REPER_VECHI = '30a22c9';
// Reperul accesibilității (lotul E): 0.1.5.04, dinaintea reparațiilor din foaie și din index.html.
const REPER_ACCES = '6ad3a47';

// Capetele de rând. În index toate fișierele sunt LF, dar cu core.autocrlf copia de lucru poate
// avea, fișier cu fișier, CRLF sau LF. Textul paginii — src/ și index.html, de pe disc sau din
// istoric — se citește numai prin funcțiile de aici, care îl aduc la LF o singură dată; probele,
// mutațiile și inserțiile se scriu numai cu '\n'.
const LF = (t) => t.replace(/\r\n/g, '\n');
/** Un fișier al paginii, de pe disc, ca text cu LF. */
const textSursa = (cale) => LF(readFileSync(cale, 'utf8'));
/** Același fișier la REPER_VECHI — sau la alt reper —, ca text cu LF; `null` fără git sau fără reper. */
const textVechi = (cale, reper = REPER_VECHI) => {
  try {
    return LF(execFileSync('git', ['show', `${reper}:${cale}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }));
  } catch { return null; }
};

/**
 * O mutație a unui text, din perechi [text sau regex, înlocuire], aplicate pe rând. `null` dacă
 * una nu se aplică — textul de înlocuit nu mai există —, ca un control să nu treacă degeaba pe
 * codul neschimbat: fiecare control pică atunci cu NEAPLICATA. Un text se înlocuiește ca atare
 * (fără `$&` și rudele lui); un regex, cu grupurile lui.
 */
const muta = (text, ...perechi) => {
  let s = text;
  for (const [din, inLoc] of perechi) {
    if (typeof din === 'string' ? !s.includes(din) : !din.test(s)) return null;
    s = typeof din === 'string' ? s.replace(din, () => inLoc) : s.replace(din, inLoc);
  }
  return s;
};
const NEAPLICATA = 'MUTAȚIA NU S-A APLICAT';

/**
 * Specificitatea unui selector, [id, clasă, tip], pe subsetul din foaie: `:where()` 0,
 * `:not()`/`:is()`/`:has()` cât argumentul lor cel mai specific, un pseudo-element ca un tip.
 */
const specificitate = (sel) => {
  const v = [0, 0, 0];
  const maiMare = (x, y) => (x[0] - y[0] || x[1] - y[1] || x[2] - y[2]) > 0;
  // Argumentele unei liste, despărțite numai de virgulele din afara parantezelor.
  const desparte = (t) => {
    const p = [];
    let ad = 0, de = 0;
    for (let k = 0; k < t.length; k++) {
      if (t[k] === '(') ad++;
      else if (t[k] === ')') ad--;
      else if (t[k] === ',' && ad === 0) { p.push(t.slice(de, k)); de = k + 1; }
    }
    return [...p, t.slice(de)];
  };
  let i = 0;
  const nume = () => { const n = /^[\w-]*/.exec(sel.slice(i))[0]; i += n.length; return n; };
  const argument = () => {
    const de = i;
    for (let ad = 0; i < sel.length; i++) {
      if (sel[i] === '(') ad++;
      else if (sel[i] === ')' && --ad === 0) { i++; break; }
    }
    return sel.slice(de + 1, i - 1);
  };
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === '#') { i++; nume(); v[0]++; } else if (ch === '.') { i++; nume(); v[1]++; } else if (ch === '[') { i = sel.indexOf(']', i) + 1; v[1]++; } else if (sel.startsWith('::', i)) {
      i += 2; nume();
      if (sel[i] === '(') argument();
      v[2]++;
    } else if (ch === ':') {
      i++;
      const n = nume().toLowerCase(), arg = sel[i] === '(' ? argument() : null;
      if (n === 'where') continue;
      if (arg !== null && ['not', 'is', 'has'].includes(n)) {
        const m = desparte(arg).map((s) => specificitate(s.trim())).reduce((a, x) => (maiMare(x, a) ? x : a), [0, 0, 0]);
        v[0] += m[0]; v[1] += m[1]; v[2] += m[2];
      } else v[1]++;
    } else if (/[\w-]/.test(ch)) { nume(); v[2]++; } else i++;
  }
  return v;
};

/** Un modul din text, cu importurile relative și `three` duse la fișierele de azi din src/scene. */
let nrModul = 0;
const modulDin = async (src) => {
  src = src.replaceAll("from 'three'", `from '${import.meta.resolve('three')}'`)
    .replace(/from '\.\/([^']+)'/g, (_, f) => `from '${new URL(`../src/scene/${f}`, import.meta.url).href}'`);
  const f = join(tmpdir(), `cabo-proba-${process.pid}-${nrModul++}.mjs`);
  writeFileSync(f, src);
  try { return await import(pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
};

/** Starea unei promisiuni, citită fără s-o aștepte: codul vechi nu se termină deloc. */
const urmareste = (p) => {
  const o = { gata: false, v: undefined, e: undefined };
  p.then((v) => { o.gata = true; o.v = v; }, (e) => { o.gata = true; o.e = e; });
  return o;
};
/** Lasă bucla să curgă (sha256 vine din threadpool) până la `cond`, cel mult `n` ture. */
const curge = async (cond, n = 100_000) => {
  for (let i = 0; i < n && !cond(); i++) await new Promise((r) => setImmediate(r));
};

// Un ceas controlat: `setTimeout` și `clearTimeout` ale paginii merg pe timp virtual,
// deci 30 s se încearcă fără să se aștepte 30 s. `setImmediate` rămâne cel adevărat.
const ceas = { acum: 0, urm: 1, t: new Map() };
const ST = globalThis.setTimeout, CT = globalThis.clearTimeout;
globalThis.setTimeout = (f, ms = 0, ...a) => { const id = ceas.urm++; ceas.t.set(id, { la: ceas.acum + ms, f: () => f(...a) }); return id; };
globalThis.clearTimeout = (id) => { ceas.t.delete(id); };
const avanseaza = async (ms) => {
  const tinta = ceas.acum + ms;
  for (;;) {
    await curge(() => false, 200);
    let urm = null;
    for (const e of ceas.t) if (e[1].la <= tinta && (!urm || e[1].la < urm[1].la)) urm = e;
    if (!urm) break;
    ceas.t.delete(urm[0]);
    ceas.acum = urm[1].la;
    urm[1].f();
  }
  ceas.acum = tinta;
  await curge(() => false, 200);
};

// O textură falsă, dar întreagă pentru verificările dinaintea transcodării: mărimea,
// antetul KTX2 și sha256 se potrivesc cu sidecarul.
const NUME = 'harta_vX-orto_v1';
const BUF = new Uint8Array(96);
[0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb].forEach((v, i) => { BUF[i] = v; });
{ const dv = new DataView(BUF.buffer); dv.setUint32(20, 64, true); dv.setUint32(24, 32, true); dv.setUint32(40, 3, true); }
const META = {
  nume: NUME, bbox_tm06: { xMin: 0, xMax: 64, yMin: 0, yMax: 32 }, latime: 64, inaltime: 32, niveluri: 3,
  octeti: BUF.byteLength, sha256: createHash('sha256').update(BUF).digest('hex'),
};
globalThis.fetch = async (url) => {
  if (url === `/data/${NUME}.json`) return new Response(JSON.stringify(META), { status: 200 });
  if (url === `/data/${NUME}.ktx2`) return new Response(BUF.slice(), { status: 200 });
  return new Response('', { status: 404 });
};
const TEXTURA = { esteTextura: true };

// Avertismentele fiecărui caz.
let avert = [];
const warn = console.warn, info = console.info;
console.warn = (...a) => { avert.push(a.join(' ')); };
console.info = () => {};

/** Un încărcător KTX2 fals: `init()` ca al lui KTX2Loader, o singură promisiune. */
const fals = ({ init = () => Promise.resolve(), parse = () => {} } = {}) => {
  let pi = null;
  return { init() { return (pi ??= init()); }, parse };
};
const LIMITA = L.LIMITA_TRANSCODARE_MS ?? 30_000;
const caz = (ktx2, semnal = null, opt) => {
  avert = [];
  ceas.acum = 0; ceas.t.clear();
  return urmareste(opt ? L.incarcaOrto(NUME, ktx2, null, semnal, opt) : L.incarcaOrto(NUME, ktx2, null, semnal));
};
/** Până când garda și-a armat ceasul (sau până la capăt, pe codul fără gardă). */
const armat = (o) => curge(() => o.gata || ceas.t.size > 0);

console.log('\nTextura Satelit, cu transcodorul care nu răspunde');

proba(Number.isFinite(L.LIMITA_TRANSCODARE_MS) && L.LIMITA_TRANSCODARE_MS >= 20_000 && L.LIMITA_TRANSCODARE_MS <= 60_000,
  `limita de transcodare există și e generoasă: ${L.LIMITA_TRANSCODARE_MS} ms (cerut 20–60 s)`);

// 1. `parse()` care nu cheamă nimic — un worker care n-a pornit. Întâi nu prea devreme,
//    apoi `null` cu un singur avertisment, la termen.
{
  const o = caz(fals());
  await armat(o);
  await avanseaza(LIMITA - 1);
  const devreme = o.gata;
  await avanseaza(1);
  proba(!devreme && o.gata && o.v === null && !o.e && avert.length === 1 && /n-a răspuns/.test(avert[0] ?? ''),
    `parse tăcut: la ${LIMITA - 1} ms ${devreme ? 'terminat (prea devreme)' : 'încă în așteptare'}, la ${LIMITA} ms ${o.gata ? `→ ${o.v}` : 'tot în așteptare'}; avertismente ${avert.length}${avert[0] ? `: „${avert[0]}”` : ''}`);
  proba(ceas.t.size === 0, `după termen nu rămâne niciun temporizator (${ceas.t.size})`);
  // Control: fără gardă, aceeași poveste nu se termină niciodată.
  const c = caz(fals(), null, { limitaMs: 0 });
  await armat(c);
  await avanseaza(10 * LIMITA);
  proba(!c.gata && avert.length === 0, `control, fără limită (limitaMs 0): după ${10 * LIMITA / 1000} s ${c.gata ? `terminat (${c.v})` : 'încă în așteptare'}`);
}

// 2. Abandonul după sosirea fișierului, cât transcodarea atârnă: `null` pe loc, fără
//    avertisment — scena a plecat. Așa ajunge `dispose()` să oprească workerii.
{
  const ac = new AbortController();
  const o = caz(fals(), ac.signal);
  await armat(o);
  const t0 = ceas.acum;
  ac.abort();
  await curge(() => o.gata, 1000);
  proba(o.gata && o.v === null && avert.length === 0 && ceas.acum === t0 && ceas.t.size === 0,
    `abandon în timpul transcodării: ${o.gata ? `→ ${o.v}, după ${ceas.acum - t0} ms virtuali` : 'tot în așteptare'}, avertismente ${avert.length}, temporizatoare rămase ${ceas.t.size}`);
}

// 3. Abandonul cât se descarcă încă transcodorul: `init()` nu se termină.
{
  const ac = new AbortController();
  let cerut = false;
  const o = caz(fals({ init: () => { cerut = true; return new Promise(() => {}); } }), ac.signal);
  await curge(() => o.gata || cerut);
  ac.abort();
  await curge(() => o.gata, 1000);
  proba(o.gata && o.v === null && avert.length === 0,
    `abandon cât transcodorul se descarcă: ${o.gata ? `→ ${o.v}` : 'tot în așteptare'}, avertismente ${avert.length}`);
}

// 4. Banda lentă: transcodorul sosește abia după 2 × limita, iar transcodarea durează
//    0,1 s. Limita nu cuprinde descărcarea, deci textura vine. O limită pornită la
//    apelul lui parse() — prima reparație propusă — ar fi oprit-o.
{
  const ktx2 = fals({ init: () => new Promise((r) => setTimeout(r, 2 * LIMITA)) });
  ktx2.parse = (buf, ok) => { ktx2.init().then(() => setTimeout(() => ok(TEXTURA), 100)); };
  const o = caz(ktx2);
  await armat(o);
  await avanseaza(2 * LIMITA + 100);
  proba(o.gata && o.v?.textura === TEXTURA && avert.length === 0,
    `transcodorul sosit după ${2 * LIMITA / 1000} s, transcodarea 0,1 s: ${o.gata ? (o.v ? 'textura' : `→ ${o.v}`) : 'tot în așteptare'} la ${ceas.acum} ms, avertismente ${avert.length}`);
  // Control: aceeași descărcare ascunsă în parse(), cu init() gata pe loc — cum ar vedea-o
  // o limită pornită la parse() —, pierde textura.
  const c = caz(fals({ parse: (buf, ok) => { setTimeout(() => ok(TEXTURA), 2 * LIMITA + 100); } }));
  await armat(c);
  await avanseaza(2 * LIMITA + 100);
  proba(c.gata && c.v === null, `control, descărcarea transcodorului în limită: ${c.gata ? (c.v ? 'textura' : `→ ${c.v}`) : 'tot în așteptare'}`);
}

// 5. Pagina ascunsă: o filă înghețată pe telefon își îngheață și workerii, iar la
//    întoarcere temporizatorul trecut de termen sună primul. Ascunsă de la 10 s la 40 s,
//    transcodarea gata la 50 s: textura vine. Control: aceeași poveste, fără să afle
//    garda că pagina s-a ascuns, ar fi expirat la 30 s.
{
  const ruleaza = (vede) => {
    const doc = new EventTarget();
    doc.hidden = false;
    globalThis.document = doc;
    const arata = (ascunsa) => { doc.hidden = ascunsa; if (vede) doc.dispatchEvent(new Event('visibilitychange')); };
    const ktx2 = fals();
    ktx2.parse = (buf, ok) => { setTimeout(() => ok(TEXTURA), 50_000); };
    const o = caz(ktx2);
    return { o, arata };
  };
  for (const vede of [true, false]) {
    const { o, arata } = ruleaza(vede);
    await armat(o);
    await avanseaza(10_000); arata(true);
    await avanseaza(30_000); arata(false);
    await avanseaza(10_000);
    const rez = o.gata ? (o.v ? `textura la ${ceas.acum / 1000} s` : `→ ${o.v}`) : 'tot în așteptare';
    if (vede) proba(o.gata && o.v?.textura === TEXTURA && avert.length === 0, `pagina ascunsă de la 10 la 40 s, transcodarea gata la 50 s: ${rez}, avertismente ${avert.length}`);
    else proba(o.gata && o.v === null, `control, fără semnalul de vizibilitate: ${rez}`);
  }
  delete globalThis.document;
}

// 6. Calea de dinainte, neschimbată: o eroare de transcodare dă `null` cu motivul.
{
  const o = caz(fals({ parse: (buf, ok, err) => err(new Error('bloc stricat')) }));
  await curge(() => o.gata);
  proba(o.gata && o.v === null && avert.length === 1 && /bloc stricat/.test(avert[0] ?? ''),
    `eroare de transcodare: ${o.gata ? `→ ${o.v}` : 'tot în așteptare'}, avertismente ${avert.length}${avert[0] ? `: „${avert[0]}”` : ''}`);
}

globalThis.setTimeout = ST;
globalThis.clearTimeout = CT;

// ------------------------------------------------------------ verificarea dinaintea descărcării

// Un CSP fără 'unsafe-eval' sau WebAssembly oprit: încărcătorul nu se mai face, iar
// `pregateste()` din satelit.js prinde eroarea cu un avertisment, înaintea celor ~12 MB.
console.log('\nVerificarea transcodorului, înaintea descărcării');
const RENDERER = { extensions: { has: () => false, get: () => null } };
const incearca = async (strica, repara) => {
  strica();
  let p;
  try { p = L.creeazaIncarcatorKtx2(RENDERER); } finally { repara(); }
  try { const k = await p; k?.dispose?.(); return { ok: true, k }; } catch (e) { return { ok: false, mesaj: e.message }; }
};
{
  const WA = globalThis.WebAssembly, FN = globalThis.Function;
  const bun = await incearca(() => {}, () => {});
  proba(bun.ok && bun.k instanceof KTX2Loader && bun.k.workerConfig, `cu WebAssembly și eval: ${bun.ok ? 'încărcătorul se face' : `aruncă (${bun.mesaj})`}`);
  const cazuri = [
    ['fără WebAssembly', () => { globalThis.WebAssembly = undefined; }, () => { globalThis.WebAssembly = WA; }, /WebAssembly/],
    ["WebAssembly refuzat (CSP fără 'wasm-unsafe-eval')",
      () => { globalThis.WebAssembly = { Module: class { constructor() { throw new WA.CompileError('Refused to compile'); } } }; },
      () => { globalThis.WebAssembly = WA; }, /WebAssembly refuzat/],
    ["new Function refuzat (CSP fără 'unsafe-eval')",
      () => { globalThis.Function = function () { throw new EvalError('Refused to evaluate'); }; },
      () => { globalThis.Function = FN; }, /new Function/],
  ];
  for (const [text, strica, repara, re] of cazuri) {
    const r = await incearca(strica, repara);
    proba(!r.ok && re.test(r.mesaj ?? ''), `${text}: ${r.ok ? 'încărcătorul se face (trebuia să arunce)' : `aruncă: „${r.mesaj}”`}`);
  }
}

// ------------------------------------------------------------ API-ul lui KTX2Loader

// `init()` e public în r186, dar marcat „TODO: Make this method private”. incarcaOrto îl
// așteaptă înaintea limitei, ca ea să nu cuprindă descărcarea transcodorului; asta ține
// numai cât `parse()` trece prin ACEEAȘI promisiune.
console.log('\nKTX2Loader: ce folosește garda');
{
  proba(typeof KTX2Loader.prototype.init === 'function', `KTX2Loader.prototype.init există (${typeof KTX2Loader.prototype.init})`);
  const k = new KTX2Loader().detectSupport(RENDERER);
  const P = Promise.resolve();
  k.transcoderPending = P;
  proba(k.init() === P, 'init() întoarce promisiunea transcodorului deja pornită, nu una nouă');
  let chemari = 0;
  k.init = () => { chemari++; return new Promise(() => {}); };
  const f = readFileSync('public/data/harta_v8-orto_v1.ktx2');
  k.parse(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength), () => {}, () => {});
  await curge(() => chemari > 0, 1000);
  proba(chemari === 1, `parse() trece prin init() pe o textură Basis (${chemari} chemări)`);
  k.workerPool.dispose();
}

// ------------------------------------------------------------ foaia de stil

// Ce Chromium-ul panoului nu poate încerca: browserele fără `:has()` — Firefox sub 121,
// deci și 115 ESR — și fără `dvh` — Chrome 94–107, Firefox 93–100. Proba din pagină le
// simulează (CLAUDE.md, „Flux de lucru”); aici se păzește foaia, ca o regulă nouă să nu le
// aducă înapoi.
console.log('\nFoaia de stil: fără `:has()`, `dvh` numai cu rezervă, selecția oprită numai pe hartă');
{
  const CSS = textSursa('src/styles/main.css');
  // Un bloc cu reguli înăuntru: @media, @supports, @keyframes.
  const BLOC = /\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/.source;
  // Butoanele hărții și canvasul. Orice altă regulă cu `user-select: none` ar putea
  // prinde textele fișei, ale panoului, ale capitolelor sau rândul cu sursele.
  const NESELECTABILE = new Set(['#scena', '#busola .roza', '#straturi button', '#punct .activeaza', '#punct .minimizeaza', '#sanctuar-eticheta .poi']);
  const verifica = (css) => {
    const fara = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const has = (fara.match(/:has\(/g) ?? []).length;
    // `dvh` stă numai în condiția lui @supports și în valoarea lui `--vizibil` de sub ea.
    const dvh = fara.split('\n').map((l) => l.trim()).filter((l) => /dvh/.test(l)
      && l !== '@supports (height: 100dvh) {' && l !== ':root { --vizibil: 100dvh; }');
    const rezerva = /:root\s*\{[^}]*--vizibil:\s*100vh;/.test(fara);
    // Regulile cele mai dinăuntru: selectorii lor și blocul.
    const reguli = [...fara.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().split(/\s*,\s*/), bloc: m[2] }));
    const fara_sel = reguli.filter((r) => /(^|[;\s])user-select:\s*none/.test(r.bloc)).flatMap((r) => r.sel);
    const straine = fara_sel.filter((s) => !NESELECTABILE.has(s));
    const scena = reguli.some((r) => r.sel.includes('#scena') && /-webkit-user-select:\s*none/.test(r.bloc) && /(^|[;\s])user-select:\s*none/.test(r.bloc));
    return { has, dvh, rezerva, straine, scena };
  };
  const r = verifica(CSS);
  proba(r.has === 0, `\`:has(\` în main.css: ${r.has}`);
  proba(r.dvh.length === 0 && r.rezerva, `\`dvh\` în afara rezervei: ${r.dvh.length}${r.dvh[0] ? ` („${r.dvh[0]}”)` : ''}; \`--vizibil: 100vh\` în :root: ${r.rezerva ? 'da' : 'nu'}`);
  proba(r.scena && r.straine.length === 0, `canvasul neselectabil: ${r.scena ? 'da' : 'nu'}; alte reguli cu \`user-select: none\`: ${r.straine.length ? r.straine.join(', ') : 'niciuna'}`);
  // Controale: regula de dinainte a versiunii, o înălțime cu `dvh` fără rezervă, selecția
  // oprită pe tot documentul.
  const cs = muta(CSS, ['#versiune ~ * {', ':root:has(#versiune) {'], ['calc(var(--vizibil) ', 'calc(100dvh ']);
  const c = cs === null ? null : verifica(`${cs}\nbody { user-select: none; }\n`);
  proba(c !== null && c.has === 1 && c.dvh.length === 1 && c.straine.includes('body'),
    `control, foaia cu \`:root:has(#versiune)\`, un \`100dvh\` și \`body { user-select: none }\`: ${c === null ? NEAPLICATA : `${c.has} / ${c.dvh.length} / ${c.straine.join(', ')}`} — pică`);

  // Animațiile — roțile mesajului de încărcare și ale butonului Satelit: numai `transform` și
  // `opacity` în @keyframes, iar fiecare regulă animată are sub reduced-motion `animation:
  // none`. Mesajul de încărcare pleacă odată cu `data-scena` și fără JavaScript.
  const animatii = (css) => {
    const fara = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const bloc = BLOC;
    const cadre = [...fara.matchAll(new RegExp(`@keyframes\\s+[\\w-]+\\s*${bloc}`, 'g'))].map((m) => m[1]);
    const proprietati = cadre.flatMap((c) => [...c.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]));
    const straine = [...new Set(proprietati.filter((p) => p !== 'transform' && p !== 'opacity'))];
    const reguli = [...fara.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), bloc: m[2] }));
    const animate = reguli.filter((r) => /(^|[;\s])animation\s*:(?!\s*none)/.test(r.bloc)).map((r) => r.sel);
    const oprite = new Set([...fara.matchAll(new RegExp(`@media\\s*\\(prefers-reduced-motion:\\s*reduce\\)\\s*${bloc}`, 'g'))]
      .flatMap((m) => [...m[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((x) => /animation\s*:\s*none/.test(x[2])).map((x) => x[1].trim())));
    const neoprite = animate.filter((s) => !oprite.has(s));
    const fara_js = [...fara.matchAll(new RegExp(`@media\\s*\\(scripting:\\s*none\\)\\s*${bloc}`, 'g'))].map((m) => m[1]).join('\n');
    const ascuns = /body\[data-scena\]\s+#incarcare\s*\{\s*display:\s*none;?\s*\}/.test(fara)
      && /(^|\})\s*#incarcare\s*\{\s*display:\s*none;?\s*\}/.test(fara_js);
    return { cadre: cadre.length, straine, animate: animate.length, neoprite, ascuns };
  };
  const a = animatii(CSS);
  proba(a.cadre > 0 && a.straine.length === 0 && a.animate > 0 && a.neoprite.length === 0 && a.ascuns,
    `animațiile: ${a.cadre} @keyframes, proprietăți în afara lui transform/opacity: ${a.straine.join(', ') || 'niciuna'}; ${a.animate} reguli animate, fără \`animation: none\` sub reduced-motion: ${a.neoprite.join(', ') || 'niciuna'}; mesajul de încărcare ascuns la data-scena și fără JavaScript: ${a.ascuns ? 'da' : 'NU'}`);
  const cas = muta(CSS, [/@media \(prefers-reduced-motion: reduce\) \{\n  #incarcare p::before \{ animation: none; \}\n\}/, '']);
  const ca = cas === null ? null : animatii(`${cas}\n@keyframes pulsa { to { left: 2px; } }\n.pulsa { animation: pulsa 1s infinite; }\n`);
  proba(ca !== null && ca.straine.includes('left') && ca.neoprite.includes('#incarcare p::before') && ca.neoprite.includes('.pulsa'),
    `control, fără oprirea roții mesajului și cu o animație pe \`left\`: ${ca === null ? NEAPLICATA : `${ca.straine.join(', ')} / ${ca.neoprite.join(', ')}`} — pică`);

  // Harta o singură dată: până la `data-scena`, panourile — tot ce stă direct în <body>, în afară
  // de mesaj, de capitole, de canvas, de titlul paginii (`<header>`, cu `h1` ascuns vizual) și de
  // `<noscript>` — sunt ascunse, iar canvasul nu primește pointerul; numai
  // butonul mesajului primește clicuri; fără JavaScript versiunea se arată. Regula de dinainte,
  // care ascundea mesajul pe ecranele mici odată cu panourile (`[data-panouri]`), a plecat: acum
  // panourile vin abia cu harta. Pe selectori, nu pe text: ce ar ascunde o regulă se judecă pe
  // copiii lui <body>, cu selectorul ei. Controale: main.css de la REPER_VECHI, o regulă prea largă,
  // `[data-panouri]` pus la loc și regula de la REPER_ACCES, care ascundea și titlul, și
  // `<noscript>`: fără JavaScript, `data-scena` nu vine niciodată.
  //
  // Versiunea fără JavaScript se judecă pe cascadă, nu pe textul regulii: regula din @media
  // (scripting: none) trebuie să bată, cu specificitatea și apoi cu ordinea, fiecare regulă care o
  // ascunde până la `data-scena`. Fără `:where(…)`, regula panourilor are (3,1,1) și bate (1,1,1)
  // a versiunii, deci versiunea rămânea ascunsă fără JavaScript, cu regula ei în foaie.
  // Ce rămâne vizibil până la data-scena: canvasul, capitolele, mesajul, titlul și <noscript>.
  const VIZIBILE = ['#scena', '#continut', '#incarcare', 'header', 'noscript'];
  const pornirea = (css) => {
    const fara = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const reguli = [...fara.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().split(/\s*,\s*/), bloc: m[2], poz: m.index }));
    const cu = (re) => reguli.filter((r) => re.test(r.bloc)).flatMap((r) => r.sel);
    // Copiii lui <body>: cei din index.html și cei puși de scenă (gazda lor e <body>).
    const COPII = ['#scena', '#continut', '#incarcare', 'header', 'noscript', '#surse', '#versiune', '#busola', '#straturi', '#punct', '#sanctuar-eticheta', '#sanctuar-fisa', '.pivot-rotire'];
    // Un selector de forma `body:not([data-scena]) > X` ascunde copilul `c` dacă `c` se potrivește cu X:
    // un `:not(#id)` exclude acel id, un `:where(…)` se desface.
    const ascunde = (sel, c) => {
      const m = /^body:not\(\[data-scena\]\)\s*>\s*(.+)$/.exec(sel);
      if (!m) return false;
      const x = m[1].replace(/^:where\((.*)\)$/, '$1');
      const excluse = [...x.matchAll(/:not\(([^()]+)\)/g)].map((q) => q[1]);
      const rest = x.replace(/:not\([^()]+\)/g, '');
      if (rest !== '' && rest !== '*') return rest === c;
      return !excluse.includes(c);
    };
    const ascunse = cu(/(^|[;\s])visibility:\s*hidden/);
    const ascunsLa = (c) => ascunse.some((s) => ascunde(s, c));
    const faraPointer = cu(/pointer-events:\s*none/), cuPointer = cu(/pointer-events:\s*auto/);
    // Versiunea fără JavaScript: regulile care o arată, din @media (scripting: none) — cu poziția
    // blocului —, față de cele care o ascund până la data-scena, cu poziția lor.
    const tintesc = (lista, re) => lista.filter((r) => re.test(r.bloc)).flatMap((r) => r.sel.filter((s) => ascunde(s, '#versiune')).map((sel) => ({ sel, poz: r.poz })));
    const aratate = [...fara.matchAll(new RegExp(`@media\\s*\\(scripting:\\s*none\\)\\s*${BLOC}`, 'g'))]
      .flatMap((m) => tintesc([...m[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((x) => ({ sel: x[1].trim().split(/\s*,\s*/), bloc: x[2], poz: m.index })), /visibility:\s*visible/));
    const ascunzatoare = tintesc(reguli, /(^|[;\s])visibility:\s*hidden/);
    const sp = (x) => specificitate(x.sel), text = (v) => `(${v.join(',')})`;
    const bate = (a, h) => { const x = sp(a), y = sp(h), d = x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; return d > 0 || (d === 0 && a.poz > h.poz); };
    return {
      total: COPII.length - VIZIBILE.length,
      panouri: COPII.filter((c) => !VIZIBILE.includes(c) && ascunsLa(c)),
      straine: VIZIBILE.filter(ascunsLa),
      canvas: faraPointer.includes('body:not([data-scena]) #scena'),
      mesaj: faraPointer.includes('#incarcare') && cuPointer.includes('#incarcare button'),
      panouriVechi: /\[data-panouri\]/.test(fara),
      versiune: {
        ok: aratate.length > 0 && ascunzatoare.every((h) => aratate.some((a) => bate(a, h))),
        aratata: aratate.map((a) => text(sp(a))).join(', ') || 'nicio regulă',
        ascunsa: ascunzatoare.map((h) => text(sp(h))).join(', ') || 'nicio regulă',
      },
    };
  };
  const p = pornirea(CSS);
  proba(p.panouri.length === p.total && p.straine.length === 0 && p.canvas && p.mesaj && !p.panouriVechi,
    `până la data-scena: ascunse ${p.panouri.length} din ${p.total} panouri (${p.panouri.join(', ')}), mesajul, capitolele, canvasul, titlul și <noscript> ${p.straine.length ? `ASCUNSE: ${p.straine.join(', ')}` : 'nu'}; canvasul fără pointer: ${p.canvas ? 'da' : 'NU'}; numai butonul mesajului cu clicuri: ${p.mesaj ? 'da' : 'NU'}; regula [data-panouri]: ${p.panouriVechi ? 'ÎNCĂ ACOLO' : 'scoasă'}`);
  const descrieVersiunea = (x) => `regula din @media (scripting: none) ${x.versiune.aratata}, regulile care o ascund până la data-scena ${x.versiune.ascunsa}`;
  proba(p.versiune.ok, `fără JavaScript, versiunea se arată — câștigă cascada: ${descrieVersiunea(p)}`);
  // Control: regula panourilor fără `:where(…)`.
  const faraWhereCss = muta(CSS, ['> :where(:not(#incarcare):not(#continut):not(#scena):not(header):not(noscript))', '> :not(#incarcare):not(#continut):not(#scena):not(header):not(noscript)']);
  const faraWhere = faraWhereCss === null ? null : pornirea(faraWhereCss);
  proba(faraWhere !== null && !faraWhere.versiune.ok && faraWhere.panouri.length === faraWhere.total,
    `control, regula panourilor fără \`:where(…)\`: ${faraWhere === null ? NEAPLICATA : `${descrieVersiunea(faraWhere)}; versiunea ${faraWhere.versiune.ok ? 'se arată' : 'RĂMÂNE ASCUNSĂ'}`} — pică`);
  const bun = (x) => x.panouri.length === x.total && x.straine.length === 0 && x.canvas && x.mesaj && !x.panouriVechi;
  const css0 = textVechi('src/styles/main.css');
  const v = css0 === null ? null : pornirea(css0);
  proba(v !== null && !bun(v), `control, main.css de la ${REPER_VECHI}: ${v === null ? 'NECITIT' : `ascunse ${v.panouri.length} din ${v.total} panouri, canvasul fără pointer: ${v.canvas ? 'da' : 'nu'}`} — pică`);
  // O regulă prea largă — tot <body> — ar ascunde și mesajul, capitolele și canvasul.
  const largCss = muta(CSS, [':where(:not(#incarcare):not(#continut):not(#scena):not(header):not(noscript))', '*']);
  const larg = largCss === null ? null : pornirea(largCss);
  proba(larg !== null && !bun(larg) && larg.straine.length === VIZIBILE.length, `control, \`body:not([data-scena]) > *\`: ${larg === null ? NEAPLICATA : `ascunde și ${larg.straine.join(', ')}`} — pică`);
  const cuVechi = pornirea(`${CSS}\n@media (max-width: 22.5rem) {\n  [data-panouri] #incarcare { display: none; }\n}\n`);
  proba(!bun(cuVechi), `control, regula \`[data-panouri] #incarcare\` pusă la loc: ${cuVechi.panouriVechi ? 'găsită' : 'NEGĂSITĂ'} — pică`);
  const cssAcces = textVechi('src/styles/main.css', REPER_ACCES);
  const va = cssAcces === null ? null : pornirea(cssAcces);
  proba(va !== null && !bun(va) && va.straine.includes('header') && va.straine.includes('noscript'),
    `control, main.css de la ${REPER_ACCES}: ${va === null ? 'NECITIT' : `ascunde până la data-scena ${va.straine.join(', ') || 'nimic din ce rămâne vizibil'}`} — pică`);
}

// ------------------------------------------------------------ accesibilitatea foii

// Ce se vede și ce se citește, în foaie: haloul focusului pe butoanele de peste hartă, bifa lui
// Satelit în afara numelui, busola în contrast forțat și textul panoului „Coordonate”. Controale:
// main.css de la REPER_ACCES, dinaintea reparațiilor, și mutații ale celui de azi.
/**
 * Regulile foii, în ordine: selectorii, declarațiile — toate, și cele repetate, ca o rezervă —
 * și preludiile @media/@supports/@keyframes care le cuprind, din afară înăuntru.
 */
const reguliCss = (css) => {
  const fara = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const reguli = [], stiva = [];
  let de = 0;
  for (let i = 0; i < fara.length; i++) {
    if (fara[i] === '}') { stiva.pop(); de = i + 1; continue; }
    if (fara[i] !== '{') continue;
    const prelud = fara.slice(de, i).split(';').pop().trim();
    const urm = fara.indexOf('{', i + 1), inchis = fara.indexOf('}', i + 1);
    if (urm !== -1 && urm < inchis) { stiva.push(prelud); de = i + 1; continue; }
    const bloc = fara.slice(i + 1, inchis);
    const decl = [...bloc.matchAll(/([\w-]+)\s*:\s*((?:"[^"]*"|[^;"])+)/g)].map((m) => [m[1], m[2].trim()]);
    reguli.push({ sel: prelud.split(/\s*,\s*/), decl, medii: [...stiva] });
    i = inchis;
    de = i + 1;
  }
  return reguli;
};
/** Valoarea unei proprietăți într-o regulă: ultima declarație. */
const ultima = (r, p) => r.decl.filter(([k]) => k === p).at(-1)?.[1];
/** Straturile unei liste (umbre), despărțite de virgulele din afara parantezelor. */
const straturi = (v) => {
  const p = [];
  let ad = 0, de = 0;
  for (let k = 0; k < v.length; k++) {
    if (v[k] === '(') ad++;
    else if (v[k] === ')') ad--;
    else if (v[k] === ',' && ad === 0) { p.push(v.slice(de, k).trim()); de = k + 1; }
  }
  return [...p, v.slice(de).trim()];
};
const px = (v) => { const m = /(-?[\d.]+)px/.exec(v ?? ''); return m ? +m[1] : NaN; };

console.log('\nAccesibilitatea foii: haloul focusului, numele lui Satelit, busola în contrast forțat, textul panoului');
{
  const CSS = textSursa('src/styles/main.css');
  const CSS0 = textVechi('src/styles/main.css', REPER_ACCES);

  // Haloul. Inelul generic (`:focus-visible`) stă la `outline-offset` în afara butonului și are
  // `outline-width`; haloul din `--bg`, primul strat al umbrei pe `:focus-visible`, trebuie să
  // treacă de inel cu cel puțin 2 px: offset + grosime + 2, azi 7 px. Cu 5 px s-ar opri chiar la
  // marginea inelului, care ar rămâne pe cer pe partea aceea. Umbra de dinainte a butonului
  // trebuie să rămână printre straturi. Harta (`.inel-harta`): banda aurie între două benzi din
  // `--bg`, de cel puțin 2 px fiecare.
  const PESTE_HARTA = ['#busola .roza', '#straturi button', '#punct .activeaza', '#sanctuar-eticheta .poi'];
  const halouri = (css) => {
    const sus = reguliCss(css).filter((r) => r.medii.length === 0);
    let W = NaN, O = NaN;
    for (const r of sus.filter((x) => x.sel.includes(':focus-visible'))) {
      if (ultima(r, 'outline')) W = px(ultima(r, 'outline'));
      if (ultima(r, 'outline-offset')) O = px(ultima(r, 'outline-offset'));
    }
    const butoane = PESTE_HARTA.map((s) => {
      let w = W, o = O, umbra = null;
      for (const r of sus.filter((x) => x.sel.includes(`${s}:focus-visible`))) {
        if (ultima(r, 'outline')) w = px(ultima(r, 'outline'));
        if (ultima(r, 'outline-offset')) o = px(ultima(r, 'outline-offset'));
        if (ultima(r, 'box-shadow')) umbra = ultima(r, 'box-shadow');
      }
      const st = umbra ? straturi(umbra) : [];
      const m = /^0 0 0 ([\d.]+)px var\(--bg\)$/.exec(st[0] ?? '');
      const baza = sus.filter((r) => r.sel.includes(s)).map((r) => ultima(r, 'box-shadow')).filter(Boolean).at(-1) ?? null;
      return { s, halou: m ? +m[1] : 0, cerut: o + w + 2, pastrata: baza === null || st.slice(1).includes(baza), baza };
    });
    const inel = sus.find((r) => r.sel.includes('.inel-harta'));
    const umbraInel = inel ? straturi(ultima(inel, 'box-shadow') ?? '') : [];
    const aur = /^inset 0 0 0 ([\d.]+)px var\(--gold\)$/.exec(umbraInel[0] ?? ''), fond = /^inset 0 0 0 ([\d.]+)px var\(--bg\)$/.exec(umbraInel[1] ?? '');
    const harta = {
      afara: /var\(--bg\)/.test(ultima(inel ?? { decl: [] }, 'border') ?? '') ? px(ultima(inel, 'border')) : 0,
      aur: aur ? +aur[1] : 0,
      inauntru: aur && fond ? +fond[1] - +aur[1] : 0,
      arata: sus.some((r) => r.sel.includes('#scena:focus-visible ~ .inel-harta') && ultima(r, 'display') === 'block'),
    };
    return { W, O, butoane, harta };
  };
  const bunHalou = (x) => x.butoane.every((b) => b.halou >= b.cerut && b.pastrata)
    && x.harta.afara >= 2 && x.harta.aur >= x.W && x.harta.inauntru >= 2 && x.harta.arata;
  const descrieHalou = (x) => `${x.butoane.map((b) => `${b.s} ${b.halou} px${b.pastrata ? '' : ' FĂRĂ UMBRA DE DINAINTE'}`).join(', ')} (cerut ${x.O} + ${x.W} + 2 = ${x.O + x.W + 2} px); `
    + `harta: --bg ${x.harta.afara} px, aur ${x.harta.aur} px, --bg ${x.harta.inauntru} px${x.harta.arata ? '' : ', INELUL NU SE ARATĂ'}`;
  const h = halouri(CSS);
  proba(bunHalou(h), `haloul focusului peste hartă: ${descrieHalou(h)}`);
  const hv = CSS0 === null ? null : halouri(CSS0);
  proba(hv !== null && !bunHalou(hv), `control, main.css de la ${REPER_ACCES}: ${hv === null ? 'NECITIT' : descrieHalou(hv)} — pică`);
  const mh = [
    ['haloul busolei de 5 px', muta(CSS, ['#busola .roza:focus-visible { box-shadow: 0 0 0 7px var(--bg)', '#busola .roza:focus-visible { box-shadow: 0 0 0 5px var(--bg)'])],
    ['Satelit fără umbra de dinainte', muta(CSS, ['#straturi button:focus-visible { box-shadow: 0 0 0 7px var(--bg), 0 4px 18px rgb(0 0 0 / 0.22); }', '#straturi button:focus-visible { box-shadow: 0 0 0 7px var(--bg); }'])],
    ['inelul generic la 4 px de buton', muta(CSS, [':focus-visible {\n  outline: 3px solid var(--gold);\n  outline-offset: 2px;', ':focus-visible {\n  outline: 3px solid var(--gold);\n  outline-offset: 4px;'])],
    ['harta cu banda dinăuntru de 1 px', muta(CSS, ['inset 0 0 0 5px var(--bg)', 'inset 0 0 0 4px var(--bg)'])],
  ].map(([n, c]) => [n, c === null ? null : halouri(c)]);
  proba(mh.every(([, x]) => x !== null && !bunHalou(x)), `control: ${mh.map(([n, x]) => `${n}: ${x === null ? NEAPLICATA
    : `${x.butoane.filter((b) => b.halou < b.cerut || !b.pastrata).map((b) => `${b.s} ${b.halou}/${b.cerut} px${b.pastrata ? '' : ' fără umbră'}`).join(', ') || `harta ${x.harta.inauntru} px`}`}`).join('; ')} — pică`);

  // Numele lui Satelit. Orice `content` cu text vizibil are text alternativ (`/ "…"`), iar
  // înaintea lui declarația de rezervă cu același text, fără el: un browser care nu știe forma o
  // aruncă pe a doua. Numele calculat, după AccName — textul alternativ al lui ::before, apoi
  // eticheta —, iese „Satelit” în ambele stări.
  const continut = (css) => reguliCss(css).flatMap((r) => {
    const c = r.decl.filter(([k]) => k === 'content').map(([, v]) => v);
    if (!c.length) return [];
    const parti = (v) => { const m = /^"([^"]*)"(?:\s*\/\s*"([^"]*)")?$/.exec(v); return m ? { vizibil: m[1], alt: m[2] ?? null } : { vizibil: '', alt: null }; };
    const u = parti(c.at(-1));
    return [{ sel: r.sel.join(', '), vizibil: u.vizibil, alt: u.alt, rezerva: c.slice(0, -1).some((v) => { const p = parti(v); return p.alt === null && p.vizibil === u.vizibil; }) }];
  });
  const numele = (css) => {
    const c = continut(css);
    const cuText = c.filter((x) => x.vizibil.trim() !== '');
    const fara = cuText.filter((x) => x.alt === null || !x.rezerva).map((x) => `${x.sel}${x.alt === null ? ' fără text alternativ' : ' fără rezervă'}`);
    const stare = (sel) => { const x = c.find((y) => y.sel === sel); return `${x ? (x.alt ?? x.vizibil) : ''}Satelit`; };
    return { cuText: cuText.length, fara, neapasat: stare('#straturi button::before'), apasat: stare('#straturi button[aria-pressed="true"]::before') };
  };
  const bunNume = (x) => x.fara.length === 0 && x.neapasat === 'Satelit' && x.apasat === 'Satelit';
  const descrieNume = (x) => `numele „${x.neapasat}” / „${x.apasat}” (neapăsat / apăsat); ${x.cuText} reguli cu text vizibil, fără text alternativ sau fără rezervă: ${x.fara.join(', ') || 'niciuna'}`;
  const n = numele(CSS);
  proba(bunNume(n), `butonul Satelit: ${descrieNume(n)}`);
  const nv = CSS0 === null ? null : numele(CSS0);
  const fr = muta(CSS, ['content: "☐ "; content: "☐ " / "";', 'content: "☐ " / "";']);
  const fa = muta(CSS, ['content: "☑ "; content: "☑ " / "";', 'content: "☑ ";']);
  const mn = [[`main.css de la ${REPER_ACCES}`, nv], ['bifa fără rezervă', fr === null ? null : numele(fr)], ['bifa apăsată fără text alternativ', fa === null ? null : numele(fa)]];
  proba(mn.every(([, x]) => x !== null && !bunNume(x)), `control: ${mn.map(([t, x]) => `${t}: ${x === null ? NEAPLICATA : descrieNume(x)}`).join('; ')} — pică`);

  // Busola în contrast forțat. Chromium nu forțează `fill` și `stroke` pe SVG, deci decide
  // cascada: specificitatea, apoi ordinea, cu regulile din @media (forced-colors: active) puse
  // în joc. N trebuie să ia CanvasText, ca E; pivotul, Canvas cu conturul CanvasText.
  const parte = (p) => ({ tag: /^[a-z][\w-]*/i.exec(p)?.[0] ?? null, id: /#([\w-]+)/.exec(p)?.[1] ?? null, clase: [...p.matchAll(/\.([\w-]+)/g)].map((m) => m[1]) });
  const seAplica = (p, el) => (!p.tag || p.tag === el.tag) && (!p.id || p.id === el.id) && p.clase.every((c) => el.clase.includes(c));
  // Selectorii compuși cu combinatorul descendent; o stare (`:hover`), un atribut sau alt
  // combinator nu se potrivesc: elementele de aici n-au niciunul.
  const potriveste = (sel, lant) => {
    if (/[:[>+~*]/.test(sel)) return false;
    const parti = sel.trim().split(/\s+/).map(parte);
    if (!seAplica(parti.at(-1), lant[0])) return false;
    let j = 1;
    for (let k = parti.length - 2; k >= 0; k--) {
      while (j < lant.length && !seAplica(parti[k], lant[j])) j++;
      if (j++ >= lant.length) return false;
    }
    return true;
  };
  const valoarea = (R, lant, prop, medii) => {
    let castig = null;
    for (const r of R) {
      if (!r.medii.every((m) => medii.includes(m))) continue;
      const v = ultima(r, prop);
      if (v === undefined) continue;
      for (const s of r.sel) {
        if (!potriveste(s, lant)) continue;
        const sp = specificitate(s);
        if (!castig || (sp[0] - castig.sp[0] || sp[1] - castig.sp[1] || sp[2] - castig.sp[2]) >= 0) castig = { sp, v };
      }
    }
    return castig?.v ?? null;
  };
  const SUS = [{ tag: 'g', clase: ['cadran'] }, { tag: 'svg', clase: [] }, { tag: 'button', clase: ['roza'] }, { tag: 'div', id: 'busola', clase: [] }, { tag: 'body', clase: [] }, { tag: 'html', clase: [] }];
  const N = [{ tag: 'text', clase: ['eticheta', 'nord'] }, ...SUS], E = [{ tag: 'text', clase: ['eticheta'] }, ...SUS], PIVOT = [{ tag: 'circle', clase: ['pivot'] }, ...SUS];
  const FORTAT = ['@media (forced-colors: active)'];
  const busola = (css) => {
    const R = reguliCss(css);
    return { N: valoarea(R, N, 'fill', FORTAT), E: valoarea(R, E, 'fill', FORTAT), pivot: valoarea(R, PIVOT, 'fill', FORTAT), contur: valoarea(R, PIVOT, 'stroke', FORTAT),
      obisnuit: [valoarea(R, N, 'fill', []), valoarea(R, E, 'fill', [])] };
  };
  const bunBusola = (x) => x.N === 'CanvasText' && x.E === 'CanvasText' && x.pivot === 'Canvas' && x.contur === 'CanvasText';
  const descrieBusola = (x) => `N ${x.N}, E ${x.E}, pivotul ${x.pivot} cu conturul ${x.contur}`;
  const b = busola(CSS);
  proba(bunBusola(b) && b.obisnuit[0] !== b.obisnuit[1], `busola în contrast forțat: ${descrieBusola(b)}; fără el, N ${b.obisnuit[0]} și E ${b.obisnuit[1]}, cum e voit`);
  const bv = CSS0 === null ? null : busola(CSS0);
  const bN = muta(CSS, ['#busola .ac-sud, #busola .eticheta, #busola .eticheta.nord { fill: CanvasText; }', '#busola .ac-sud, #busola .eticheta, .eticheta.nord { fill: CanvasText; }']);
  const bP = muta(CSS, ['  #busola .pivot { fill: Canvas; stroke: CanvasText; }', '  .pivot { fill: Canvas; stroke: CanvasText; }']);
  const mb = [[`main.css de la ${REPER_ACCES}`, bv], ['N scris `.eticheta.nord` (0,2,0)', bN === null ? null : busola(bN)], ['pivotul scris `.pivot`', bP === null ? null : busola(bP)]];
  proba(mb.every(([, x]) => x !== null && !bunBusola(x)), `control: ${mb.map(([t, x]) => `${t}: ${x === null ? NEAPLICATA : descrieBusola(x)}`).join('; ')} — pică`);

  // Panoul „Coordonate”: nicio mărime de text sub 0,875rem (14 px), pe nicio lățime, iar
  // rândurile mici pe o coloană peste tot — pe două, la 14 px, rândul „scenă” n-ar încăpea.
  const panoul = (css) => {
    const R = reguliCss(css);
    const mici = R.filter((r) => r.sel.some((s) => s.startsWith('#punct'))).flatMap((r) => {
      const v = ultima(r, 'font-size') ?? ultima(r, 'font');
      const m = /([\d.]+)rem/.exec(v ?? '');
      return m && +m[1] < 0.875 ? [`${r.sel.join(', ')} ${m[1]}rem${r.medii.length ? ` (${r.medii.join(' ')})` : ''}`] : [];
    });
    const coloana = R.some((r) => r.medii.length === 0 && r.sel.includes('#punct .mici') && ultima(r, 'grid-template-columns') === '1fr');
    return { mici, coloana };
  };
  const bunPanou = (x) => x.mici.length === 0 && x.coloana;
  const descriePanou = (x) => `mărimi sub 0,875rem: ${x.mici.join('; ') || 'niciuna'}; rândurile mici pe o coloană pe orice lățime: ${x.coloana ? 'da' : 'NU'}`;
  const p = panoul(CSS);
  proba(bunPanou(p), `panoul „Coordonate”: ${descriePanou(p)}`);
  const pv = CSS0 === null ? null : panoul(CSS0);
  const p1 = muta(CSS, ['  word-spacing: 0.28em;\n  font-size: 0.875rem;', '  word-spacing: 0.28em;\n  font-size: 0.78rem;']);
  const p2 = muta(CSS, ['#punct .mici {\n  grid-template-columns: 1fr;\n', '#punct .mici {\n']);
  const mp = [[`main.css de la ${REPER_ACCES}`, pv], ['rândurile mici la 0,78rem', p1 === null ? null : panoul(p1)], ['pe două coloane', p2 === null ? null : panoul(p2)]];
  proba(mp.every(([, x]) => x !== null && !bunPanou(x)), `control: ${mp.map(([t, x]) => `${t}: ${x === null ? NEAPLICATA : descriePanou(x)}`).join('; ')} — pică`);
}

// ------------------------------------------------------------ fișa și cutia „Coordonate”

// Pe desktop fișa sanctuarului stă de la 10rem în jos, iar cutia „Coordonate” deschisă de la
// 0,75rem + versiunea în sus; deschise amândouă, înălțimile lor maxime (main.css) trebuie să lase
// între ele cel puțin 1rem, la orice înălțime a ferestrei, cu versiunea și fără. Pe ecranele
// înalte cutia își păstra plafonul de jumătate, iar cu spațierea textului din WCAG 1.4.12 intra
// sub fișă cu 60,8 px la 1280 × 1200 (recenzia). Se calculează pe sursă: valorile max-height se
// evaluează pentru fiecare înălțime. Controale: regula de dinainte (jumătatea) și 27,25rem în
// loc de 26,25rem.
console.log('\nFișa și cutia „Coordonate”: cel puțin 1rem între ele, la orice înălțime');
{
  const CSS = textSursa('src/styles/main.css');
  const valoare = (css, sel) => {
    const i = css.indexOf(`${sel} {`);
    if (i < 0) return null;
    const j = css.indexOf('max-height:', i), k = css.indexOf(';', j);
    return j < 0 || k < 0 ? null : css.slice(j + 'max-height:'.length, k).trim();
  };
  // Un evaluator mic pentru calc/min/max cu vh, rem și --versiune, în px (1rem = 16 px).
  const px = (expr, H, v) => Function(`return ${expr
    .replaceAll('var(--versiune, 0rem)', `${v}px`).replaceAll('100vh', `${H}px`)
    .replace(/([\d.]+)rem/g, (_, x) => `${x * 16}px`).replace(/([\d.]+)px/g, '$1')
    .replaceAll('calc(', '(').replace(/\bmax\(/g, 'Math.max(').replace(/\bmin\(/g, 'Math.min(')};`)();
  const goluri = (css) => {
    const fisa = valoare(css, 'html[data-punct-deschis] #sanctuar-fisa'), cutie = valoare(css, 'html[data-fisa-deschisa] #punct .cutie');
    if (!fisa || !cutie) return null;
    const gol = (H, v) => H - (0.75 * 16 + v) - px(cutie, H, v) - (10 * 16 + px(fisa, H, v));
    let min = Infinity, unde = null;
    for (const v of [0, 1.15 * 16]) for (let H = 545; H <= 2200; H += 1) {
      const g = gol(H, v);
      if (g < min) { min = g; unde = { H, v }; }
    }
    return { min, unde, la1200: gol(1200, 1.15 * 16) };
  };
  const text = (g) => (g === null ? NEAPLICATA : `golul cel mai mic ${g.min.toFixed(1)} px (la ${g.unde.H} px, versiunea ${g.unde.v ? 'da' : 'nu'}); la 1200 px cu versiunea, ${g.la1200.toFixed(1)} px`);
  const g = goluri(CSS);
  proba(g !== null && g.min >= 16 - 0.01, `fișa și cutia deschise, înălțimea ferestrei de la 545 la 2 200 px: ${text(g)} (cerut cel puțin 16)`);
  for (const [ce, c] of [
    ['jumătatea, ca înainte', muta(CSS, ['max-height: min(calc((100vh - 11.75rem - var(--versiune, 0rem)) / 2), 26.25rem);', 'max-height: calc((100vh - 11.75rem - var(--versiune, 0rem)) / 2);'])],
    ['27,25rem', muta(CSS, ['var(--versiune, 0rem)) / 2), 26.25rem);', 'var(--versiune, 0rem)) / 2), 27.25rem);'])],
  ]) {
    const x = c === null ? null : goluri(c);
    proba(x !== null && x.min < 16 - 0.01, `control, ${ce}: ${text(x)} — pică`);
  }
}

// ------------------------------------------------------------ ordinea de desenare

// three sortează lista opacă după renderOrder, apoi după material.id
// (WebGLRenderLists.js:7-13), iar cerul și marea își fac materialele înaintea
// terenului (scena.js). Fără renderOrder, amândouă se umbreau pe tot ecranul și se
// acopereau apoi. Proba folosește chiar sortarea lui three. Că imaginea rămâne aceeași
// la pixel — de aceea `Less` pe mare — se vede numai pe GPU: proba din pagină, în CLAUDE.md.
console.log('\nOrdinea de desenare: cerul ultimul, marea după teren');
{
  const paleta = paletaCurenta();
  const lumini = creeazaLumini(paleta);
  const cer = creeazaCer({ paleta, soare: lumini.soare });
  const mare = creeazaMare(paleta, cer);
  // Terenul, clădirile și împrejurimile își fac materialele după ele, ca în scena.js.
  const plase = ['teren', 'teren-petic', 'sanctuar', 'harta_v6'].map((n) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
    m.name = n;
    return m;
  });
  const scena = new THREE.Scene();
  scena.add(lumini.obiect, cer.obiect, mare.obiect, ...plase);
  const CAMERA = { reversedDepth: false };
  const ordine = () => {
    const l = new WebGLRenderLists().get(scena, 0);
    l.init();
    scena.traverseVisible((o) => { if (o.isMesh) l.push(o, o.geometry, o.material, 0, 0, null, CAMERA); });
    l.finish(); l.sort();
    return l.opaque.map((i) => i.object.name);
  };
  const o = ordine();
  proba(o.at(-1) === 'cer' && o.at(-2) === 'mare', `lista opacă: ${o.join(', ')}`);
  // Satelit schimbă materialul mării cu al lui (satelit.js), făcut după teren: renderOrder stă pe obiect.
  const tSat = new THREE.Texture();
  const mSat = materialMareSatelit(tSat, [25, 54, 84], cer);
  mare.obiect.material = mSat;
  const oSat = ordine();
  mare.obiect.material = mare.material;
  proba(oSat.at(-1) === 'cer' && oSat.at(-2) === 'mare', `cu materialul mării din Satelit: ${oSat.join(', ')}`);
  // Și el pe `Less`: altfel, desenată după teren, marea Satelit ar lua țărmului egalitățile.
  const lessSat = (m) => m.depthFunc === THREE.LessDepth;
  const ctrlSat = materialMareSatelit(tSat, [25, 54, 84], cer);
  ctrlSat.depthFunc = THREE.LessEqualDepth;
  proba(lessSat(mSat) && !lessSat(ctrlSat), `marea Satelit pe \`Less\` (${mSat.depthFunc}); control, pusă înapoi pe \`LessEqual\` (${ctrlSat.depthFunc}) — pică`);
  mSat.dispose(); ctrlSat.dispose(); tSat.dispose();
  const cm = cer.obiect.material;
  proba(mare.material.depthFunc === THREE.LessDepth && cm.depthFunc === THREE.LessEqualDepth && cm.depthTest && !cm.depthWrite,
    `marea pe \`Less\` (${mare.material.depthFunc}, ${THREE.LessDepth} cerut): terenul păstrează egalitățile de adâncime; cerul pe \`LessEqual\` (${cm.depthFunc}), fără să scrie adâncime`);
  // Control: ordinea de dinainte, cu renderOrder 0 pe amândouă.
  const ro = [cer.obiect.renderOrder, mare.obiect.renderOrder];
  cer.obiect.renderOrder = mare.obiect.renderOrder = 0;
  const c = ordine();
  [cer.obiect.renderOrder, mare.obiect.renderOrder] = ro;
  proba(c[0] === 'cer' && c[1] === 'mare', `control, fără renderOrder: ${c.join(', ')} — cerul primul, cum era`);
  for (const p of plase) { p.geometry.dispose(); p.material.dispose(); }
  cer.dispose(); mare.dispose(); lumini.dispose();
}

// ------------------------------------------------------------ mărimea canvasului

// Raportul de pixeli, cel mult 2 (alegerea autorului); plafonul de 2560 × 1440 rămâne.
console.log('\nMărimea canvasului: raportul de pixeli cel mult 2, cel mult 2560 × 1440 de pixeli');
{
  const DPR = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  // Un renderer fals: numai canvasul și `setSize`. redimensioneaza() trebuie să cheme
  // `setSize(W, H, false)` — CSS-ul stăpânește mărimea afișată.
  let stiluri = [];
  const masoara = (w, h, dpr) => {
    globalThis.devicePixelRatio = dpr;
    const canvas = { clientWidth: w, clientHeight: h, width: 300, height: 150 };
    redimensioneaza({ domElement: canvas, setSize(W, H, stil = true) { canvas.width = W; canvas.height = H; stiluri.push(stil); } });
    return [canvas.width, canvas.height];
  };
  const cazuri = [
    // [text, w, h, dpr, ce trebuie să iasă]
    ['telefonul 390 × 844 la 3×', 390, 844, 3, [780, 1688]],
    ['în peisaj, 844 × 390 la 3×', 844, 390, 3, [1688, 780]],
    ['Android 412 × 915 la 3,5×', 412, 915, 3.5, [824, 1830]],
    ['desktopul 1600 × 900 la 1×', 1600, 900, 1, [1600, 900]],
    ['laptopul 1440 × 900 la 2×, plafonat', 1440, 900, 2, [2428, 1517]],
    ['tableta 1024 × 1366 la 2×, plafonată', 1024, 1366, 2, [1662, 2217]],
  ];
  for (const [text, w, h, dpr, asteptat] of cazuri) {
    const [W, H] = masoara(w, h, dpr);
    proba(W === asteptat[0] && H === asteptat[1] && W * H <= 2560 * 1440,
      `${text}: ${W} × ${H} (${(W * H / 1e6).toFixed(2)} MP; cerut ${asteptat.join(' × ')})`);
  }
  const [W, H] = masoara(390, 844, 3);
  proba(W * H <= 1.4e6, `telefonul la 3×: ${(W * H / 1e6).toFixed(2)} MP, cel mult 1,4 (cu raportul întreg ar fi 1170 × 2532, 2,96 MP)`);
  proba(stiluri.length === cazuri.length + 1 && stiluri.every((s) => s === false), `setSize() primește de fiecare dată al treilea argument false (${stiluri.length} chemări)`);
  // Știut, nu o greșeală: cu pagina mărită de două ori pe telefon raportul e 6, iar
  // canvasul rămâne cât al paginii nemărite. Se tipărește, fără prag.
  const [Wz, Hz] = masoara(195, 422, 6);
  console.log(`    informativ: telefonul cu pagina mărită de două ori (195 × 422 la 6×) — ${Wz} × ${Hz}, un pixel randat pe 3 × 3 ai ecranului`);
  if (DPR) Object.defineProperty(globalThis, 'devicePixelRatio', DPR); else delete globalThis.devicePixelRatio;
}

// ------------------------------------------------------------ cascada încărcării

// Numele stratului NDVI e al hărții, iar al hărții stă deja în URL (`/data/<nume>-dem.json`):
// stratul n-are de ce să aștepte sidecarul, lățimea și înălțimea se verifică după. Proba
// numără dus-întorsurile cu un `fetch` care răspunde numai când i se spune: la fiecare tură
// răspund toate cererile pornite până atunci.
console.log('\nCascada încărcării: stratul NDVI pleacă odată cu sidecarul hărții');
{
  const INDEX = textSursa('index.html');
  const disc = (url) => (existsSync('public' + url)
    ? new Response(readFileSync('public' + url), { status: 200 })
    : new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } }));   // ca Vite
  /** O rețea în ture: `raspunde(url)` dă răspunsul, dar numai când îl eliberează tura. */
  const retea = (raspunde) => {
    const r = { cereri: [], tura: 0 };
    r.fetch = (url, opt = {}) => new Promise((res, rej) => {
      const c = { url, tura: r.tura, raspuns: false, oprita: false, semnal: opt.signal };
      c.raspunde = () => { c.raspuns = true; Promise.resolve().then(() => raspunde(url)).then(res, rej); };
      opt.signal?.addEventListener('abort', () => {
        if (!c.raspuns) { c.oprita = true; rej(new DOMException('cerere oprită', 'AbortError')); }
      }, { once: true });
      r.cereri.push(c);
    });
    return r;
  };
  /** Rulează `porneste()` pe rețeaua `r`, tură cu tură, până se termină. */
  const ture = async (r, porneste) => {
    const F = globalThis.fetch;
    globalThis.fetch = r.fetch;
    avert = [];
    try {
      const o = urmareste(Promise.resolve().then(porneste));
      await curge(() => o.gata, 200);
      while (!o.gata && r.tura < 10) {
        const deschise = r.cereri.filter((c) => !c.raspuns && !c.oprita);
        if (!deschise.length) break;
        r.tura++;
        for (const c of deschise) c.raspunde();
        await curge(() => o.gata, 3000);
      }
      return o;
    } finally { globalThis.fetch = F; }
  };
  const tura = (r, url) => r.cereri.find((c) => c.url === url)?.tura;

  // 1. Pornirea paginii, pe datele adevărate: alpha — peticul și baza lui — și împrejurimile.
  const harti = ['harta_v5', 'harta_v4', ...NIVELURI_IMPREJURIMI];
  const odata = (r) => harti.every((n) => tura(r, `/data/${n}-ndvi.bin`) === tura(r, `/data/${n}-dem.json`));
  const descrie = (r) => harti.map((n) => `${n} ${tura(r, `/data/${n}-dem.json`) ?? '–'}/${tura(r, `/data/${n}-ndvi.bin`) ?? '–'}`).join(', ');
  {
    const r = retea(disc);
    const o = await ture(r, () => Promise.all([L.incarcaRelief(), incarcaImprejurimi()]));
    const [alpha, imp] = o.v ?? [];
    const straturi = !!(alpha?.ndvi && alpha.baza?.ndvi && imp?.length === NIVELURI_IMPREJURIMI.length && imp.every((x) => x.ndvi));
    const unice = new Set(r.cereri.map((c) => c.url)).size;
    proba(o.gata && !o.e && odata(r), `fiecare strat NDVI se cere în tura sidecarului hărții lui (hartă tură sidecar/strat): ${descrie(r)}`);
    proba(o.gata && !o.e && r.tura === 2 && straturi && unice === r.cereri.length && r.cereri.length === 4 * harti.length && avert.length === 0,
      `pornirea: ${r.tura} dus-întorsuri până la toate datele hărții (cerut 2), ${r.cereri.length} cereri, `
      + `${unice === r.cereri.length ? 'fiecare fișier o dată' : `${r.cereri.length - unice} dubluri`}, straturile ${straturi ? 'toate sosite' : 'LIPSĂ'}, avertismente ${avert.length}`
      + `${o.e ? `; aruncă: ${o.e.message}` : ''}`);
    // Control: compunerea de dinainte, înghețată aici — stratul cerut abia după sidecar.
    const vechi = async (n, adancime = 0) => {
      const [rMeta, rBin] = await Promise.all([fetch(`/data/${n}-dem.json`), fetch(`/data/${n}-dem.bin`)]);
      const meta = await rMeta.json();
      const strat = L.incarcaStrat(meta.nume, meta.latime, meta.inaltime);
      const baza = meta.baza && adancime < 1 ? vechi(meta.baza, adancime + 1) : null;
      await rBin.arrayBuffer();
      return [await baza, await strat];
    };
    const rc = retea(disc);
    const c = await ture(rc, () => Promise.all(['harta_v5', ...NIVELURI_IMPREJURIMI].map((n) => vechi(n))));
    proba(c.gata && !c.e && !odata(rc) && rc.tura === 3,
      `control, stratul cerut după sidecar (compunerea de dinainte): ${rc.tura} dus-întorsuri; ${descrie(rc)} — pică`);
  }

  // 2. Căile de eșec, pe o hartă de 4 × 3: aceleași rezultate și aceleași avertismente ca
  //    înainte. Pe calea cu alt nume în sidecar, stratul vine, ca înainte, după numele din
  //    sidecar.
  const W = 4, H = 3, OCTETI = Math.ceil(W * H / 2);
  const RELIEF = { nume: 'harta_vX', latime: W, inaltime: H, pasX_m: 2, pasZ_m: 2, zMin_m: -8, zScara: 0.01 };
  const STRAT = { harta: 'harta_vX', latime: W, inaltime: H, codare: { biti: 4 }, niveluri: [null, ...Array.from({ length: 15 }, (_, i) => -0.1 + 0.05 * i)] };
  const fisiere = (schimbari) => {
    const f = {
      'harta_vX-dem.json': JSON.stringify(RELIEF), 'harta_vX-dem.bin': new Uint8Array(2 * W * H),
      'harta_vX-ndvi.json': JSON.stringify(STRAT), 'harta_vX-ndvi.bin': new Uint8Array(OCTETI).fill(0x21),
      'harta_vY-ndvi.json': JSON.stringify({ ...STRAT, harta: 'harta_vY' }), 'harta_vY-ndvi.bin': new Uint8Array(OCTETI).fill(0x43),
      ...schimbari,
    };
    return (url) => {
      const v = f[url.replace('/data/', '')];
      return v === undefined || v === 404 ? new Response('', { status: 404 }) : new Response(v, { status: 200 });
    };
  };
  const neasteptate = [];
  const laNeasteptat = (e) => { neasteptate.push(e); };
  process.on('unhandledRejection', laNeasteptat);
  // O hartă căzută înainte să predea stratul lui `incarcaStrat` îi oprește cererile: pe un nivel
  // al împrejurimilor pornirea merge mai departe, iar garda nu le-ar mai abandona.
  const stratOprit = (r) => { const s = r.cereri.filter((c) => c.url.includes('harta_vX-ndvi')); return s.length === 2 && s.every((c) => c.semnal?.aborted); };
  const cazuri = [
    ['sidecarul hărții, HTTP 404', { 'harta_vX-dem.json': 404 },
      (o, r) => o.e?.message === 'metadatele reliefului: HTTP 404 la /data/harta_vX-dem.json' && avert.length === 0 && stratOprit(r)],
    ['sidecarul hărții, pagina index (Vite)', { 'harta_vX-dem.json': INDEX }, (o, r) => !!o.e && avert.length === 0 && stratOprit(r)],
    ['relieful trunchiat', { 'harta_vX-dem.bin': new Uint8Array(5) }, (o) => /^relief trunchiat: 5 octeți/.test(o.e?.message ?? '') && avert.length === 0],
    ['stratul de lungime greșită', { 'harta_vX-ndvi.bin': new Uint8Array(5) },
      (o) => o.v && o.v.ndvi === null && avert.length === 1 && avert[0].includes(`(5 octeți, așteptat ${OCTETI})`)],
    ['stratul altei grile', { 'harta_vX-ndvi.json': JSON.stringify({ ...STRAT, inaltime: 2 }) },
      (o) => o.v && o.v.ndvi === null && avert.length === 1 && avert[0].includes('(4 × 2, harta are 4 × 3)')],
    ['stratul, HTTP 404', { 'harta_vX-ndvi.bin': 404 }, (o) => o.v && o.v.ndvi === null && avert.length === 1 && avert[0].includes('(HTTP 200 / 404)')],
    ['sidecarul hărții fără `nume`', { 'harta_vX-dem.json': JSON.stringify({ ...RELIEF, nume: undefined }) },
      (o) => o.v && o.v.ndvi === null && avert.length === 1 && avert[0].includes('n-are `nume`')],
    ['sidecarul hărții cu alt nume, harta_vY', { 'harta_vX-dem.json': JSON.stringify({ ...RELIEF, nume: 'harta_vY' }) },
      (o, r) => o.v?.ndvi?.meta.harta === 'harta_vY' && o.v.ndvi.coduri[0] === 0x43 && avert.length === 0
        && r.cereri.filter((c) => c.url.includes('harta_vX-ndvi')).every((c) => c.semnal?.aborted)],
  ];
  for (const [text, schimbari, bun] of cazuri) {
    const r = retea(fisiere(schimbari));
    const o = await ture(r, () => L.incarcaRelief('/data/harta_vX-dem.bin', '/data/harta_vX-dem.json'));
    const oprite = r.cereri.filter((c) => c.semnal?.aborted).map((c) => c.url.replace('/data/', ''));
    const rez = !o.gata ? 'tot în așteptare' : o.e ? `aruncă „${o.e.message}”` : `stratul ${o.v.ndvi ? o.v.ndvi.meta.harta : 'null'}`;
    proba(o.gata && bun(o, r), `${text}: ${rez}, avertismente ${avert.length}${avert[0] ? ` („${avert[0]}”)` : ''}${oprite.length ? `; cereri oprite: ${oprite.join(', ')}` : ''}`);
  }
  await curge(() => false, 200);
  process.off('unhandledRejection', laNeasteptat);
  proba(neasteptate.length === 0, `respingeri netratate: ${neasteptate.length}${neasteptate[0] ? ` („${neasteptate[0]?.message ?? neasteptate[0]}”)` : ''}`);
}

// ------------------------------------------------------------ garda pornirii

// Un corp de răspuns care începe și apoi tace ținea pornirea pe loc oricât: niciun fetch
// n-avea semnal sau termen. Acum un singur ceas de inactivitate, rearmat de orice octet al
// oricărei cereri a pornirii. Pe ceasul virtual de mai sus, cu un `fetch` care ascultă de
// semnal, ca al browserului; corpurile curg din `ReadableStream`, pe temporizatoare virtuale.
console.log('\nGarda pornirii: o cerere care tace abandonează pornirea, una lentă nu');
{
  const N = L.INACTIVITATE_PORNIRE_MS;
  const are = typeof L.creeazaGardaPornirii === 'function';
  proba(are && N >= 10_000 && N <= 60_000, `garda există (${are ? 'da' : 'nu'}), inactivitatea ${N} ms (cerut 10–60 s)`);
  if (are) {
    globalThis.setTimeout = (f, ms = 0, ...a) => { const id = ceas.urm++; ceas.t.set(id, { la: ceas.acum + ms, f: () => f(...a) }); return id; };
    globalThis.clearTimeout = (id) => { ceas.t.delete(id); };
    const F0 = globalThis.fetch;
    const INDEX = textSursa('index.html');
    const deDisc = (url) => (existsSync('public' + url)
      ? new Response(readFileSync('public' + url), { status: 200 })
      : new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } }));
    /** Un `fetch` care ascultă de semnal; `special(url)` poate da alt răspuns, sau o promisiune care nu vine. */
    const retea = (special = () => null) => {
      const r = { cereri: [] };
      r.fetch = (url, opt = {}) => {
        const c = { url, semnal: opt.signal ?? null };
        r.cereri.push(c);
        return new Promise((res, rej) => {
          const oprita = () => rej(new DOMException('cerere oprită', 'AbortError'));
          if (opt.signal?.aborted) return oprita();
          opt.signal?.addEventListener('abort', oprita, { once: true });
          Promise.resolve(special(url) ?? deDisc(url)).then(res, rej);
        });
      };
      return r;
    };
    /** Antetul vine, corpul trimite `n` octeți și tace. */
    const blocat = (n = 1024) => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(n)); } }), { status: 200 });
    /** Un fișier de pe disc în `bucati` bucăți, câte una la `pasMs`, pe ceasul virtual. */
    const lent = (url, bucati, pasMs) => {
      const buf = readFileSync('public' + url), m = Math.ceil(buf.length / bucati);
      let i = 0;
      return new Response(new ReadableStream({
        start(c) {
          const urm = () => {
            try {
              if (i * m >= buf.length) return c.close();
              c.enqueue(buf.subarray(i * m, (i + 1) * m));
              i++;
              setTimeout(urm, pasMs);
            } catch { /* citirea s-a oprit */ }
          };
          setTimeout(urm, pasMs);
        },
      }), { status: 200 });
    };
    // Fiecare caz pornește de la zero pe ceasul virtual; garda se face după, ca să-și
    // armeze ceasul pe el.
    const deLaZero = () => { ceas.acum = 0; ceas.t.clear(); avert = []; };
    const garda = (o = {}) => { deLaZero(); return L.creeazaGardaPornirii({ acum: () => ceas.acum, ...o }); };
    const ruleaza = (special, f) => {
      const r = retea(special);
      globalThis.fetch = r.fetch;
      return { r, o: urmareste(Promise.resolve().then(f)) };
    };
    const descrie = (o) => (!o.gata ? 'tot în așteptare' : o.e ? `aruncă ${o.e.name} „${o.e.message}”` : 'rezolvată');
    const V4 = '/data/harta_v4-dem.bin';

    // 1. Corpul bazei trimite 1 KB și tace: la N − 1 ms încă în așteptare, la N abandonul,
    //    cu TimeoutError, fără avertismente și fără temporizatoare rămase.
    {
      const g = garda();
      const { r, o } = ruleaza((u) => (u === V4 ? blocat() : null), () => L.incarcaRelief(undefined, undefined, { garda: g }));
      await avanseaza(N - 1);
      const devreme = o.gata;
      await avanseaza(1);
      const faraSemnal = r.cereri.filter((c) => !c.semnal).length;
      proba(!devreme && o.gata && o.e?.name === 'TimeoutError' && g.expirat && avert.length === 0 && ceas.t.size === 0,
        `corpul bazei tace după 1 KB: la ${N - 1} ms ${devreme ? 'terminat (prea devreme)' : 'încă în așteptare'}, la ${N} ms ${descrie(o)}; avertismente ${avert.length}, temporizatoare rămase ${ceas.t.size}`);
      proba(faraSemnal === 0 && r.cereri.find((c) => c.url === V4)?.semnal?.aborted,
        `toate cele ${r.cereri.length} cereri poartă un semnal (${faraSemnal} fără), iar cea blocată e oprită`);
      // Control: fără gardă — cum era pornirea — aceeași poveste nu se termină.
      deLaZero();
      const c = ruleaza((u) => (u === V4 ? blocat() : null), () => L.incarcaRelief());
      await avanseaza(10 * N);
      proba(!c.o.gata && c.r.cereri.every((x) => !x.semnal?.aborted), `control, fără gardă: după ${10 * N / 1000} s ${descrie(c.o)}, ${c.r.cereri.filter((x) => x.semnal?.aborted).length} cereri oprite`);
    }

    // 2. Același corp, curgând încet: 10 bucăți, câte una la 15 s — 165 s în total, de opt ori
    //    pragul, dar niciodată 20 s fără un octet. Relieful vine întreg, la 165 s.
    {
      const g = garda();
      const { o } = ruleaza((u) => (u === V4 ? lent(V4, 10, 15_000) : null), () => L.incarcaRelief(undefined, undefined, { garda: g }));
      await avanseaza(166_000);
      const v4 = o.v?.baza;
      proba(o.gata && !o.e && v4?.inaltimi.length === v4?.latime * v4?.inaltime && !g.expirat && avert.length === 0,
        `baza în 10 bucăți la 15 s: ${descrie(o)}${v4 ? `, ${v4.latime} × ${v4.inaltime}` : ''}, garda ${g.expirat ? 'EXPIRATĂ' : 'neexpirată'}`);
      g.opreste();
      // Control: fără rearmare la progres, garda ar fi un termen pe durata totală.
      const gc = garda();
      gc.progres = () => {};
      const c = ruleaza((u) => (u === V4 ? lent(V4, 10, 15_000) : null), () => L.incarcaRelief(undefined, undefined, { garda: gc }));
      await avanseaza(N);
      proba(c.o.gata && c.o.e?.name === 'TimeoutError', `control, fără rearmare la progres: la ${N / 1000} s ${descrie(c.o)} — pică`);
    }

    // 3. O cerere la coadă: antetul bazei vine abia la 60 s, cât peticul curge câte o bucată
    //    la 5 s. Ceasul e unul singur, deci baza nu e omorâtă.
    {
      const V5 = '/data/harta_v5-dem.bin';
      const coada = (u) => (u === V4 ? new Promise((res) => setTimeout(() => res(deDisc(V4)), 60_000)) : null);
      const g = garda();
      const { o } = ruleaza((u) => (u === V5 ? lent(V5, 13, 5_000) : coada(u)), () => L.incarcaRelief(undefined, undefined, { garda: g }));
      await avanseaza(75_000);
      proba(o.gata && !o.e && o.v?.baza && !g.expirat, `baza la coadă 60 s, cât peticul curge la 5 s: ${descrie(o)}, garda ${g.expirat ? 'EXPIRATĂ' : 'neexpirată'}`);
      g.opreste();
      // Control: aceeași coadă, fără nimic care să curgă între timp — abandon la 20 s.
      const gc = garda();
      const c = ruleaza(coada, () => L.incarcaRelief(undefined, undefined, { garda: gc }));
      await avanseaza(N);
      proba(c.o.gata && c.o.e?.name === 'TimeoutError', `control, coada fără altă cerere care curge: la ${N / 1000} s ${descrie(c.o)} — pică`);
    }

    // 4. Opționalele tac la abandon: paleta și clădirile cu corpul blocat, sanctuarul fără
    //    antet, un strat al împrejurimilor blocat. Toate `null`, fără niciun avertisment, iar
    //    `verifica()` — pe care scena.js îl cheamă după fiecare așteptare — aruncă.
    {
      const BLOCATE = { '/data/paleta-teren.json': 'corp', '/data/cladiri_v1.json': 'corp', '/data/sanctuar_v2.json': 'antet', '/data/harta_v8-ndvi.bin': 'corp' };
      const special = (fel) => (u) => (BLOCATE[u] === undefined ? null : fel === '404' ? new Response('', { status: 404 }) : BLOCATE[u] === 'corp' ? blocat() : new Promise(() => {}));
      const toate = (g) => Promise.all([
        incarcaPaleta(undefined, { garda: g }), L.incarcaSanctuar(undefined, { garda: g }),
        L.incarcaCladiri(undefined, { garda: g }), incarcaImprejurimi(undefined, { garda: g }),
      ]);
      const g = garda();
      const { o } = ruleaza(special('blocat'), () => toate(g));
      let inainte = null;
      try { g.verifica(); } catch (e) { inainte = e; }
      await avanseaza(N);
      let dupa = null;
      try { g.verifica(); } catch (e) { dupa = e; }
      proba(o.gata && !o.e && o.v.every((v) => v === null) && avert.length === 0,
        `paleta, sanctuarul, clădirile, împrejurimile blocate: ${o.gata ? o.v.map((v) => String(v)).join(' / ') : 'tot în așteptare'}; avertismente ${avert.length}${avert[0] ? ` („${avert[0]}”)` : ''}`);
      proba(!inainte && dupa?.name === 'TimeoutError', `verifica(): înainte ${inainte ? 'aruncă' : 'tace'}, după termen ${dupa ? `aruncă ${dupa.name}` : 'TACE'}`);
      // Control: aceleași fișiere lipsă de-a binelea (404) — fiecare încărcător spune de ce.
      const gc = garda();
      const c = ruleaza(special('404'), () => toate(gc));
      await curge(() => c.o.gata, 3000);
      gc.opreste();
      proba(c.o.gata && avert.length >= 4, `control, aceleași fișiere cu 404, fără abandon: ${avert.length} avertismente`);
      // Paleta adevărată, înapoi, pentru ce ar mai urma.
      globalThis.fetch = retea().fetch;
      await incarcaPaleta();
    }

    // 5. Abandonul din `curata()`: totul se oprește pe loc, fără să fi expirat; după
    //    `opreste()`, progresul nu mai armează nimic.
    {
      const g = garda();
      const { o } = ruleaza((u) => (u === V4 ? blocat() : u === '/data/sanctuar_v2.json' ? new Promise(() => {}) : null),
        () => Promise.all([L.incarcaRelief(undefined, undefined, { garda: g }).catch((e) => e), L.incarcaSanctuar(undefined, { garda: g })]));
      await curge(() => false, 300);
      g.abandoneaza();
      await curge(() => o.gata, 3000);
      proba(o.gata && o.v[0]?.name === 'AbortError' && o.v[1] === null && !g.expirat && avert.length === 0 && ceas.acum === 0,
        `abandonul din curata(): relieful ${o.v?.[0]?.name ?? '?'}, sanctuarul ${o.v?.[1]}, la ${ceas.acum} ms virtuali, expirat ${g.expirat}, avertismente ${avert.length}`);
      const g2 = garda();
      g2.opreste(); g2.progres(); g2.progres();
      proba(ceas.t.size === 0, `după opreste(), progresul nu mai armează ceasul: ${ceas.t.size} temporizatoare`);
    }

    // 6. Pagina ascunsă de la 10 la 35 s: termenele care o cuprind nu se numără — abandonul
    //    vine la 60 s, nu la 20. Control: fără semnalul de vizibilitate, la 20 s.
    for (const vede of [true, false]) {
      ceas.acum = 0; ceas.t.clear();
      const doc = new EventTarget();
      doc.hidden = false;
      globalThis.document = doc;
      const arata = (ascunsa) => { doc.hidden = ascunsa; if (vede) doc.dispatchEvent(new Event('visibilitychange')); };
      const g = garda();
      await avanseaza(10_000); arata(true);
      await avanseaza(25_000); arata(false);
      await avanseaza(60_000 - 35_000 - 1);
      const devreme = g.expirat;
      await avanseaza(1);
      if (vede) proba(!devreme && g.expirat, `pagina ascunsă de la 10 la 35 s: la 59,999 s ${devreme ? 'expirată (prea devreme)' : 'neexpirată'}, la 60 s ${g.expirat ? 'expirată' : 'NEEXPIRATĂ'}`);
      else proba(devreme, `control, fără semnalul de vizibilitate: ${devreme ? 'expirată înainte de 60 s' : 'neexpirată'} — pică`);
      g.opreste();
      delete globalThis.document;
    }

    // 7. Firul ocupat de la 15 la 26 s — o filă înghețată, ale cărei bucăți sosite între timp
    //    încă așteaptă la coadă; sau, după ultima dată, construcția pe un telefon lent, cu
    //    ceasul încă armat: temporizatorul de la 20 s sună cu 6 s întârziere și nu se numără.
    //    Abandonul vine la 46 s. Control: un ceas care nu vede întârzierea.
    for (const vede of [true, false]) {
      ceas.acum = 0; ceas.t.clear();
      const g = garda(vede ? {} : { acum: () => 0 });
      await avanseaza(15_000);
      ceas.acum = 26_000;   // firul ocupat: nimic nu sună până aici
      for (const [id, e] of [...ceas.t].sort((a, b) => a[1].la - b[1].la)) if (e.la <= ceas.acum) { ceas.t.delete(id); e.f(); }
      const la26 = g.expirat;
      await avanseaza(46_000 - 26_000 - 1);
      const devreme = g.expirat;
      await avanseaza(1);
      if (vede) proba(!la26 && !devreme && g.expirat, `firul ocupat de la 15 la 26 s: la 26 s ${la26 ? 'expirată' : 'neexpirată'}, la 45,999 s ${devreme ? 'expirată' : 'neexpirată'}, la 46 s ${g.expirat ? 'expirată' : 'NEEXPIRATĂ'}`);
      else proba(la26, `control, un ceas care nu vede întârzierea: la 26 s ${la26 ? 'expirată' : 'neexpirată'} — pică`);
      g.opreste();
    }

    // 8. Aceleași date ca fără gardă: relieful, straturile, împrejurimile, paleta, sanctuarul și
    //    clădirile, citite pe bucăți, ies identice; după `opreste()` nu rămâne niciun temporizator.
    {
      const sha = (a) => createHash('sha256').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex').slice(0, 16);
      const amprenta = (alpha, imp, paleta, sanct, clad) => JSON.stringify({
        harti: [alpha, alpha.baza, ...imp].map((x) => [x.meta.nume, sha(x.inaltimi), x.ndvi ? sha(x.ndvi.coduri) : null]),
        paleta, sanct, clad,
      });
      const incarca = async (g) => {
        const o = g ? { garda: g } : {};
        const [paleta, alpha, imp, sanct, clad] = await Promise.all([
          incarcaPaleta(undefined, o), L.incarcaRelief(undefined, undefined, o), incarcaImprejurimi(undefined, o),
          L.incarcaSanctuar(undefined, o), L.incarcaCladiri(undefined, o),
        ]);
        return amprenta(alpha, imp, paleta, sanct, clad);
      };
      const g = garda();
      const p0 = g.progres;
      let progrese = 0;
      g.progres = () => { progrese++; p0(); };
      const cu = ruleaza(undefined, () => incarca(g));
      await curge(() => cu.o.gata, 20_000);
      g.opreste();
      const fara = ruleaza(undefined, () => incarca(null));
      await curge(() => fara.o.gata, 20_000);
      proba(cu.o.gata && fara.o.gata && !cu.o.e && cu.o.v === fara.o.v && progrese > cu.r.cereri.length && ceas.t.size === 0 && avert.length === 0,
        `cu garda, aceleași date ca fără ea: ${cu.o.v === fara.o.v ? 'identice' : 'DIFERITE'} (${cu.r.cereri.length} cereri, ${progrese} anunțuri de progres), temporizatoare rămase ${ceas.t.size}${cu.o.e ? `; aruncă: ${cu.o.e.message}` : ''}`);
    }

    // 9. scena.js trece garda fiecărui încărcător al pornirii și verifică după fiecare
    //    așteptare: altfel un sanctuar abandonat ar porni tăcut harta fără el. Scena cere
    //    WebGL, deci aici se păzește sursa; abandonul în pagină e în CLAUDE.md.
    {
      const verificaScena = (src) => {
        const apeluri = [...src.matchAll(/\b(incarcaRelief|incarcaSanctuar|incarcaCladiri|incarcaImprejurimi|incarcaPaleta)\(([^)]*)\)/g)];
        const faraGarda = apeluri.filter((m) => !/\bgarda\b/.test(m[2])).map((m) => m[1]);
        const goale = [...src.matchAll(/await\s+(incarcaPaleta\([^)]*\)|reliefGata|sanctuarGata|cladiriGata|imprejurimiGata)/g)].map((m) => m[1]);
        return { apeluri: apeluri.length, faraGarda, goale };
      };
      const SRC = textSursa('src/scene/scena.js');
      const s = verificaScena(SRC);
      proba(s.apeluri === 5 && s.faraGarda.length === 0 && s.goale.length === 0,
        `scena.js: ${s.apeluri} încărcători ai pornirii, ${s.faraGarda.length} fără gardă${s.faraGarda.length ? ` (${s.faraGarda.join(', ')})` : ''}, ${s.goale.length} așteptări fără verificare`);
      const cs = muta(SRC, ['await asteapta(sanctuarGata)', 'await sanctuarGata'], ['incarcaCladiri(undefined, { garda })', 'incarcaCladiri()']);
      const c = cs === null ? null : verificaScena(cs);
      proba(c !== null && c.faraGarda.length === 1 && c.goale.length === 1, `control, sanctuarul așteptat fără verificare și clădirile fără gardă: ${c === null ? NEAPLICATA : `${c.faraGarda.length} / ${c.goale.length}`} — pică`);
    }

    globalThis.fetch = F0;
    globalThis.setTimeout = ST;
    globalThis.clearTimeout = CT;
  }
}

// ------------------------------------------------------------ Satelit la pornire

// Texturile Satelit pleacă înaintea construcției plaselor, toate deodată și întregi — baza,
// peticul de 0,25 m și împrejurimile, cu harta_v9 de 2 m —, iar Satelit se aplică abia cu toate
// pe placă: harta apare o singură dată, direct pe Satelit (cererea autorului, 2026-10-08). Pe
// codul paginii — `descarcaSatelit` și `creeazaSatelit` —, cu un DOM, un renderer și un `fetch`
// falși, cu fișierele adevărate din public/data, cu transcodarea lui KTX2Loader înlocuită și pe
// ceasul virtual de mai sus. Construcția cere WebGL: ordinea din scena.js se păzește pe sursă,
// iar timpii, în pagină (CLAUDE.md). Controalele rulează satelit.js și scena.js de la
// REPER_VECHI, din git, și mutații plauzibile ale lui satelit.js de azi.
console.log('\nSatelit la pornire: o singură treaptă, progresul, garda fotografiei, ieșirea');
{
  // REPER_VECHI (0.1.5.02): Satelit cerut după construcție, în două trepte, cu harta_v9 mică în prima.
  const NUME_V = `satelit.js de la ${REPER_VECHI}`;
  const S = await import('../src/scene/satelit.js');
  const BF = KTX2Loader.BasisFormat, EF = KTX2Loader.EngineFormat;

  /** Un modul de la REPER_VECHI; `null` fără git sau fără reper. */
  const deLaReper = async (cale) => {
    const src = textVechi(cale);
    return src === null ? null : modulDin(src);
  };
  const V = await deLaReper('src/scene/satelit.js');
  // O mutație plauzibilă a lui satelit.js de azi (`muta`): `null` dacă nu se mai aplică.
  const SRC_S = textSursa('src/scene/satelit.js');
  const mutatie = async (...perechi) => {
    const s = muta(SRC_S, ...perechi);
    return s === null ? null : modulDin(s);
  };

  // (a) `cuCompresie` față de alegerea transcodorului însuși: tabelul FORMAT_OPTIONS și
  //     getTranscoderFormat, scoase din KTX2Loader.BasisWorker, pe toate configurațiile și pe
  //     fiecare .ktx2 din public/data, cu formatul Basis, laturile și alfa citite din antet.
  const cfg = {};
  let alege = null;
  try {
    const m = /const FORMAT_OPTIONS[\s\S]*?function isPowerOfTwo\([^)]*\)\s*\{[\s\S]*?\n\t\}/.exec(KTX2Loader.BasisWorker.toString());
    alege = new Function('config', 'EngineFormat', 'EngineType', 'TranscoderFormat', 'BasisFormat', `${m[0]}\nreturn getTranscoderFormat;`)(
      cfg, EF, KTX2Loader.EngineType, KTX2Loader.TranscoderFormat, BF);
  } catch (e) { alege = null; console.log(`    alegerea transcodorului nu s-a putut scoate: ${e.message}`); }
  const antet = (n, b) => {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const dfd = dv.getUint32(48, true), model = dv.getUint8(dfd + 12), mostre = (dv.getUint16(dfd + 10, true) - 24) / 16, canal = dv.getUint8(dfd + 31) & 15;
    return { n, w: dv.getUint32(20, true), h: dv.getUint32(24, true), basis: model === 166 ? BF.UASTC : BF.ETC1S, alfa: model === 166 ? canal === 3 || canal === 4 : mostre > 1, octeti: b.byteLength };
  };
  const antete = readdirSync('public/data').filter((n) => n.endsWith('.ktx2')).map((n) => antet(n, readFileSync(`public/data/${n}`)));
  // Fișierele din public/data de la REPER_VECHI pe care depozitul nu le mai are: varianta mică a
  // lui harta_v9 (`-orto_v1-mic`). Controalele rulează satelit.js de atunci, care o cere, deci
  // o primesc din git, ca pe datele lor; altfel ar pica din alt motiv decât cel probat. Fără git
  // sau fără reper rămâne gol: controalele pe REPER_VECHI pică atunci fiecare cu mesajul lui, iar
  // probele pe codul de azi rulează mai departe.
  const DIN_ISTORIC = new Map();
  try {
    const git = { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 };
    for (const c of execFileSync('git', ['ls-tree', '-r', '--name-only', REPER_VECHI, 'public/data'], { ...git, encoding: 'utf8' }).split('\n')) {
      if (c && !existsSync(c)) DIN_ISTORIC.set(c.slice('public'.length), execFileSync('git', ['show', `${REPER_VECHI}:${c}`], git));
    }
  } catch (e) {
    DIN_ISTORIC.clear();
    console.log(`    datele de la ${REPER_VECHI} nu s-au putut citi din git (${e.code ?? e.status ?? e.message}): controalele pe el vor pica`);
  }
  const istorice = [...DIN_ISTORIC].filter(([u]) => u.endsWith('.ktx2')).map(([u, b]) => antet(u.slice('/data/'.length), b));
  const CHEI = ['astcSupported', 'etc1Supported', 'etc2Supported', 'dxtSupported', 'bptcSupported', 'pvrtcSupported'];
  const configuratii = [];
  for (let m = 0; m < 64; m++) for (const hdr of [false, true]) {
    const c = Object.fromEntries(CHEI.map((k, i) => [k, Boolean(m & (1 << i))]));
    if (hdr && !c.astcSupported) continue;
    configuratii.push({ ...c, astcHDRSupported: hdr });
  }
  const nepotriviri = (pred) => {
    let n = 0;
    for (const c of configuratii) {
      for (const k of Object.keys(cfg)) delete cfg[k];
      Object.assign(cfg, c);
      for (const f of antete) if ((alege(f.basis, f.w, f.h, f.alfa).engineFormat === EF.RGBAFormat) !== !pred(c)) n++;
    }
    return n;
  };
  const chei = Object.keys(new KTX2Loader().detectSupport({ extensions: { has: () => false, get: () => null } }).workerConfig ?? {});
  proba(CHEI.every((k) => chei.includes(k)), `workerConfig are câmpurile citite de cuCompresie: ${CHEI.filter((k) => !chei.includes(k)).join(', ') || 'toate'} ${CHEI.every((k) => chei.includes(k)) ? '' : 'LIPSĂ'}`);
  if (alege) {
    const n = nepotriviri(L.cuCompresie);
    proba(n === 0 && configuratii.length === 96 && antete.length >= 6,
      `cuCompresie față de getTranscoderFormat: ${n} nepotriviri pe ${configuratii.length} configurații × ${antete.length} texturi`);
    const naiv = nepotriviri((c) => CHEI.some((k) => c[k]));
    proba(naiv > 0, `control, „oricare format” (și PVRTC, care cere laturi putere a lui 2): ${naiv} nepotriviri — pică`);
  } else proba(false, 'getTranscoderFormat din KTX2Loader.BasisWorker');

  // Hamul. Un jurnal comun: cererile, mărcile scenariului, texturile transcodate și cele urcate
  // pe placă, în ordine. Ceasul virtual de mai sus ține temporizatoarele paginii — garda
  // fotografiei, limita transcodării —, deci 20 s se încearcă fără să se aștepte 20 s.
  globalThis.setTimeout = (f, ms = 0, ...a) => { const id = ceas.urm++; ceas.t.set(id, { la: ceas.acum + ms, f: () => f(...a) }); return id; };
  globalThis.clearTimeout = (id) => { ceas.t.delete(id); };
  const OCTETI = new Map([...antete, ...istorice].map((f) => [f.n.replace('.ktx2', ''), f.octeti]));
  const DUPA_MARIME = new Map([...antete, ...istorice].map((f) => [f.octeti, f.n.replace('.ktx2', '')]));
  const SIDECAR = (n) => JSON.parse(readFileSync(`public/data/${n}.json`, 'utf8'));
  let jurnal = [], retinute = () => false, lipsa = () => false, special = () => null;
  // `abortLent`: o cerere reținută nu ascultă de oprire până nu e eliberată — o rețea care
  // oprește încet cererile.
  let abortLent = false;
  // Cererile reținute nu răspund decât oprite — sau la `raspundeRetinutelor()`, care le dă
  // fișierul, ca unei legături lente care ajunge totuși. `special(url)` poate da alt răspuns:
  // un corp care tace, unul care curge încet.
  let amanate = [];
  const raspundeRetinutelor = () => { const a = amanate; amanate = []; for (const f of a) f(); };
  const marca = (m) => jurnal.push({ marca: m });
  const F0 = globalThis.fetch;
  const fetchFals = (url, opt = {}) => new Promise((res, rej) => {
    jurnal.push({ url, semnal: opt.signal ?? null });
    const oprita = () => rej(new DOMException('cerere oprită', 'AbortError'));
    if (opt.signal?.aborted) return oprita();
    opt.signal?.addEventListener('abort', () => { if (!abortLent || !retinute(url)) oprita(); }, { once: true });
    const raspunde = () => {
      if (opt.signal?.aborted) return oprita();
      const corp = existsSync('public' + url) ? readFileSync('public' + url) : DIN_ISTORIC.get(url);
      res(corp ? new Response(corp, { status: 200 }) : new Response('', { status: 404 }));
    };
    if (retinute(url)) { amanate.push(raspunde); return; }
    if (lipsa(url)) return res(new Response('', { status: 404 }));
    const sp = special(url);
    if (sp) return res(sp);
    raspunde();
  });
  // Transcodarea: textura iese în formatul pe care l-ar alege transcodorul pentru placa asta,
  // după `intarziere(nume)` ms virtuali.
  const numeTextura = new WeakMap();
  const P = KTX2Loader.prototype, init0 = P.init, parse0 = P.parse, dispose0 = P.dispose, detect0 = P.detectSupport;
  let dispuse = 0, intarziere = () => 0;
  // Generația cazului: crește la fiecare `deLaZero`. Un încărcător o primește la creare, prin
  // `detectSupport` — prin care trece orice încărcător din creeazaIncarcatorKtx2 —, iar `dispuse`,
  // `vii` și jurnalul numără numai încărcătoarele cazului curent. Unul al cazului de dinainte,
  // eliberat abia acum — codul de la REPER_VECHI își elibera a doua treaptă după o verificare
  // sha256 pe timp real, care putea trece de `deLaZero` —, nu se mai numără aici.
  let generatie = 0;
  const alCazului = (k) => k.generatieProba === generatie;
  // Încărcătoarele pornite (`init`) și încă neeliberate: three avertizează când sunt două.
  const vii = new Set();
  let maxVii = 0;
  P.detectSupport = function (r) { this.generatieProba ??= generatie; return detect0.call(this, r); };
  P.init = function () {
    if (!this.transcoderPending) {
      this.transcoderPending = Promise.resolve();
      if (alCazului(this)) { marca('transcodor'); vii.add(this); maxVii = Math.max(maxVii, vii.size); }
    }
    return this.transcoderPending;
  };
  P.parse = function (buf, onLoad) {
    const dv = new DataView(buf), w = dv.getUint32(20, true), h = dv.getUint32(24, true), nume = DUPA_MARIME.get(buf.byteLength) ?? '?';
    // Jurnalul cazului în care a început transcodarea: una întârziată nu intră în al altuia.
    const j = jurnal;
    j.push({ parse: nume });
    this.init().then(() => {
      const gata = () => {
        Object.assign(cfg, this.workerConfig);
        const format = alege ? alege(BF.UASTC, w, h, false).engineFormat : EF.RGBA_BPTC_Format;
        const t = new THREE.CompressedTexture([{ data: new Uint8Array(0), width: w, height: h }, { data: new Uint8Array(0), width: w >> 1, height: h >> 1 }], w, h, format);
        numeTextura.set(t, nume);
        j.push({ transcodata: nume });
        onLoad(t);
      };
      const ms = intarziere(nume);
      if (ms > 0) setTimeout(gata, ms); else gata();
    });
  };
  P.dispose = function () { if (alCazului(this)) dispuse++; vii.delete(this); return dispose0.call(this); };
  /** Până la eliberarea tuturor încărcătoarelor cazului, cu limită: o încercare veche se termină. */
  const elibereazaToate = () => curge(() => vii.size === 0, 200_000);
  /** Antetul vine, corpul trimite 1 KB și tace. */
  const blocat = () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1024)); } }), { status: 200 });
  /** Un fișier din public/ în `bucati` bucăți, câte una la `pasMs`, pe ceasul virtual; închis după încă un pas. */
  const lent = (url, bucati, pasMs) => {
    const buf = readFileSync('public' + url), m = Math.ceil(buf.length / bucati);
    let i = 0;
    return new Response(new ReadableStream({
      start(c) {
        const urm = () => {
          try {
            if (i * m >= buf.length) return c.close();
            c.enqueue(buf.subarray(i * m, (i + 1) * m));
            i++;
            setTimeout(urm, pasMs);
          } catch { /* citirea s-a oprit */ }
        };
        setTimeout(urm, pasMs);
      },
    }), { status: 200 });
  };
  const element = () => ({
    hidden: false, textContent: '', id: '', className: '', type: '', title: '', copii: [], atribute: {}, asc: {},
    append(...c) { this.copii.push(...c); }, appendChild(c) { this.copii.push(c); return c; },
    setAttribute(k, v) { this.atribute[k] = String(v); }, removeAttribute(k) { delete this.atribute[k]; },
    addEventListener(t, f) { (this.asc[t] ??= []).push(f); },
    removeEventListener(t, f) { this.asc[t] = (this.asc[t] ?? []).filter((x) => x !== f); },
    remove() {},
  });
  const D0 = globalThis.document;
  globalThis.document = { createElement: element };
  let preferinta = null;
  globalThis.localStorage = { getItem: () => preferinta, setItem: (k, v) => { preferinta = v; } };
  globalThis.fetch = fetchFals;
  const metaBaza = JSON.parse(readFileSync('public/data/harta_v4-dem.json', 'utf8')).bbox_tm06;
  const centru = { x: (metaBaza.xMin + metaBaza.xMax) / 2, y: (metaBaza.yMin + metaBaza.yMax) / 2 };
  const plasa = () => ({ obiect: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()) });
  const renderer = (compresie) => ({
    extensions: { has: (n) => compresie && n === 'EXT_texture_compression_bptc', get: () => null },
    capabilities: { getMaxAnisotropy: () => 16 },
    compileAsync: async () => {},
    initTexture: (t) => jurnal.push({ urcata: numeTextura.get(t) ?? '?' }),
  });
  const NUME_IMP = NIVELURI_IMPREJURIMI;
  const deschide = ({ M, compresie = true, devreme = true, r = renderer(compresie), laProgres, faraSatelit }) => {
    const teren = plasa(), petic = plasa(), mare = plasa();
    const soare = new THREE.DirectionalLight();
    soare.position.set(300, 120, -400);
    marca('date');   // toate datele pornirii au sosit
    const h = devreme && M.descarcaSatelit
      ? M.descarcaSatelit({ renderer: r, numeBaza: 'harta_v4', numePetic: 'harta_v5', imprejurimi: NUME_IMP, fortatRelief: false }) : null;
    marca('constructie');
    let laCadru = null;
    const gazda = element();
    // `primulCadru` îl citește numai codul în două trepte, al controalelor; cel de azi nu-l mai are.
    const primulCadru = new Promise((res) => { laCadru = res; });
    const imp = NUME_IMP.map((nume) => ({ nume, obiect: plasa().obiect }));
    const sat = M.creeazaSatelit({
      renderer: r, scena: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), teren, petic, mare, drapaj: [], soare,
      cer: null, umbre: null, centru, numeBaza: 'harta_v4', numePetic: 'harta_v5', gazda, cereRandare: () => {},
      laSursa: () => {}, fortatRelief: false, imprejurimi: imp, descarcare: h, primulCadru, laProgres, faraSatelit,
    });
    return { sat, teren, petic, imp, h, gazda, laCadru: () => laCadru?.() };
  };
  /** Starea de la zero a unui caz: jurnalul, avertismentele, ceasul, rețeaua și preferința. */
  const deLaZero = (pref = null) => {
    generatie++;
    jurnal = []; avert = []; dispuse = 0; vii.clear(); maxVii = 0;
    ceas.acum = 0; ceas.t.clear();
    retinute = () => false; lipsa = () => false; special = () => null; intarziere = () => 0; abortLent = false; amanate = [];
    preferinta = pref;
  };
  const loc = (j, f) => j.findIndex(f);
  const cerereLa = (j, re) => loc(j, (e) => e.url && re.test(e.url));
  const marcaLa = (j, m) => loc(j, (e) => e.marca === m);
  const harta = (d, n) => d.imp.find((q) => q.nume === n).obiect;
  const latime = (obiect) => obiect.material.map?.image?.width ?? null;
  const T6 = ['harta_v4', 'harta_v5', ...NUME_IMP].map((n) => `${n}-orto_v1`);
  const LAT = Object.fromEntries(T6.map((n) => [n, SIDECAR(n).latime]));
  const S6 = T6.reduce((a, n) => a + SIDECAR(n).octeti, 0);
  const MB = (n) => (n / 2 ** 20).toFixed(2);   // MB = 2^20 octeți, ca în CLAUDE.md
  const butonul = (d) => { const rad = d.gazda.copii[0]; return { rad, b: rad?.copii[0], anunt: rad?.copii[1] }; };
  const clic = (b) => { for (const f of b.asc.click ?? []) f(); };
  const ANUNT = 'Se încarcă fotografia aeriană…', ESEC = 'Fotografia aeriană nu s-a putut încărca.';
  /** Starea plaselor în clipa de acum. */
  const stare = (d) => ({
    activ: d.sat.activ, petic: numeTextura.get(d.petic.obiect.material.map), teren: numeTextura.get(d.teren.obiect.material.map),
    v9: latime(harta(d, 'harta_v9')), v6: latime(harta(d, 'harta_v6')), urcate: jurnal.filter((e) => e.urcata).length,
  });
  /** Pornirea întreagă, până la `gata`, cu starea din clipa în care `gata` se rezolvă. */
  const porneste = async (o) => {
    deLaZero();
    const d = deschide(o);
    d.laCadru();   // numai pentru codul în două trepte, al controalelor
    let la = null;
    d.sat.gata.then((v) => { marca('satelit'); la = { v, ...stare(d) }; });
    await curge(() => la !== null, 200_000);
    const rez = { la, jurnal, avert: [...avert], d };
    d.sat.dispose();
    await elibereazaToate();
    await curge(() => false, 200);
    rez.dispuse = dispuse;
    return rez;
  };
  const descrie = (r) => {
    const j = r.jurnal, c = marcaLa(j, 'constructie'), s = marcaLa(j, 'satelit');
    const devreme = T6.filter((n) => { const i = cerereLa(j, new RegExp(`/${n}\\.ktx2$`)); return i >= 0 && i < c; }).length;
    const transcodate = j.slice(0, s < 0 ? j.length : s).filter((e) => e.transcodata).map((e) => e.transcodata);
    return { devreme, mic: j.filter((e) => e.url?.includes('-mic')).length, transcodate, octeti: transcodate.reduce((a, n) => a + (OCTETI.get(n) ?? 0), 0) };
  };

  // (b) O singură treaptă: cele șase fișiere — baza, peticul, cele patru împrejurimi, harta_v9
  //     întreagă — cerute înaintea construcției, niciun `-mic`; la `gata`, Satelit aplicat cu
  //     toate la detaliul întreg și urcate pe placă. Control: satelit.js de la REPER_VECHI.
  {
    const r = await porneste({ M: S });
    const x = descrie(r), la = r.la ?? {};
    proba(la.v === true && x.devreme === T6.length && x.mic === 0,
      `cererile înaintea construcției: ${x.devreme} din ${T6.length} .ktx2 (baza, peticul, ${NUME_IMP.join(', ')}), ${x.mic} cereri -mic; Satelit ${la.v ? 'pornit' : 'NEPORNIT'}`);
    proba(la.activ && la.petic === 'harta_v5-orto_v1' && la.teren === 'harta_v4-orto_v1' && la.v9 === LAT['harta_v9-orto_v1'] && la.urcate === T6.length,
      `la gata: Satelit ${la.activ ? 'aplicat' : 'NEAPLICAT'}, peticul pe ${la.petic}, baza pe ${la.teren}, harta_v9 la ${la.v9} texeli lățime (întreaga are ${LAT['harta_v9-orto_v1']}), ${la.urcate} texturi urcate pe placă`);
    proba(x.transcodate.length === T6.length && x.octeti === S6, `transcodate până la Satelit: ${x.transcodate.length} texturi, ${MB(x.octeti)} MB (${x.octeti} octeți)`);
    proba(r.avert.length === 0 && r.dispuse === 1, `avertismente ${r.avert.length}${r.avert[0] ? ` („${r.avert[0]}”)` : ''}, încărcătorul eliberat de ${r.dispuse} ori`);
    if (V) {
      const rv = await porneste({ M: V });
      const xv = descrie(rv), lv = rv.la ?? {};
      const bun = lv.v === true && xv.devreme === T6.length && xv.mic === 0 && lv.v9 === LAT['harta_v9-orto_v1'] && lv.petic === 'harta_v5-orto_v1';
      proba(!bun, `control, ${NUME_V}: ${xv.devreme} cereri înaintea construcției, ${xv.mic} cereri -mic, la gata harta_v9 la ${lv.v9} texeli și peticul pe ${lv.petic} — pică`);
    } else proba(false, `control, ${NUME_V}, o singură treaptă: nu s-a putut citi din git`);
  }

  // (c) Progresul: crește, numai pe procente întregi, și ajunge la exact 1 când au sosit toți
  //     octeții, înaintea compilării. Totalul e suma lui `octeti` din cele șase sidecaruri: cu
  //     numai baza sosită, procentul e al ei din total. Control: fără `laOcteti`, nimic.
  {
    const masoara = async (M) => {
      deLaZero();
      const valori = [];
      let gataCompilarea = null;
      const r = { ...renderer(true), compileAsync: () => new Promise((res) => { gataCompilarea = res; }) };
      retinute = (u) => u.endsWith('.ktx2') && !u.endsWith('/harta_v4-orto_v1.ktx2');
      const d = deschide({ M, r, laProgres: (f) => valori.push(f) });
      const g = urmareste(d.sat.gata);
      await curge(() => jurnal.some((e) => e.transcodata === 'harta_v4-orto_v1'), 200_000);
      await curge(() => false, 500);
      const cuBaza = [...valori];
      retinute = () => false;
      raspundeRetinutelor();
      await curge(() => gataCompilarea !== null || g.gata, 200_000);
      await curge(() => false, 500);
      const laCompilare = [...valori];
      gataCompilarea?.();
      await curge(() => g.gata, 200_000);
      const rez = { cuBaza, laCompilare, final: [...valori], g, avert: [...avert] };
      d.sat.dispose();
      await curge(() => false, 200);
      return rez;
    };
    const ob = OCTETI.get('harta_v4-orto_v1'), asteptat = Math.floor((100 * ob) / S6) / 100;
    const m = await masoara(S);
    const crescator = m.final.every((v, i) => i === 0 || v > m.final[i - 1]);
    const intregi = m.final.every((v) => Number.isInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9);
    proba(m.g.v === true && crescator && intregi && m.cuBaza.at(-1) === asteptat && m.laCompilare.at(-1) === 1 && m.final.filter((v) => v === 1).length === 1 && m.avert.length === 0,
      `progresul: ${m.final.length} valori, ${crescator ? 'crescătoare' : 'NU crescătoare'}, ${intregi ? 'pe procente întregi' : 'NU pe procente întregi'}; cu baza sosită singură ${m.cuBaza.at(-1) ?? 'nimic'} (așteptat ${asteptat} = ⌊100 × ${ob} / ${S6}⌋ / 100, suma celor 6 sidecaruri); ${m.laCompilare.at(-1) ?? 'nimic'} cu toți octeții, înaintea compilării; ${m.final.filter((v) => v === 1).length} × 1`);
    const fara = await mutatie(['garda, laOcteti, laDescarcat }', 'garda, laDescarcat }']);
    if (fara) {
      const c = await masoara(fara);
      const zero = (v) => v.every((x) => x === 0);
      proba(zero(c.cuBaza) && zero(c.laCompilare),
        `control, fără laOcteti: cu baza sosită ${c.cuBaza.at(-1) ?? 'nimic'}, cu toți octeții ${c.laCompilare.at(-1) ?? 'nimic'} — contorul rămâne la 0, pică`);
    } else proba(false, `control, fără laOcteti: ${NEAPLICATA}`);
  }

  // (d) Garda fotografiei, pe ceasul virtual. Corpul bazei trimite 1 KB și tace: la 19,999 s
  //     încă în așteptare, la 20 s `gata` false, cu un singur avertisment și fără temporizatoare
  //     rămase. O bază care curge încet — 10 bucăți la 15 s — nu e oprită, și nici o transcodare
  //     de 25 s după ultimul octet: garda păzește numai rețeaua. Controale: satelit.js de la
  //     REPER_VECHI, fără gardă, tot în așteptare după 300 s; garda oprită numai la capătul
  //     încărcării, nu și când rețeaua și-a terminat treaba, pierde transcodarea lungă.
  {
    const N = L.INACTIVITATE_PORNIRE_MS;
    const BAZA = '/data/harta_v4-orto_v1.ktx2';
    const caz = (M, sp) => {
      deLaZero();
      special = sp;
      const d = deschide({ M });
      d.laCadru();
      return { d, g: urmareste(d.sat.gata) };
    };
    // Celelalte cinci texturi sosesc și se transcodează pe loc; numai baza rămâne.
    const restulGata = () => curge(() => jurnal.filter((e) => e.transcodata && e.transcodata !== 'harta_v4-orto_v1').length >= T6.length - 1, 200_000);
    {
      const { d, g } = caz(S, (u) => (u === BAZA ? blocat() : null));
      await restulGata();
      await curge(() => false, 500);
      await avanseaza(N - 1);
      const devreme = g.gata;
      await avanseaza(1);
      await curge(() => g.gata, 20_000);
      const { b, anunt } = butonul(d);
      const oprita = jurnal.find((e) => e.url === BAZA)?.semnal?.aborted;
      proba(!devreme && g.gata && g.v === false && avert.length === 1 && /a fotografiei aeriene n-a primit vreun octet în 20 s/.test(avert[0] ?? '') && ceas.t.size === 0 && oprita,
        `baza tace după 1 KB: la ${(N - 1) / 1000} s ${devreme ? 'terminat (prea devreme)' : 'încă în așteptare'}, la ${N / 1000} s ${g.gata ? `gata ${g.v}` : 'tot în așteptare'}; avertismente ${avert.length}${avert[0] ? ` („${avert[0]}”)` : ''}, temporizatoare rămase ${ceas.t.size}, cererea bazei ${oprita ? 'oprită' : 'NEOPRITĂ'}`);
      proba(b.hidden && anunt.textContent === ESEC, `apoi: butonul ${b.hidden ? 'scos' : 'RĂMAS'}, anunțul „${anunt.textContent}”`);
      d.sat.dispose();
      await curge(() => false, 200);
    }
    if (V) {
      const { d, g } = caz(V, (u) => (u === BAZA ? blocat() : null));
      await restulGata();
      await avanseaza(300_000);
      proba(!g.gata, `control, ${NUME_V}, fără gardă: după 300 s ${g.gata ? `gata ${g.v}` : 'tot în așteptare'} — pică`);
      d.sat.dispose();
      await elibereazaToate();
    } else proba(false, `control, ${NUME_V}, fără gardă: nu s-a putut citi din git`);
    const incet = async (M) => {
      const { d, g } = caz(M, (u) => (u === BAZA ? lent(BAZA, 10, 15_000) : null));
      await restulGata();
      // Până la închiderea corpului, la 165 s, apoi fără alt timp virtual: verificarea sha256 a
      // celor 4 MB durează câteva ms adevărate, iar ceasul virtual, sărit mai departe, ar fi
      // sunat garda (rearmată la 150 s) înaintea ei — un artefact al probei, nu al paginii.
      await avanseaza(165_000);
      await curge(() => g.gata, 200_000);
      const rez = { g, activ: d.sat.activ, avert: [...avert], timere: ceas.t.size };
      d.sat.dispose();
      await curge(() => false, 200);
      return rez;
    };
    {
      const t = await incet(S);
      proba(t.g.v === true && t.activ && t.avert.length === 0 && t.timere === 0,
        `baza în 10 bucăți la 15 s (165 s în total): ${t.g.gata ? `gata ${t.g.v}` : 'tot în așteptare'}, Satelit ${t.activ ? 'aplicat' : 'NEAPLICAT'}, avertismente ${t.avert.length}${t.avert[0] ? ` („${t.avert[0]}”)` : ''}, temporizatoare rămase ${t.timere}`);
      // Control: o gardă pe care bucățile nu o rearmează — un termen pe durata totală.
      const faraRearmare = await mutatie(['cereri: cereri.get(n), garda, laOcteti',
        'cereri: cereri.get(n), garda: { semnal: garda.semnal, get motiv() { return garda.motiv; }, progres() {} }, laOcteti']);
      if (faraRearmare) {
        const c = await incet(faraRearmare);
        proba(c.g.v === false, `control, fără rearmare la bucăți: ${c.g.gata ? `gata ${c.g.v}` : 'tot în așteptare'}${c.avert[0] ? ` („${c.avert[0]}”)` : ''} — pică`);
      } else proba(false, `control, fără rearmare la bucăți: ${NEAPLICATA}`);
    }
    const lunga = async (M) => {
      deLaZero();
      intarziere = (n) => (n === 'harta_v4-orto_v1' ? 25_000 : 0);
      const d = deschide({ M });
      const g = urmareste(d.sat.gata);
      await restulGata();
      await curge(() => false, 500);
      await avanseaza(26_000);
      await curge(() => g.gata, 20_000);
      const rez = { g, avert: [...avert], activ: d.sat.activ };
      d.sat.dispose();
      await curge(() => false, 200);
      return rez;
    };
    const t = await lunga(S);
    proba(t.g.v === true && t.activ && t.avert.length === 0,
      `transcodarea bazei de 25 s după ultimul octet: ${t.g.gata ? `gata ${t.g.v}` : 'tot în așteptare'}, avertismente ${t.avert.length}`);
    const faraRetea = await mutatie(['garda, laOcteti, laDescarcat }', 'garda, laOcteti }']);
    if (faraRetea) {
      const c = await lunga(faraRetea);
      proba(c.g.v === false, `control, garda oprită numai la capătul încărcării: ${c.g.gata ? `gata ${c.g.v}` : 'tot în așteptare'}${c.avert[0] ? ` („${c.avert[0]}”)` : ''} — pică`);
    } else proba(false, `control, garda oprită numai la capătul încărcării: ${NEAPLICATA}`);
    // Importul încărcătorului KTX2 care nu mai vine (un chunk agățat): garda tot oprește
    // încărcarea la 20 s, fiindcă așteptarea lui trece prin `panaLa`. Control: așteptat direct,
    // `gata` nu mai iese niciodată — iar pornirea, care îl așteaptă, ar sta pe loc.
    const agatat = ['creeazaIncarcatorKtx2(renderer);', 'new Promise(() => {});'];
    const importAgatat = async (M) => {
      deLaZero();
      const d = deschide({ M });
      const g = urmareste(d.sat.gata);
      await curge(() => false, 500);
      await avanseaza(N - 1);
      const devreme = g.gata;
      await avanseaza(1);
      await curge(() => g.gata, 2000);
      await avanseaza(300_000);
      const ktx = jurnal.filter((e) => e.url?.endsWith('.ktx2'));
      const rez = { devreme, g, avert: [...avert], oprite: ktx.filter((e) => e.semnal?.aborted).length, ktx: ktx.length, timere: ceas.t.size };
      d.sat.dispose();
      await curge(() => false, 200);
      return rez;
    };
    const Mi = await mutatie(agatat);
    const Mc = await mutatie(agatat, ['ktx2 = await panaLa(incarcator, semnal);', 'ktx2 = await incarcator;']);
    if (Mi && Mc) {
      const t = await importAgatat(Mi);
      proba(!t.devreme && t.g.v === false && t.avert.length === 1 && /a fotografiei aeriene/.test(t.avert[0] ?? '') && t.oprite === t.ktx && t.ktx === T6.length && t.timere === 0,
        `importul încărcătorului agățat: la ${(N - 1) / 1000} s ${t.devreme ? 'terminat (prea devreme)' : 'încă în așteptare'}, apoi gata ${t.g.gata ? t.g.v : 'ÎN AȘTEPTARE'}; ${t.oprite} din ${t.ktx} cereri .ktx2 oprite, avertismente ${t.avert.length}, temporizatoare rămase ${t.timere}`);
      const c = await importAgatat(Mc);
      proba(!c.g.gata, `control, importul așteptat fără panaLa: după 300 s ${c.g.gata ? `gata ${c.g.v}` : 'tot în așteptare'} — pică`);
    } else proba(false, `importul încărcătorului agățat și controlul lui fără panaLa: ${NEAPLICATA}`);
  }

  // (e) Ieșirea (`faraSatelit`, butonul „Arată relieful acum”): abandonată cât se descarcă,
  //     cererile se opresc, `gata` iese false, preferința rămâne neschimbată, iar butonul Satelit
  //     rămâne vizibil, neapăsat și neocupat, fără avertismente; un clic apoi aduce tot și aplică.
  //     Abandonată înaintea creării, nu pleacă nimic. Control: ieșirea de dinainte, un clic pe
  //     butonul ocupat, scrie preferința Relief.
  {
    const iese = async (M, cum) => {
      deLaZero();
      retinute = (u) => u.endsWith('.ktx2');
      const ac = new AbortController();
      const d = deschide({ M, faraSatelit: ac.signal });
      d.laCadru();
      const { rad, b, anunt } = butonul(d);
      const g = urmareste(d.sat.gata);
      await curge(() => false, 2000);
      if (cum === 'faraSatelit') ac.abort(); else clic(b);
      await curge(() => g.gata, 20_000);
      await curge(() => false, 500);
      const ktx = jurnal.filter((e) => e.url?.endsWith('.ktx2'));
      const st = {
        gata: g.gata, v: g.v, preferinta, vizibil: !rad.hidden && !b.hidden, apasat: b.atribute['aria-pressed'], ocupat: b.atribute['aria-busy'] ?? null,
        anunt: anunt.textContent, oprite: ktx.filter((e) => e.semnal?.aborted).length, ktx: ktx.length, avert: avert.length,
        transcodate: jurnal.filter((e) => e.transcodata).length,
      };
      retinute = () => false;
      raspundeRetinutelor();
      await curge(() => false, 2000);
      return { d, b, st };
    };
    const descrieIesirea = (st) => `gata ${st.gata ? st.v : 'ÎN AȘTEPTARE'}, ${st.oprite} din ${st.ktx} cereri .ktx2 oprite, ${st.transcodate} transcodate, preferința ${st.preferinta}, butonul ${st.vizibil ? 'vizibil' : 'ASCUNS'}, aria-pressed ${st.apasat}, aria-busy ${st.ocupat}, anunțul „${st.anunt}”, avertismente ${st.avert}`;
    const bunaIesire = (st) => st.gata && st.v === false && st.oprite === T6.length && st.ktx === T6.length && st.transcodate === 0 && st.preferinta === null
      && st.vizibil && st.apasat === 'false' && st.ocupat === null && st.anunt === '' && st.avert === 0;
    const { d, b, st } = await iese(S, 'faraSatelit');
    proba(bunaIesire(st), `faraSatelit abandonat cât se descarcă: ${descrieIesirea(st)}`);
    const inainte = jurnal.length;
    clic(b);
    await curge(() => d.sat.activ, 200_000);
    const din = jurnal.slice(inainte), cerute = T6.filter((n) => din.some((e) => e.url === `/data/${n}.ktx2`)).length;
    const s = stare(d);
    proba(s.activ && preferinta === 'satelit' && cerute === T6.length && s.petic === 'harta_v5-orto_v1' && s.v9 === LAT['harta_v9-orto_v1'] && avert.length === 0,
      `apoi clic pe Satelit: ${s.activ ? 'aplicat' : 'NEAPLICAT'}, ${cerute} din ${T6.length} texturi cerute din nou, peticul pe ${s.petic}, harta_v9 la ${s.v9} texeli, preferința ${preferinta}, avertismente ${avert.length}`);
    d.sat.dispose();
    await curge(() => false, 200);
    const c = await iese(S, 'clic');
    proba(!bunaIesire(c.st), `control, ieșirea de dinainte (clic pe butonul ocupat): ${descrieIesirea(c.st)} — pică`);
    c.d.sat.dispose();
    await curge(() => false, 200);
    if (V) {
      const cv = await iese(V, 'faraSatelit');
      proba(!bunaIesire(cv.st), `control, ${NUME_V}, care nu știe de faraSatelit: ${descrieIesirea(cv.st)} — pică`);
      cv.d.sat.dispose();
      await elibereazaToate();
    } else proba(false, `control, ${NUME_V}, care nu știe de faraSatelit: nu s-a putut citi din git`);
    // Abandonată înaintea creării: cererile pornite devreme se opresc, nimic nu se transcodează.
    deLaZero();
    retinute = (u) => u.endsWith('.ktx2');
    const ac = new AbortController();
    ac.abort();
    const d2 = deschide({ M: S, faraSatelit: ac.signal });
    const g2 = urmareste(d2.sat.gata);
    await curge(() => g2.gata, 20_000);
    await curge(() => false, 1000);
    const { rad: r2, b: b2 } = butonul(d2);
    const ktx2 = jurnal.filter((e) => e.url?.endsWith('.ktx2'));
    const op2 = ktx2.filter((e) => e.semnal?.aborted).length, tr2 = jurnal.filter((e) => e.transcodata).length;
    proba(g2.v === false && op2 === T6.length && tr2 === 0 && !r2.hidden && !b2.hidden && b2.atribute['aria-pressed'] === 'false' && !b2.atribute['aria-busy'] && preferinta === null && avert.length === 0 && dispuse === 1,
      `faraSatelit abandonat înaintea creării: gata ${g2.v}, ${op2} din ${ktx2.length} cereri devreme oprite, ${tr2} transcodate, butonul ${!r2.hidden && !b2.hidden ? 'vizibil' : 'ASCUNS'}, aria-pressed ${b2.atribute['aria-pressed']}, preferința ${preferinta}, încărcătorul eliberat de ${dispuse} ori`);
    retinute = () => false;
    raspundeRetinutelor();
    d2.sat.dispose();
    await curge(() => false, 200);
  }

  // (f) Fără niciun format comprimat: cererea peticului, pornită devreme, se oprește și nu se
  //     transcodează nimic din ea; plasa lui rămâne pe textura bazei, iar împrejurimile de 2 m
  //     (harta_v6, harta_v9) merg la 4 m. Control: satelit.js de la REPER_VECHI transcodează peticul.
  for (const M of [S, V]) {
    if (!M) { proba(false, `control, ${NUME_V}, fără compresie: nu s-a putut citi din git`); continue; }
    const r = await porneste({ M, compresie: false });
    const cerere = r.jurnal.find((e) => e.url === '/data/harta_v5-orto_v1.ktx2');
    const transcodat = r.jurnal.some((e) => e.transcodata === 'harta_v5-orto_v1');
    const la = r.la ?? {};
    if (M === S) proba(la.v === true && cerere?.semnal?.aborted && !transcodat && la.petic === 'harta_v4-orto_v1' && la.v9 === LAT['harta_v9-orto_v1'] / 2 && la.v6 === LAT['harta_v6-orto_v1'] / 2,
      `fără compresie: Satelit ${la.v ? 'pornit' : 'NEPORNIT'}, cererea peticului ${cerere ? (cerere.semnal?.aborted ? 'oprită' : 'NEOPRITĂ') : 'lipsă'}, ${transcodat ? 'TRANSCODAT' : 'netranscodat'}, plasa lui pe ${la.petic}; harta_v9 la ${la.v9} texeli (4 m), harta_v6 la ${la.v6}`);
    else proba(transcodat, `control, ${NUME_V}, fără compresie: peticul ${transcodat ? 'transcodat' : 'netranscodat'} — pică`);
  }

  // (g) Preferința Relief și `?previzualizare`: nimic nu pleacă devreme, iar Satelit cere numai
  //     sidecarul bazei până la primul clic. Control: preferința Satelit.
  {
    deLaZero('relief');
    const hr = S.descarcaSatelit({ renderer: renderer(true), numeBaza: 'harta_v4', numePetic: 'harta_v5', imprejurimi: NUME_IMP });
    preferinta = null;
    const hp = S.descarcaSatelit({ renderer: renderer(true), numeBaza: 'harta_v4', numePetic: 'harta_v5', imprejurimi: NUME_IMP, fortatRelief: true });
    proba(hr === null && hp === null && jurnal.length === 0, `preferința Relief și ?previzualizare: ${jurnal.length} cereri devreme`);
    deLaZero('relief');
    const d = deschide({ M: S });
    await curge(() => false, 3000);
    const cereri = jurnal.filter((e) => e.url).map((e) => e.url.replace('/data/', ''));
    proba(cereri.length === 1 && cereri[0] === 'harta_v4-orto_v1.json' && avert.length === 0, `preferința Relief, până la primul clic: ${cereri.join(', ') || 'nicio cerere'}`);
    d.sat.dispose();
    deLaZero('satelit');
    const hs = S.descarcaSatelit({ renderer: renderer(true), numeBaza: 'harta_v4', numePetic: 'harta_v5', imprejurimi: NUME_IMP });
    proba(hs && jurnal.filter((e) => e.url).length === 2 * T6.length, `control, preferința Satelit: ${jurnal.filter((e) => e.url).length} cereri devreme`);
    hs?.abandoneaza();
    preferinta = null;
    await curge(() => false, 200);
  }

  // (h) Transcodorul pleacă odată cu texturile, după sidecarul bazei, nu după prima textură
  //     sosită și verificată: cu fișierele .ktx2 reținute, se cere oricum. Control: satelit.js
  //     de la REPER_VECHI, unde îl cerea prima textură verificată.
  for (const M of [S, V]) {
    if (!M) { proba(false, `control, ${NUME_V}, transcodorul până la prima textură: nu s-a putut citi din git`); continue; }
    deLaZero();
    retinute = (u) => u.endsWith('.ktx2');
    const d = deschide({ M });
    await curge(() => false, 2000);
    const cerut = marcaLa(jurnal, 'transcodor') >= 0;
    if (M === S) proba(cerut, `cu fișierele .ktx2 încă în drum, transcodorul ${cerut ? 'cerut' : 'NECERUT'}`);
    else proba(!cerut, `control, ${NUME_V}: transcodorul ${cerut ? 'cerut' : 'necerut'} până la prima textură — pică`);
    d.sat.dispose();
    retinute = () => false;
    await elibereazaToate();
    await curge(() => false, 200);
  }

  // (i) Un deploy fără texturi: transcodorul (~0,6 MB) pleacă numai după sidecarul bazei, deci
  //     nu se mai descarcă degeaba. Control: cu texturile la locul lor, se cere.
  for (const faraTexturi of [true, false]) {
    deLaZero();
    lipsa = faraTexturi ? (u) => /-orto_v1\.(json|ktx2)$/.test(u) : () => false;
    const d = deschide({ M: S });
    const g = urmareste(d.sat.gata);
    await curge(() => g.gata, 200_000);
    const cerut = marcaLa(jurnal, 'transcodor') >= 0;
    if (faraTexturi) proba(g.v === false && !cerut, `fără nicio textură pe server: Satelit ${g.v ? 'PORNIT' : 'nepornit'}, transcodorul ${cerut ? 'CERUT' : 'necerut'}`);
    else proba(g.v === true && cerut, `control, cu texturile: transcodorul ${cerut ? 'cerut' : 'necerut'}`);
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (j) `dispose()` oprește și cererile pornite devreme, încă nepreluate sau în zbor, fără
  //     avertismente, iar încărcătorul se eliberează o singură dată. Control: fără dispose(),
  //     cererile reținute rămân deschise.
  for (const elibereaza of [true, false]) {
    deLaZero();
    retinute = (u) => u.endsWith('.ktx2');
    const d = deschide({ M: S });
    await curge(() => false, 2000);
    if (elibereaza) d.sat.dispose();
    await curge(() => false, 2000);
    const ktx = jurnal.filter((e) => e.url?.endsWith('.ktx2'));
    const oprite = ktx.filter((e) => e.semnal?.aborted).length;
    if (elibereaza) proba(ktx.length === T6.length && oprite === ktx.length && avert.length === 0 && dispuse === 1 && ceas.t.size === 0,
      `dispose() cu fișierele în zbor: ${oprite} din ${ktx.length} cereri oprite, avertismente ${avert.length}, încărcătorul eliberat de ${dispuse} ori, temporizatoare rămase ${ceas.t.size}`);
    else proba(oprite === 0, `control, fără dispose(): ${oprite} din ${ktx.length} cereri oprite`);
    if (!elibereaza) d.sat.dispose();
    retinute = () => false;
    await curge(() => false, 200);
  }

  // (k) Harta o singură dată, pe sursa lui scena.js: relieful → toate datele → garda pornirii
  //     oprită → descarcaSatelit (cu peticul) → creeazaTeren → creeazaSatelit (cu mânerul,
  //     progresul și ieșirea) → compileAsync → faza fotografiei → așteptarea lui Satelit, numai pe
  //     calea automată → bucla. Fără `primulCadru` și fără `data-panouri`. Construcția cere WebGL,
  //     deci ordinea se păzește pe sursă; că primul cadru e chiar Satelit se vede în pagină
  //     (CLAUDE.md). Legăturile lui creeazaSatelit se cer ca text exact: progresul spre
  //     `laIncarcare`, ieșirea `faraSatelit` ca valoare, iar `faraSatelit` trecut de `porneste` lui
  //     `construieste`, pe aceeași poziție în apel și în semnătură. Controale: scena.js de la
  //     REPER_VECHI, cel de azi fără peticul cerut devreme, fără garda oprită după date, cu
  //     așteptarea mutată după buclă, cu `faraSatelit: null`, cu `laProgres: undefined` și fără
  //     `faraSatelit` în apelul lui `construieste`.
  {
    const LA_PROGRES = 'laProgres: laIncarcare ? (fractie) => laIncarcare({ fractie }) : undefined';
    const ordine = (src) => {
      const i = (s, de = 0) => src.indexOf(s, de);
      const relief = i('await asteapta(reliefGata)');
      const toate = i('await asteapta(Promise.all([sanctuarGata, cladiriGata, imprejurimiGata]))');
      // garda oprită după date: prima oprire de după ele, înaintea cererilor Satelit
      const garda = toate >= 0 ? i('garda.opreste();', toate) : -1;
      const dSat = i('descarcaSatelit({'), teren = i('creeazaTeren(relief'), cSat = i('creeazaSatelit({');
      // Opțiunile lui creeazaSatelit, fără acolada de deschidere și fără golul de la capăt.
      const optSat = cSat >= 0 ? src.slice(cSat + 'creeazaSatelit({'.length, i('});', cSat)).trimEnd() : '';
      const cuPetic = /descarcaSatelit\(\{[^}]*\bnumePetic:/.test(src);
      const cuManer = /\bdescarcare: descarcareSatelit\b/.test(optSat);
      const cuProgres = optSat.includes(LA_PROGRES);
      // `faraSatelit` ca valoare: prescurtat sau `faraSatelit: faraSatelit` — nu `null`, nu altceva.
      const cuIesire = /(?:^|,)\s*faraSatelit\s*(?::\s*faraSatelit\s*)?(?:,|$)/.test(optSat);
      // `faraSatelit` din `porneste` în `construieste`: aceeași poziție în apel și în semnătură.
      const argumente = (re) => re.exec(src)?.[1].split(',').map((s) => s.trim()) ?? null;
      const apel = argumente(/\bawait construieste\(([^)]*)\)/), semn = argumente(/\basync function construieste\(([^)]*)\)/);
      const kApel = apel?.indexOf('faraSatelit') ?? -1, kSemn = semn?.indexOf('faraSatelit') ?? -1;
      const iesireLegata = kApel >= 0 && kApel === kSemn && apel.length === semn.length;
      const comp = i('await renderer.compileAsync(scena, camera)');
      const automat = i('if (satelit?.automat)', comp);
      const faza = i("laIncarcare?.({ faza: 'fotografie' })", comp);
      const astept = i('await asteaptaSatelitul(satelit.gata, faraSatelit)', comp);
      const bucla = i('renderer.setAnimationLoop(() =>');
      const vechi = /primulCadru|dataset\.panouri/.test(src);
      const ok = relief > 0 && toate > relief && garda > toate && dSat > garda && teren > dSat && cSat > teren && cuPetic
        && cuManer && cuProgres && cuIesire && iesireLegata
        && comp > cSat && automat > comp && faza > automat && astept > faza && bucla > astept && !vechi;
      return { ok, relief, toate, garda, dSat, teren, cSat, comp, automat, faza, astept, bucla, cuPetic, cuManer, cuProgres, cuIesire, kApel, kSemn, iesireLegata, vechi };
    };
    const azi = textSursa('src/scene/scena.js');
    const o = ordine(azi);
    proba(o.ok, `scena.js: relieful (${o.relief}) → toate datele (${o.toate}) → garda oprită (${o.garda}) → descarcaSatelit (${o.dSat}, ${o.cuPetic ? 'cu' : 'FĂRĂ'} peticul) → creeazaTeren (${o.teren}) → creeazaSatelit (${o.cSat}: mânerul ${o.cuManer ? 'dat' : 'NEDAT'}, progresul ${o.cuProgres ? 'spre laIncarcare' : 'NELEGAT'}, ieșirea ${o.cuIesire ? 'faraSatelit' : 'NEDATĂ'}) → compileAsync (${o.comp}) → numai pe calea automată (${o.automat}): faza fotografiei (${o.faza}) → așteptarea lui Satelit (${o.astept}) → bucla (${o.bucla}); faraSatelit în construieste: argumentul ${o.kApel} în apel, ${o.kSemn} în semnătură; primulCadru / data-panouri: ${o.vechi ? 'ÎNCĂ ACOLO' : 'scoase'}`);
    const vechi = textVechi('src/scene/scena.js');
    const ov = vechi === null ? null : ordine(vechi);
    proba(ov !== null && !ov.ok, `control, scena.js de la ${REPER_VECHI}: ${ov === null ? 'NECITIT' : `garda oprită după date la ${ov.garda}, descarcaSatelit la ${ov.dSat}, așteptarea lui Satelit la ${ov.astept}`} — pică`);
    /** Un control pe o mutație a lui scena.js de azi: trebuie să se aplice și să strice ordinea. */
    const control = (text, mutat, ce) => {
      const om = mutat === null ? null : ordine(mutat);
      proba(om !== null && !om.ok, `control, ${text}: ${om === null ? NEAPLICATA : ce(om)} — pică`);
    };
    control('scena.js de azi fără numePetic', muta(azi, [/(descarcaSatelit\(\{[^}]*?)\bnumePetic:[^,]*,\s*/, '$1']), () => 'peticul necerut devreme');
    const dupaDate = o.toate > 0 ? azi.indexOf('garda.opreste();', o.toate) : -1;
    control('fără garda oprită după date', dupaDate > 0 ? azi.slice(0, dupaDate) + azi.slice(dupaDate + 'garda.opreste();'.length) : null,
      (om) => `prima oprire după ele la ${om.garda}`);
    // Blocul așteptării, mutat imediat după `setAnimationLoop(...)`: bucla ar desena întâi Relief.
    const bloc = /\n {2}if \(satelit\?\.automat\) \{[\s\S]*?\n {2}\}\n/.exec(azi)?.[0] ?? '';
    const fara = bloc ? azi.replace(bloc, '\n') : azi;
    const capBucla = fara.indexOf('\n', fara.indexOf('  });', fara.indexOf('renderer.setAnimationLoop(() =>'))) + 1;
    control('așteptarea lui Satelit mutată după buclă', bloc && capBucla > 0 ? fara.slice(0, capBucla) + bloc.replace(/^\n/, '') + fara.slice(capBucla) : null,
      (om) => `${om.astept} față de ${om.bucla}`);
    control('`faraSatelit: null` printre opțiunile lui creeazaSatelit', muta(azi, [/(creeazaSatelit\(\{[\s\S]*?\n\s*)faraSatelit,/, '$1faraSatelit: null,']),
      (om) => `ieșirea ${om.cuIesire ? 'dată' : 'nedată'}`);
    control('`laProgres: undefined`', muta(azi, [LA_PROGRES, 'laProgres: undefined']), (om) => `progresul ${om.cuProgres ? 'legat' : 'nelegat'}`);
    control('`faraSatelit` scos din apelul lui construieste', muta(azi, [/(await construieste\([^)]*?), faraSatelit\)/, '$1)']),
      (om) => `argumentul ${om.kApel} în apel, ${om.kSemn} în semnătură`);
  }

  // (k2) `asteaptaSatelitul`, așteptarea din scena.js: se hotărăște la prima dintre `gata` și
  //      ieșire, o promisiune respinsă trece drept Satelit eșuat, iar ascultătorul de pe semnal
  //      pleacă oricum s-ar fi hotărât. Pe semnale numărate. Control: o cursă simplă
  //      (`Promise.race`), cu un ascultător care rămâne și o respingere care urcă.
  {
    const { asteaptaSatelitul } = await import('../src/scene/scena.js');
    const semnal = () => {
      const c = new AbortController(), s = c.signal, a0 = s.addEventListener.bind(s), r0 = s.removeEventListener.bind(s);
      let vii = 0;
      s.addEventListener = (t, f, o) => { vii++; a0(t, f, o); };
      s.removeEventListener = (t, f, o) => { vii--; r0(t, f, o); };
      return { c, s, vii: () => vii };
    };
    const cursa = (gata, s) => Promise.race([gata, new Promise((res) => s.addEventListener('abort', () => res(false), { once: true }))]);
    const caz = async (f) => {
      let laGata;
      const gata = new Promise((res, rej) => { laGata = { res, rej }; });
      const q = semnal();
      const r = { v: undefined, respins: false };
      const p = f(gata, q.s).then((v) => { r.v = v; }, () => { r.respins = true; });
      await new Promise((res) => setImmediate(res));
      return { gata: laGata, q, r, p, curge: () => new Promise((res) => setImmediate(res)) };
    };
    const scenarii = async (f) => {
      // 1. ieșirea întâi: false pe loc, înaintea lui `gata`
      const a = await caz(f);
      a.q.c.abort();
      await a.curge();
      const iesire = a.r.v === false;
      a.gata.res(true);
      await a.p;
      // 2. `gata` întâi: true, ascultătorul plecat
      const b = await caz(f);
      b.gata.res(true);
      await b.p;
      // 3. `gata` respinsă: false, fără respingere
      const c = await caz(f);
      c.gata.rej(new Error('Satelit căzut'));
      await c.p.catch(() => {});
      await c.curge();
      return { iesire, viiDupaIesire: a.q.vii(), gata: b.r.v, viiDupaGata: b.q.vii(), respinsa: c.r.respins ? 'respinsă' : String(c.r.v) };
    };
    const z = await scenarii(asteaptaSatelitul);
    proba(z.iesire && z.gata === true && z.respinsa === 'false' && z.viiDupaIesire === 0 && z.viiDupaGata === 0,
      `asteaptaSatelitul: ieșirea întâi → false pe loc (${z.iesire ? 'da' : 'NU'}); gata întâi → ${z.gata}; gata respinsă → ${z.respinsa}; ascultători rămași pe semnal: ${z.viiDupaIesire} după ieșire, ${z.viiDupaGata} după gata`);
    const zc = await scenarii(cursa);
    proba(!(zc.respinsa === 'false' && zc.viiDupaGata === 0), `control, Promise.race simplu: gata respinsă → ${zc.respinsa}; ascultători rămași după gata: ${zc.viiDupaGata} — pică`);
  }

  // (k3) `automat`: Satelit se încarcă singur la pornire — numai atunci îl așteaptă scena.js. Pe
  //      calea automată da; cu preferința Relief, cu `?previzualizare` și cu ieșirea dată înaintea
  //      creării, nu: harta e gata, nu are ce aștepta. Control: `automat` pus înaintea verificării
  //      preferinței — cu preferința Relief harta n-ar mai apărea până la sidecarul texturii.
  {
    const automat = async (M, pref, fortat, iesitInainte) => {
      deLaZero(pref);
      const c = new AbortController();
      if (iesitInainte) c.abort();
      const r = renderer(true), teren = plasa(), petic = plasa(), mare = plasa(), soare = new THREE.DirectionalLight();
      const sat = M.creeazaSatelit({
        renderer: r, scena: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), teren, petic, mare, drapaj: [], soare,
        cer: null, umbre: null, centru, numeBaza: 'harta_v4', numePetic: 'harta_v5', gazda: element(), cereRandare: () => {},
        laSursa: () => {}, fortatRelief: fortat, imprejurimi: NUME_IMP.map((nume) => ({ nume, obiect: plasa().obiect })), faraSatelit: c.signal,
      });
      const v = sat.automat;
      sat.dispose();
      await curge(() => false, 200);
      return v;
    };
    const cazuri = async (M) => ({
      automat: await automat(M, null, false, false), relief: await automat(M, 'relief', false, false),
      previzualizare: await automat(M, null, true, false), iesit: await automat(M, null, false, true),
    });
    const a = await cazuri(S);
    proba(a.automat === true && a.relief === false && a.previzualizare === false && a.iesit === false,
      `automat: pe calea automată ${a.automat}, cu preferința Relief ${a.relief}, cu ?previzualizare ${a.previzualizare}, cu ieșirea dată înainte ${a.iesit}`);
    const Mut = await mutatie(['    fara?.addEventListener(\'abort\', laFaraSatelit, { once: true });\n    automat = true;\n', '    fara?.addEventListener(\'abort\', laFaraSatelit, { once: true });\n'],
      ['  const gata = (async () => {\n', '  const gata = (async () => {\n    automat = true;\n']);
    const m = Mut ? await cazuri(Mut) : null;
    proba(m !== null && m.relief === true, `control, \`automat\` pus înaintea preferinței: ${m === null ? NEAPLICATA : `cu preferința Relief ${m.relief}`} — pică`);
  }

  // (l) Calea Relief → clic. Cu preferința Relief, un clic pe Satelit îl face apăsat — starea spre
  //     care merge — și ocupat, cu anunțul încărcării. Un al doilea clic, cât se descarcă,
  //     înseamnă „rămân pe Relief”: preferința 'relief', cererile oprite, nimic transcodat după
  //     el, Satelit neaplicat; un clic următor cere tot din nou și aplică, cu peticul. Control:
  //     satelit.js de la REPER_VECHI, unde al doilea clic cerea tot Satelit. La capăt se așteaptă
  //     eliberarea încărcătoarelor: codul de atunci își elibera a doua treaptă abia după o
  //     verificare sha256 pe timp real, iar eliberarea cădea altfel în cazul următor.
  for (const M of [S, V]) {
    if (!M) { proba(false, `control, ${NUME_V}, al doilea clic în timpul descărcării: nu s-a putut citi din git`); continue; }
    deLaZero('relief');
    const d = deschide({ M });
    d.laCadru();   // numai pentru codul în două trepte, al controalelor
    const { b, anunt } = butonul(d);
    const g = urmareste(d.sat.gata);
    await curge(() => g.gata, 20_000);
    retinute = (u) => u.endsWith('.ktx2');
    clic(b);
    const laPrimul = { ocupat: b.atribute['aria-busy'], apasat: b.atribute['aria-pressed'], anunt: anunt.textContent };
    await curge(() => false, 2000);
    clic(b);
    const laAlDoilea = jurnal.length;
    const dupaClic = { preferinta, apasat: b.atribute['aria-pressed'], ocupat: b.atribute['aria-busy'] ?? null };
    const ktx = jurnal.filter((e) => e.url?.endsWith('.ktx2'));
    const oprite = ktx.filter((e) => e.semnal?.aborted).length;
    retinute = () => false;
    raspundeRetinutelor();
    await curge(() => (M === S ? false : d.sat.activ), M === S ? 3000 : 200_000);
    const dupa = jurnal.slice(laAlDoilea);
    const transcodate = dupa.filter((e) => e.transcodata).length, cereri = dupa.filter((e) => e.url).length;
    if (M === S) {
      proba(laPrimul.ocupat === 'true' && laPrimul.apasat === 'true' && laPrimul.anunt === ANUNT,
        `preferința Relief, clic pe Satelit: aria-busy ${laPrimul.ocupat}, aria-pressed ${laPrimul.apasat}, anunțul „${laPrimul.anunt}”`);
      proba(dupaClic.preferinta === 'relief' && dupaClic.apasat === 'false' && dupaClic.ocupat === null && ktx.length === T6.length && oprite === ktx.length,
        `al doilea clic, în timpul descărcării: preferința ${dupaClic.preferinta}, aria-pressed ${dupaClic.apasat}, aria-busy ${dupaClic.ocupat}, ${oprite} din ${ktx.length} cereri .ktx2 oprite`);
      proba(!d.sat.activ && transcodate === 0 && cereri === 0 && avert.length === 0 && dispuse === 1,
        `după el: Satelit ${d.sat.activ ? 'APLICAT' : 'neaplicat'}, ${transcodate} texturi transcodate și ${cereri} cereri noi, avertismente ${avert.length}, încărcătorul eliberat de ${dispuse} ori`);
      const inainte = jurnal.length;
      clic(b);
      await curge(() => d.sat.activ, 200_000);
      const din = jurnal.slice(inainte), cerute = T6.filter((n) => din.some((e) => e.url === `/data/${n}.ktx2`)).length;
      const s = stare(d);
      proba(s.activ && preferinta === 'satelit' && b.atribute['aria-pressed'] === 'true' && !b.atribute['aria-busy'] && cerute === T6.length && s.petic === 'harta_v5-orto_v1' && avert.length === 0,
        `al treilea clic: Satelit ${s.activ ? 'aplicat' : 'NEAPLICAT'}, ${cerute} din ${T6.length} texturi cerute din nou, peticul pe ${s.petic}; avertismente ${avert.length}`);
    } else {
      proba(d.sat.activ && preferinta === 'satelit',
        `control, ${NUME_V}, al doilea clic în timpul descărcării: Satelit ${d.sat.activ ? 'aplicat' : 'neaplicat'}, preferința ${preferinta} — pică`);
    }
    d.sat.dispose();
    await elibereazaToate();
    await curge(() => false, 200);
  }

  // (m) Renunțarea târzie, pe calea Relief → clic: texturile au trecut de ultima așteptare
  //     (compilarea ținută). Încărcarea se termină, dar Satelit nu se aplică; un clic următor
  //     aplică pe loc, fără nicio cerere nouă. Un dublu-clic CU compilarea încă în curs —
  //     renunțarea, apoi clicul — aplică la capătul ei, cu peticul și harta_v9 întregi. Control:
  //     satelit.js de la REPER_VECHI aplică la al doilea clic.
  for (const [M, varianta] of [[S, 'renunta'], [S, 'apoi'], [S, 'dublu'], [V, 'renunta']]) {
    if (!M) { proba(false, `control, ${NUME_V}, clic cu compilarea în curs: nu s-a putut citi din git`); continue; }
    deLaZero('relief');
    let gataCompilarea = null;
    const r = { ...renderer(true), compileAsync: () => new Promise((res) => { gataCompilarea = res; }) };
    const d = deschide({ M, r });
    d.laCadru();   // numai pentru codul în două trepte, al controalelor
    const { b } = butonul(d);
    await curge(() => false, 2000);
    clic(b);
    await curge(() => gataCompilarea !== null, 200_000);
    clic(b);
    if (varianta === 'dublu') {
      clic(b);
      gataCompilarea();
      await curge(() => d.sat.activ, 200_000);
      const s = stare(d);
      proba(s.activ && preferinta === 'satelit' && s.petic === 'harta_v5-orto_v1' && s.v9 === LAT['harta_v9-orto_v1'] && avert.length === 0,
        `dublu-clic cu compilarea în curs: Satelit ${s.activ ? 'aplicat' : 'NEAPLICAT'}, plasa peticului pe ${s.petic}, harta_v9 la ${s.v9} texeli, avertismente ${avert.length}`);
      d.sat.dispose();
      await curge(() => false, 200);
      continue;
    }
    gataCompilarea();
    await curge(() => false, 3000);
    const activ0 = d.sat.activ;
    if (M !== S) {
      proba(activ0, `control, ${NUME_V}, clic cu compilarea în curs: Satelit ${activ0 ? 'aplicat' : 'neaplicat'} — pică`);
    } else if (varianta === 'renunta') {
      proba(!activ0 && preferinta === 'relief' && dispuse === 1 && avert.length === 0,
        `renunțare cu compilarea în curs: Satelit ${activ0 ? 'APLICAT' : 'neaplicat'}, preferința ${preferinta}, încărcătorul eliberat de ${dispuse} ori, avertismente ${avert.length}`);
    } else {
      const inainte = jurnal.length;
      clic(b);
      const peLoc = d.sat.activ, noi = jurnal.slice(inainte).filter((e) => e.url).length;
      const s = stare(d);
      proba(!activ0 && peLoc && noi === 0 && s.petic === 'harta_v5-orto_v1' && avert.length === 0,
        `apoi clic pe Satelit: aplicat ${peLoc ? 'pe loc' : 'NU'}, ${noi} cereri noi, peticul pe ${s.petic}`);
    }
    d.sat.dispose();
    await elibereazaToate();
    await curge(() => false, 200);
  }

  // (n) Eșecul pornirii automate: baza lipsă (404) — butonul pleacă, cu anunțul eșecului.
  {
    deLaZero();
    lipsa = (u) => u === '/data/harta_v4-orto_v1.ktx2';
    const d = deschide({ M: S });
    const { b, anunt } = butonul(d);
    const g = urmareste(d.sat.gata);
    await curge(() => g.gata, 200_000);
    proba(g.v === false && b.hidden && !b.atribute['aria-busy'] && anunt.textContent === ESEC && avert.some((a) => a.includes('harta_v4-orto_v1 lipsește')) && ceas.t.size === 0,
      `baza lipsă la pornire: butonul ${b.hidden ? 'scos' : 'RĂMAS'}, anunțul „${anunt.textContent}”, avertismente ${avert.length}, temporizatoare rămase ${ceas.t.size}`);
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (o) Contextul WebGL pierdut chiar când sosește încărcătorul: `detectSupport` vede atunci
  //     toate extensiile lipsă. Satelit așteaptă refacerea contextului și reface configurația
  //     înaintea primei transcodări, deci texturile ies comprimate, iar peticul vine. Pe codul
  //     de dinainte (recenzia): RGBA, ~71 MB pe placă, fără petic, toată sesiunea.
  {
    deLaZero();
    let pierdut = true;
    const asc = {};
    const r = {
      ...renderer(true),
      extensions: { has: (n) => !pierdut && n === 'EXT_texture_compression_bptc', get: () => null },
      getContext: () => ({ isContextLost: () => pierdut }),
      domElement: { addEventListener: (t, f) => (asc[t] ??= new Set()).add(f), removeEventListener: (t, f) => asc[t]?.delete(f) },
    };
    const d = deschide({ M: S, r });
    const g = urmareste(d.sat.gata);
    await curge(() => false, 2000);
    const transcodateCatPierdut = jurnal.filter((e) => e.transcodata).length;
    pierdut = false;
    for (const f of [...(asc.webglcontextrestored ?? [])]) f();
    await curge(() => g.gata, 200_000);
    const fmt = d.teren.obiect.material.map?.format;
    const petic = numeTextura.get(d.petic.obiect.material.map);
    proba(g.v === true && transcodateCatPierdut === 0 && fmt === THREE.RGBA_BPTC_Format && petic === 'harta_v5-orto_v1' && (asc.webglcontextrestored?.size ?? 0) === 0,
      `context pierdut la sosirea încărcătorului, refăcut apoi: ${transcodateCatPierdut} texturi transcodate cât era pierdut, baza ${fmt === THREE.RGBA_BPTC_Format ? 'BC7' : fmt === THREE.RGBAFormat ? 'RGBA NECOMPRIMAT' : fmt}, plasa peticului pe ${petic}, ascultători rămași ${asc.webglcontextrestored?.size ?? 0}`);
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (p) Renunțarea pe o rețea care oprește încet cererile: încercarea nouă o așteaptă pe cea
  //     oprită, deci încărcătoarele nu se suprapun — altfel three avertiza „Multiple active KTX2
  //     loaders” (văzut în pagină, cu .ktx2 întârziate). Un al patrulea clic, dat cât încercarea
  //     nouă încă așteaptă, o oprește și pe ea: nicio cerere a ei.
  for (const patruClicuri of [false, true]) {
    deLaZero('relief');
    const d = deschide({ M: S });
    await curge(() => false, 2000);
    const { b } = butonul(d);
    abortLent = true;
    retinute = (u) => u.endsWith('.ktx2');
    clic(b);
    await curge(() => false, 2000);
    clic(b);
    await curge(() => false, 200);
    const laClic3 = jurnal.length;
    clic(b);
    await curge(() => false, 2000);
    if (patruClicuri) clic(b);
    retinute = () => false;
    raspundeRetinutelor();
    abortLent = false;
    await curge(() => d.sat.activ, patruClicuri ? 5000 : 200_000);
    await curge(() => false, 500);
    const noi = jurnal.slice(laClic3).filter((e) => e.url?.endsWith('.ktx2')).length;
    if (!patruClicuri) proba(d.sat.activ && maxVii === 1 && avert.length === 0,
      `pornit, oprit, pornit iar, cu cererile oprite încet: Satelit ${d.sat.activ ? 'aplicat' : 'NEAPLICAT'}, cel mult ${maxVii} încărcător viu odată, avertismente ${avert.length}`);
    else proba(!d.sat.activ && preferinta === 'relief' && noi === 0 && maxVii === 1 && avert.length === 0,
      `al patrulea clic, cu încercarea nouă încă în așteptare: Satelit ${d.sat.activ ? 'APLICAT' : 'neaplicat'}, preferința ${preferinta}, ${noi} cereri .ktx2 ale ei, cel mult ${maxVii} încărcător viu`);
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (q) Baza căzută oprește tot, pe loc (`opresteTot`): fără ea nu există Satelit, iar celelalte
  //     cinci s-ar fi descărcat și transcodat degeaba, cu harta ținută pe mesajul de încărcare.
  //     Fișierul bazei cu 404, sau sidecarul ei fără soarele zborului, cu celelalte texturi lente —
  //     10 bucăți la 6 s, corpul închis la 66 s —: `gata` false la 0 s virtuale, celelalte cereri
  //     .ktx2 oprite, nimic transcodat, un singur avertisment, al bazei. Control: `opresteTot` făcut
  //     no-op — `gata` vine abia după celelalte texturi, la 66 s.
  {
    const BAZA = '/data/harta_v4-orto_v1.ktx2', SC_BAZA = '/data/harta_v4-orto_v1.json';
    const lente = (u) => (u.endsWith('.ktx2') ? lent(u, 10, 6_000) : null);
    const faraSoare = JSON.stringify({ ...SIDECAR('harta_v4-orto_v1'), soare_zbor: undefined });
    const cazuri = [
      ['fișierul bazei cu 404', (u) => u === BAZA, lente, /^textura Satelit harta_v4-orto_v1 lipsește \(HTTP 404\)$/],
      ['sidecarul bazei fără soarele zborului', () => false, (u) => (u === SC_BAZA ? new Response(faraSoare, { status: 200 }) : lente(u)),
        /^textura Satelit harta_v4-orto_v1: sidecarul n-are soarele zborului sau marea$/],
    ];
    const cade = async (M, lipseste, sp) => {
      deLaZero();
      lipsa = lipseste;
      special = sp;
      const d = deschide({ M });
      const g = urmareste(d.sat.gata);
      let la = null;
      d.sat.gata.then(() => { la = ceas.acum; });
      // Fără timp virtual: baza cade pe loc, iar celelalte n-au trimis încă nicio bucată.
      await curge(() => g.gata, 20_000);
      // Codul care nu oprește tot: până la închiderea corpurilor lente, apoi fără alt timp virtual —
      // verificarea sha256 a celorlalte merge pe timp real, ca la (d).
      if (!g.gata) {
        await avanseaza(66_000);
        await curge(() => g.gata, 200_000);
      }
      const ktx = jurnal.filter((e) => e.url?.endsWith('.ktx2') && !lipseste(e.url));
      const rez = {
        v: g.gata ? g.v : 'ÎN AȘTEPTARE', la, avert: [...avert], ktx: ktx.length, oprite: ktx.filter((e) => e.semnal?.aborted).length,
        transcodate: jurnal.filter((e) => e.transcodata).length, anunt: butonul(d).anunt.textContent,
      };
      d.sat.dispose();
      await elibereazaToate();
      return rez;
    };
    const descrieCaderea = (x) => `gata ${x.v} la ${x.la === null ? '—' : `${x.la / 1000} s`} virtuale, ${x.oprite} din ${x.ktx} cereri .ktx2 ${x.ktx === T6.length ? '(toate, cu a bazei)' : '(celelalte)'} oprite, `
      + `${x.transcodate} texturi transcodate, anunțul „${x.anunt}”, avertismente ${x.avert.length}${x.avert.length ? ` (${x.avert.map((a) => `„${a}”`).join('; ')})` : ''}`;
    const faraOprire = await mutatie(['const opresteTot = () => { if (!semnal.aborted) garda.abandoneaza(); };', 'const opresteTot = () => {};']);
    for (const [text, lipseste, sp, re] of cazuri) {
      const x = await cade(S, lipseste, sp);
      const celelalte = T6.length - (lipseste(BAZA) ? 1 : 0);
      proba(x.v === false && x.la === 0 && x.ktx === celelalte && x.oprite === x.ktx && x.transcodate === 0 && x.anunt === ESEC && x.avert.length === 1 && re.test(x.avert[0]),
        `${text}, celelalte texturi lente: ${descrieCaderea(x)}`);
      if (faraOprire) {
        const c = await cade(faraOprire, lipseste, sp);
        proba(!(c.v === false && c.la === 0 && c.oprite === c.ktx && c.transcodate === 0), `control, ${text}, cu opresteTot no-op: ${descrieCaderea(c)} — pică`);
      } else proba(false, `control, ${text}, cu opresteTot no-op: ${NEAPLICATA}`);
    }
  }

  // (r) `reanunta()`, chemat de scena.js când harta apare (`arata`): un anunț scris cât panoul
  //     era ascuns până la `data-scena` (main.css) n-a ajuns la cititorul de ecran. După eșecul
  //     bazei pe calea automată golește anunțul și îl scrie din nou la 150 ms — o schimbare a unei
  //     regiuni care se vede; fără anunț — pornirea reușită, ieșirea — nu scrie nimic, și nici după
  //     dispose(). Control: reanunta fără golire, care scrie același text peste el: nicio schimbare.
  {
    /** Scrierile în `el.textContent` de acum încolo: clipa virtuală de la `t0`, textul, dacă l-au schimbat. */
    const inregistreaza = (el, t0) => {
      let t = el.textContent;
      const scrieri = [];
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get: () => t,
        set: (v) => { const nou = String(v); scrieri.push({ la: ceas.acum - t0, text: nou, schimbare: nou !== t }); t = nou; },
      });
      return scrieri;
    };
    const descrieScrierile = (s) => (s.length ? s.map((x) => `„${x.text}” la +${x.la} ms${x.schimbare ? '' : ' (FĂRĂ SCHIMBARE)'}`).join(', ') : 'nicio scriere');
    const reanunta = async (M, cum) => {
      deLaZero();
      if (cum === 'esec' || cum.startsWith('dispose')) lipsa = (u) => u === '/data/harta_v4-orto_v1.ktx2';
      const iesire = cum === 'iesire' ? new AbortController() : null;
      if (iesire) retinute = (u) => u.endsWith('.ktx2');
      const d = deschide({ M, faraSatelit: iesire?.signal });
      const g = urmareste(d.sat.gata);
      if (iesire) { await curge(() => false, 2000); iesire.abort(); }
      await curge(() => g.gata, 200_000);
      const { anunt } = butonul(d);
      const inainte = anunt.textContent, t0 = ceas.acum;
      const scrieri = inregistreaza(anunt, t0);
      if (cum === 'dispose') d.sat.dispose();
      d.sat.reanunta();
      const peLoc = anunt.textContent;
      if (cum === 'dispose-intre') d.sat.dispose();
      await avanseaza(149);
      const la149 = anunt.textContent;
      await avanseaza(1001);
      const rez = { v: g.gata ? g.v : 'ÎN AȘTEPTARE', inainte, peLoc, la149, final: anunt.textContent, scrieri };
      if (!cum.startsWith('dispose')) d.sat.dispose();
      retinute = () => false;
      raspundeRetinutelor();
      await elibereazaToate();
      return rez;
    };
    const bunEsec = (x) => x.v === false && x.inainte === ESEC && x.peLoc === '' && x.la149 === '' && x.final === ESEC && x.scrieri.length === 2
      && x.scrieri[0].text === '' && x.scrieri[0].la === 0 && x.scrieri[1].text === ESEC && x.scrieri[1].la === 150 && x.scrieri.every((s) => s.schimbare);
    const e = await reanunta(S, 'esec');
    proba(bunEsec(e), `după eșecul bazei (gata ${e.v}, anunțul „${e.inainte}”), reanunta: ${descrieScrierile(e.scrieri)}; la +149 ms „${e.la149}”, la capăt „${e.final}”`);
    for (const [cum, text] of [['reusit', 'după o pornire reușită'], ['iesire', 'după ieșire (faraSatelit)'], ['dispose', 'după dispose()']]) {
      const x = await reanunta(S, cum);
      proba(x.scrieri.length === 0 && x.inainte === x.final, `${text} (gata ${x.v}, anunțul „${x.inainte}”), reanunta: ${descrieScrierile(x.scrieri)}`);
    }
    const di = await reanunta(S, 'dispose-intre');
    proba(di.scrieri.filter((s) => s.la > 0).length === 0 && di.final === '', `reanunta, apoi dispose() înainte de 150 ms: ${descrieScrierile(di.scrieri)}; după dispose ${di.scrieri.some((s) => s.la > 0) ? 'SCRIE' : 'nimic'}`);
    const faraGolire = await mutatie(["      anunt.textContent = '';\n      setTimeout(() => { if (viu && !anunt.textContent) anunt.textContent = t; }, 150);",
      '      setTimeout(() => { if (viu) anunt.textContent = t; }, 150);']);
    if (faraGolire) {
      const c = await reanunta(faraGolire, 'esec');
      proba(!bunEsec(c), `control, reanunta fără golire (același text scris peste el): ${descrieScrierile(c.scrieri)}, ${c.scrieri.filter((s) => s.schimbare).length} schimbări — pică`);
    } else proba(false, `control, reanunta fără golire: ${NEAPLICATA}`);
  }

  globalThis.fetch = F0;
  globalThis.setTimeout = ST;
  globalThis.clearTimeout = CT;
  P.init = init0; P.parse = parse0; P.dispose = dispose0; P.detectSupport = detect0;
  if (D0 === undefined) delete globalThis.document; else globalThis.document = D0;
  delete globalThis.localStorage;
}

// ------------------------------------------------------------ eliberarea încărcătorului KTX2

// Un încărcător eliberat cu transcodorul încă în drum — o renunțare, un abandon — își face
// URL-ul workerului abia la sosire, iar `dispose()` din r186 îl revocă numai dacă există deja:
// ~60 KB de blob rămâneau cât trăiește pagina. `elibereazaKtx2` (loaders.js) îl revocă la
// sosire. Pe `init()` adevărat, cu un `fetch` care răspunde când i se spune și cu
// `URL.createObjectURL` numărat. Control: `dispose()` singur.
console.log('\nEliberarea încărcătorului KTX2 cu transcodorul în drum');
{
  const F = globalThis.fetch, C = URL.createObjectURL, R = URL.revokeObjectURL;
  const masoara = async (elibereaza) => {
    let sosire;
    const poarta = new Promise((r) => { sosire = r; });
    // Fără corp ca flux: FileLoader ar citi altfel pe bucăți, cu ProgressEvent, pe care Node nu-l are.
    globalThis.fetch = async () => { await poarta; return { status: 200, body: undefined, headers: new Headers(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(16) }; };
    const facute = new Set(), revocate = new Set();
    URL.createObjectURL = () => { const u = `blob:proba/${facute.size}`; facute.add(u); return u; };
    URL.revokeObjectURL = (u) => { revocate.add(u); };
    try {
      const k = new KTX2Loader().detectSupport({ extensions: { has: () => false, get: () => null } });
      const p = k.init();
      elibereaza(k);
      sosire();
      await p.catch(() => {});
      await curge(() => false, 50);
      return { facute: facute.size, ramase: [...facute].filter((u) => !revocate.has(u)).length };
    } finally {
      globalThis.fetch = F; URL.createObjectURL = C; URL.revokeObjectURL = R;
    }
  };
  const a = await masoara((k) => L.elibereazaKtx2(k));
  proba(a.facute === 1 && a.ramase === 0, `elibereazaKtx2 înaintea sosirii transcodorului: ${a.facute} URL făcut, ${a.ramase} nerevocat`);
  const c = await masoara((k) => k.dispose());
  proba(c.facute === 1 && c.ramase === 1, `control, dispose() singur: ${c.facute} URL făcut, ${c.ramase} nerevocat — pică`);
}

// ------------------------------------------------------------ mesajul de încărcare (main.js)

// main.js, cu `porneste` înlocuit și un DOM falsificat după index.html: faza fotografiei schimbă
// textul și arată butonul; procentul se scrie numai în ea, iar o fracție venită înainte se ține
// minte; clicul oprește așteptarea (`faraSatelit`) și dezactivează butonul; când harta apare,
// un focus rămas în mesaj trece pe butonul Satelit, iar apoi — o singură dată, după `data-scena`
// și după mutarea focusului — `scena.arata()` cere anunțurile scrise cât panourile erau ascunse.
// Controale: main.js de la REPER_VECHI, care nu știe de mesaj, și trei mutații ale celui de azi —
// fără `abort()`, procentul scris și înaintea fazei, fără apelul lui `arata`.
console.log('\nMesajul de încărcare (main.js): faza, procentul, ieșirea, focusul, anunțurile');
{
  const SRC = textSursa('src/main.js');
  const IMPORT = "import { porneste } from './scene/scena.js';";
  let nr = 0;
  const ruleaza = async (src) => {
    if (!src.includes(IMPORT)) return null;
    // Un DOM falsificat: numai ce citește main.js, după marcajul din index.html.
    const D0 = globalThis.document;
    const doc = { activeElement: null };
    const el = (tag, o = {}) => ({
      tag, hidden: false, disabled: false, copii: [], asc: {}, dataset: {}, ...o,
      get textContent() { return this.copii.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); },
      set textContent(t) { this.copii = t ? [String(t)] : []; },
      addEventListener(t, f) { (this.asc[t] ??= []).push(f); },
      removeEventListener() {},
      replaceChildren(...c) { this.copii = c; },
      append(...c) { this.copii.push(...c); },
      remove() {},
      focus() { doc.activeElement = this; },
      blur() { doc.activeElement = doc.body; },
      contains(x) { return x === this || this.copii.some((c) => typeof c === 'object' && c.contains?.(x)); },
      querySelector(s) { return this.sel?.[s] ?? null; },
    });
    const procent = el('span');
    const mesaj = el('p', { copii: ['Se încarcă harta 3D…', procent], sel: { span: procent } });
    const buton = el('button', { hidden: true });
    const incarcare = el('div', { copii: [mesaj, buton], sel: { '[role="status"]': mesaj, button: buton } });
    const satelit = el('button');
    const corp = el('body');
    Object.assign(doc, {
      body: corp, activeElement: corp,
      createElement: (t) => el(t),
      getElementById: (id) => (id === 'incarcare' ? incarcare : null),
      querySelector: (s) => ({ '#scena': el('canvas'), '#continut': el('main'), '#surse': null,
        '#straturi:not([hidden]) button:not([hidden])': satelit, '#incarcare': incarcare })[s] ?? null,
    });
    globalThis.document = doc;
    // `porneste` falsificat: ține minte opțiunile și se rezolvă când i se spune.
    const prins = {};
    globalThis.__pornesteProba = (canvas, o) => new Promise((res) => { prins.o = o; prins.rezolva = res; });
    const text = src.replace(IMPORT, 'const porneste = (...a) => globalThis.__pornesteProba(...a);')
      .replace(/from '\.\/((?:content|chapters)\/[^']+)'/g, (_, f) => `from '${new URL(`../src/${f}`, import.meta.url).href}'`);
    const f = join(tmpdir(), `cabo-main-${process.pid}-${nr++}.mjs`);
    writeFileSync(f, text);
    const info0 = console.info;
    console.info = () => {};
    try {
      const modul = import(pathToFileURL(f).href);
      for (let k = 0; k < 200 && !prins.o; k++) await new Promise((r) => setImmediate(r));
      const o = prins.o ?? {};
      const r = { functie: typeof o.laIncarcare === 'function', semnal: o.faraSatelit instanceof AbortSignal && !o.faraSatelit.aborted, arata: [] };
      const focusul = () => (doc.activeElement === satelit ? 'butonul Satelit' : doc.activeElement === buton ? 'butonul mesajului' : doc.activeElement?.tag ?? 'nimic');
      r.inainte = { text: mesaj.textContent, buton: !buton.hidden };
      o.laIncarcare?.({ fractie: 0.17 });
      r.fractieInainte = { text: mesaj.textContent, procent: procent.textContent };
      o.laIncarcare?.({ faza: 'fotografie' });
      r.faza = { text: mesaj.textContent, procent: procent.textContent, buton: !buton.hidden, procentInMesaj: mesaj.copii.includes(procent) };
      const pasi = [];
      for (const x of [0.42, 0.99, 1]) { o.laIncarcare?.({ fractie: x }); pasi.push(procent.textContent); }
      r.pasi = pasi;
      buton.focus();
      for (const g of buton.asc.click ?? []) g();
      r.clic = { oprit: o.faraSatelit?.aborted === true, dezactivat: buton.disabled };
      // Scena falsă ține minte fiecare `arata()`: starea paginii în clipa apelului.
      prins.rezolva?.({
        nrTriunghiuri: 0, petic: null, teren: {}, sanctuar: null, surse: [], memorie: () => '',
        arata: () => { r.arata.push({ scena: corp.dataset.scena, focus: focusul() }); },
      });
      await modul;
      r.dupa = { scena: corp.dataset.scena, focus: focusul() };
      return r;
    } finally {
      console.info = info0;
      rmSync(f, { force: true });
      delete globalThis.__pornesteProba;
      delete globalThis.__scena;
      if (D0 === undefined) delete globalThis.document; else globalThis.document = D0;
    }
  };
  const FAZA = 'Se încarcă fotografia aeriană…';
  const bun = (r) => r && r.functie && r.semnal && r.inainte.text === 'Se încarcă harta 3D…' && !r.inainte.buton
    && r.fractieInainte.procent === '' && r.faza.text === `${FAZA}17%` && r.faza.buton && r.faza.procentInMesaj
    && r.pasi.join(' ') === '42% 99% 100%' && r.clic.oprit && r.clic.dezactivat && r.dupa.scena === 'activa' && r.dupa.focus === 'butonul Satelit'
    && r.arata.length === 1 && r.arata[0].scena === 'activa' && r.arata[0].focus === 'butonul Satelit';
  const descrieArata = (r) => (r.arata.length ? `${r.arata.length} × scena.arata(), cu data-scena „${r.arata[0].scena}” și focusul pe ${r.arata[0].focus}` : 'scena.arata() NECHEMAT');
  const r = await ruleaza(SRC);
  proba(bun(r), r ? `main.js: laIncarcare ${r.functie ? 'dat' : 'LIPSĂ'}, faraSatelit ${r.semnal ? 'dat, neoprit' : 'LIPSĂ'}; la început „${r.inainte.text}”, butonul ${r.inainte.buton ? 'VIZIBIL' : 'ascuns'}; o fracție înaintea fazei: procent „${r.fractieInainte.procent}”; faza: „${r.faza.text}”, butonul ${r.faza.buton ? 'vizibil' : 'ASCUNS'}; pașii ${r.pasi.join(', ')}; clicul: așteptarea ${r.clic.oprit ? 'oprită' : 'NEOPRITĂ'}, butonul ${r.clic.dezactivat ? 'dezactivat' : 'ACTIV'}; harta: data-scena „${r.dupa.scena}”, focusul pe ${r.dupa.focus}; ${descrieArata(r)}` : 'main.js: importul lui porneste negăsit');
  const vechi = textVechi('src/main.js');
  const rv = vechi === null ? null : await ruleaza(vechi);
  proba(rv !== null && !bun(rv), `control, main.js de la ${REPER_VECHI}: ${rv === null ? 'NECITIT' : `laIncarcare ${rv.functie ? 'dat' : 'lipsă'}, faraSatelit ${rv.semnal ? 'dat' : 'lipsă'}, mesajul „${rv.faza.text}”, ${descrieArata(rv)}`} — pică`);
  /** Un control pe o mutație a lui main.js de azi: trebuie să se aplice și să strice ce se probează. */
  const control = async (text, perechi, ce) => {
    const s = muta(SRC, ...perechi);
    const x = s === null ? null : await ruleaza(s);
    proba(x !== null && !bun(x), `control, ${text}: ${s === null ? NEAPLICATA : x === null ? 'importul lui porneste negăsit' : ce(x)} — pică`);
  };
  await control('fără `abort()` la clic', [['    iesire.abort();\n', '']], (x) => `așteptarea ${x.clic.oprit ? 'oprită' : 'neoprită'}`);
  await control('procentul scris și înaintea fazei', [['if (procent && fotografie && cat !== null)', 'if (procent && cat !== null)']],
    (x) => `„${x.fractieInainte.text}” cu „${x.fractieInainte.procent}”`);
  await control('fără apelul lui `scena.arata`', [['    scena.arata?.();\n', '']], descrieArata);
}

// ------------------------------------------------------------ pagina fără scenă

// Fără WebGL2, după o eroare la pornire sau cu bucla oprită, pagina arată textul fișei
// sanctuarului, cu sursele, din capitolul lui (src/chapters/sanctuar.js, numai DOM); titlul
// paginii (`h1`) stă ascuns vizual în `<header>`, în afara lui `#continut`, ca anunțul să se scrie
// în continuare într-un `#continut` gol. Pe un DOM falsificat care își scrie elementele ca HTML,
// iar documentul vine din index.html, citit ca browserul cu JavaScript pornit (`<noscript>` e
// text). Două probe:
//   - fișa etichetei e aceeași după extragere: eticheta.js de la REPER_ACCES și cea de azi, pe
//     același text, dau același outerHTML. Controale: două mutații ale capitolului de azi —
//     fără `rel` pe legături, fără `tabIndex` pe titlu —, ca proba să arate că DOM-ul fals
//     chiar le scrie;
//   - main.js pe calea fără scenă, cu `porneste` înlocuit: fără WebGL2, cu garda pornirii
//     expirată și după o excepție de după pornire, cu fișa etichetei încă în pagină. Controale:
//     main.js și index.html de la REPER_ACCES, `h1` pus în `#continut`, `<noscript>` pus acolo
//     și capitolul cu id-urile fișei.
console.log('\nPagina fără scenă: titlul, capitolul sanctuarului cu sursele, fișa neschimbată');
{
  const VOIDE = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  // Conținutul acestora e text: cu JavaScript pornit, și al lui <noscript>.
  const BRUTE = new Set(['script', 'style', 'noscript']);
  const scapa = (s, atr) => s.replace(/&/g, '&amp;').replace(atr ? /"/g : /[<>]/g, (c) => ({ '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]);
  const scoate = (n) => { if (n.parentNode) { n.parentNode.childNodes = n.parentNode.childNodes.filter((x) => x !== n); n.parentNode = null; } };
  class Text {
    constructor(t) { this.data = t; this.parentNode = null; }
    get nodeType() { return 3; }
    get textContent() { return this.data; }
    get outerHTML() { return scapa(this.data, false); }
    remove() { scoate(this); }
  }
  // Proprietățile pe care le scrie codul paginii și atributele în care se reflectă, ca în browser.
  const REFLECTATE = { id: 'id', className: 'class', type: 'type', href: 'href', rel: 'rel', target: 'target', lang: 'lang', title: 'title' };
  class Element {
    constructor(doc, tag) {
      Object.assign(this, { ownerDocument: doc, localName: tag.toLowerCase(), atribute: new Map(), childNodes: [], parentNode: null, asc: {}, dataset: {}, style: {} });
      this.classList = { toggle() {}, contains: () => false, add() {}, remove() {} };
    }
    get nodeType() { return 1; }
    get tagName() { return this.localName.toUpperCase(); }
    get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
    setAttribute(k, v) { this.atribute.set(k.toLowerCase(), String(v)); }
    getAttribute(k) { return this.atribute.get(k) ?? null; }
    hasAttribute(k) { return this.atribute.has(k); }
    removeAttribute(k) { this.atribute.delete(k); }
    toggleAttribute(k, f) { const da = f ?? !this.hasAttribute(k); if (da) this.setAttribute(k, ''); else this.removeAttribute(k); return da; }
    get hidden() { return this.hasAttribute('hidden'); }
    set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
    get tabIndex() { return Number(this.getAttribute('tabindex') ?? -1); }
    set tabIndex(v) { this.setAttribute('tabindex', v); }
    get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
    set textContent(t) { this.replaceChildren(...(t === '' || t == null ? [] : [String(t)])); }
    append(...n) {
      for (let c of n) {
        if (typeof c === 'string') c = new Text(c);
        scoate(c);
        c.parentNode = this;
        this.childNodes.push(c);
      }
    }
    appendChild(c) { this.append(c); return c; }
    replaceChildren(...n) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...n); }
    remove() { scoate(this); }
    contains(x) { for (let n = x; n; n = n.parentNode) if (n === this) return true; return false; }
    closest() { return null; }
    focus() { this.ownerDocument.activeElement = this; }
    blur() { this.ownerDocument.activeElement = this.ownerDocument.body; }
    addEventListener(t, f) { (this.asc[t] ??= []).push(f); }
    removeEventListener() {}
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
    getClientRects() { return []; }
    * descendenti() { for (const c of this.children) { yield c; yield* c.descendenti(); } }
    // Numai selectori simpli: tag, #id, .clasă, [atribut] și [atribut="valoare"], legați. Restul
    // — cu spațiu sau cu `:` — nu se potrivește cu nimic (#straturi, #busola: nu există aici).
    querySelectorAll(s) {
      const m = /^([a-z][\w-]*)?((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(s);
      if (!m) return [];
      const conditii = [...m[2].matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)];
      return [...this.descendenti()].filter((e) => (!m[1] || e.localName === m[1].toLowerCase()) && conditii.every((c) => (
        c[1] ? e.id === c[1] : c[2] ? e.className.split(/\s+/).includes(c[2]) : c[4] === undefined ? e.hasAttribute(c[3]) : e.getAttribute(c[3]) === c[4])));
    }
    querySelector(s) { return this.querySelectorAll(s)[0] ?? null; }
    get outerHTML() {
      const atr = [...this.atribute].map(([k, v]) => ` ${k}="${scapa(v, true)}"`).join('');
      if (VOIDE.has(this.localName)) return `<${this.localName}${atr}>`;
      return `<${this.localName}${atr}>${this.childNodes.map((n) => n.outerHTML).join('')}</${this.localName}>`;
    }
  }
  for (const [p, a] of Object.entries(REFLECTATE)) {
    Object.defineProperty(Element.prototype, p, { get() { return this.getAttribute(a) ?? ''; }, set(v) { this.setAttribute(a, v); } });
  }
  /** Un document gol, sau cu <body> din marcajul dat (index.html). */
  const document_ = (html) => {
    const doc = { asc: {} };
    doc.createElement = (t) => new Element(doc, t);
    doc.documentElement = new Element(doc, 'html');
    doc.body = new Element(doc, 'body');
    doc.documentElement.append(doc.body);
    doc.activeElement = doc.body;
    doc.getElementById = (id) => [...doc.documentElement.descendenti()].find((e) => e.id === id) ?? null;
    doc.querySelector = (s) => doc.documentElement.querySelector(s);
    doc.querySelectorAll = (s) => doc.documentElement.querySelectorAll(s);
    doc.addEventListener = (t, f) => { (doc.asc[t] ??= []).push(f); };
    doc.removeEventListener = () => {};
    if (html === undefined) return doc;
    const corp = /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)?.[1];
    if (corp === undefined) throw new Error('marcaj fără <body>');
    const re = /<!--[\s\S]*?-->|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)((?:\s+[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>|[^<]+/gi;
    let cur = doc.body, m;
    while ((m = re.exec(corp))) {
      if (m[0].startsWith('<!--')) continue;
      if (m[1]) {
        if (cur.localName !== m[1].toLowerCase()) throw new Error(`marcaj: </${m[1]}> în <${cur.localName}>`);
        cur = cur.parentNode;
      } else if (m[2]) {
        const e = doc.createElement(m[2]);
        for (const a of m[3].matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) e.setAttribute(a[1], a[2] ?? a[3] ?? a[4] ?? '');
        cur.append(e);
        if (BRUTE.has(e.localName)) {
          const sf = corp.toLowerCase().indexOf(`</${e.localName}`, re.lastIndex);
          if (sf < 0) throw new Error(`marcaj: <${e.localName}> neînchis`);
          if (sf > re.lastIndex) e.append(corp.slice(re.lastIndex, sf));
          re.lastIndex = corp.indexOf('>', sf) + 1;
        } else if (!VOIDE.has(e.localName)) cur = e;
      } else cur.append(m[0]);
    }
    if (cur !== doc.body) throw new Error(`marcaj: <${cur.localName}> neînchis`);
    return doc;
  };
  const toate = (doc) => [...doc.documentElement.descendenti()];
  const idDuble = (doc) => {
    const n = new Map();
    for (const e of toate(doc)) if (e.id) n.set(e.id, (n.get(e.id) ?? 0) + 1);
    return [...n].filter(([, k]) => k > 1).map(([id, k]) => `${id} ×${k}`);
  };
  const { SANCTUAR } = await import('../src/content/sanctuar.js');
  const NR_SURSE = [...SANCTUAR.fapte.map((f) => (f.surse ?? [f.sursa]).length), ...(SANCTUAR.conflicte ?? []).map((c) => c.surse.length)].reduce((a, b) => a + b, 0);
  const CAPITOL_JS = textSursa('src/chapters/sanctuar.js');
  const URL_CAPITOL = new URL('../src/chapters/sanctuar.js', import.meta.url).href;
  const temporare = [];
  /** Un modul din text, scris în directorul temporar; `capitol`: adresa capitolului de folosit. */
  const modul = async (src, { capitol = URL_CAPITOL, pastreaza = false } = {}) => {
    src = src.replace(/from '(three(?:\/[^']*)?)'/g, (_, s) => `from '${import.meta.resolve(s)}'`)
      .replace(/from '(?:\.\.|\.)\/chapters\/sanctuar\.js'/g, () => `from '${capitol}'`)
      .replace(/from '\.\/((?:content)\/[^']+)'/g, (_, f) => `from '${new URL(`../src/${f}`, import.meta.url).href}'`)
      .replace(/from '\.\/([^']+)'/g, (_, f) => `from '${new URL(`../src/scene/${f}`, import.meta.url).href}'`);
    const f = join(tmpdir(), `cabo-farascena-${process.pid}-${nrModul++}.mjs`);
    writeFileSync(f, src);
    if (pastreaza) { temporare.push(f); return pathToFileURL(f).href; }
    try { return await import(pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
  };
  /** Capitolul mutat, ca modul păstrat până la sfârșitul secțiunii; `null` dacă mutația nu se aplică. */
  const capitolMutat = async (...perechi) => { const s = muta(CAPITOL_JS, ...perechi); return s === null ? null : modul(s, { pastreaza: true }); };
  const D0 = globalThis.document, A0 = globalThis.addEventListener, R0 = globalThis.removeEventListener;
  globalThis.addEventListener = globalThis.removeEventListener = () => {};
  try {
    // 1. Fișa etichetei, cu același text, pe eticheta.js de la REPER_ACCES și pe cea de azi.
    const fisaDin = async (srcEticheta, capitol) => {
      if (srcEticheta === null) return null;
      const E = await modul(srcEticheta, { capitol });
      const doc = document_();
      globalThis.document = doc;
      const e = E.creeazaEticheta({ gazda: doc.body, canvas: doc.createElement('canvas'), camera: new THREE.PerspectiveCamera(), inaltimeLa: () => 0,
        ancora: [0, 100, 0], continut: SANCTUAR, laDeschidere: () => {}, laInchidere: () => {}, cereRandare: () => {} });
      const fisa = doc.getElementById('sanctuar-fisa');
      return { fisa: fisa?.outerHTML ?? '', tot: doc.body.outerHTML, legaturi: fisa?.querySelectorAll('a').length ?? 0, e };
    };
    const ETICHETA_JS = textSursa('src/scene/eticheta.js');
    const azi = await fisaDin(ETICHETA_JS);
    const vechi = await fisaDin(textVechi('src/scene/eticheta.js', REPER_ACCES));
    const la = (x) => (x === null ? 'NECITITĂ' : `${x.fisa.length} caractere, ${x.legaturi} legături`);
    proba(vechi !== null && azi.fisa.length > 3000 && azi.legaturi === NR_SURSE && azi.fisa === vechi.fisa && azi.tot === vechi.tot,
      `fișa etichetei, outerHTML: azi ${la(azi)}, la ${REPER_ACCES} ${la(vechi)} — ${vechi && azi.fisa === vechi.fisa ? 'identice' : 'DIFERITE'}; eticheta cu fișa, întregi: ${vechi && azi.tot === vechi.tot ? 'identice' : 'DIFERITE'}`);
    for (const [ce, perechi] of [['fără `rel` pe legături', [["{ href: q.url, rel: 'noopener', target: '_blank' }", "{ href: q.url, target: '_blank' }"]]],
      ['fără `tabIndex` pe titlu', [["{ id: 'sanctuar-fisa-titlu', tabIndex: -1 }", "{ id: 'sanctuar-fisa-titlu' }"]]]]) {
      const url = await capitolMutat(...perechi);
      const x = url === null ? null : await fisaDin(ETICHETA_JS, url);
      proba(x !== null && vechi !== null && x.fisa !== vechi.fisa, `control, capitolul ${ce}: ${x === null ? NEAPLICATA : `fișa ${x.fisa === vechi?.fisa ? 'IDENTICĂ' : `diferă (${x.fisa.length} caractere)`}`} — pică`);
    }

    // 2. main.js pe calea fără scenă.
    const MAIN_JS = textSursa('src/main.js'), INDEX = textSursa('index.html');
    const IMPORT = "import { porneste } from './scene/scena.js';";
    const CAZURI = {
      'fără WebGL2': async () => null,
      'garda pornirii': async () => { const e = new Error('datele n-au mai sosit'); e.name = 'TimeoutError'; throw e; },
      // Scena a pornit, cu fișa etichetei (cu id-urile ei) în pagină, apoi o excepție în main.js.
      'după pornire': async () => {
        const { creeazaFisa } = await import(URL_CAPITOL);
        globalThis.document.body.append(creeazaFisa(SANCTUAR).fisa);
        return { nrTriunghiuri: 0, petic: null, teren: {}, sanctuar: null, surse: [], arata() {}, memorie() { throw new Error('excepție de probă'); },
          dispose() { globalThis.__dispuse = (globalThis.__dispuse ?? 0) + 1; },
          renderer: { forceContextLoss() { globalThis.__pierdut = (globalThis.__pierdut ?? 0) + 1; } } };
      },
    };
    const faraScena = async (mainJs, index, caz, capitol = URL_CAPITOL) => {
      if (mainJs === null || index === null || !mainJs.includes(IMPORT)) return null;
      const doc = document_(index);
      globalThis.document = doc;
      globalThis.__pornesteProba = CAZURI[caz];
      globalThis.__dispuse = 0; globalThis.__pierdut = 0;
      const info0 = console.info;
      console.info = () => {};
      try {
        await modul(mainJs.replace(IMPORT, 'const porneste = (...a) => globalThis.__pornesteProba(...a);'), { capitol });
      } finally {
        console.info = info0;
        delete globalThis.__pornesteProba;
        delete globalThis.__modulPornit;
        delete globalThis.__scena;
      }
      const dispuse = globalThis.__dispuse, pierdut = globalThis.__pierdut;
      delete globalThis.__dispuse; delete globalThis.__pierdut;
      const continut = doc.getElementById('continut');
      const a = doc.activeElement, buton = continut.querySelector('button');
      const h1 = toate(doc).filter((e) => e.localName === 'h1');
      const legaturi = continut.querySelectorAll('a').filter((a) => /^https:\/\//.test(a.href) && a.target === '_blank' && a.rel === 'noopener');
      return {
        text: continut.textContent.length, santuario: continut.textContent.includes('Santuário'),
        anunt: continut.children[0]?.localName === 'p' && continut.children[0].textContent.startsWith('Harta 3D nu a putut porni'),
        reincearca: continut.querySelector('button')?.textContent ?? null,
        h1: h1.length, h1Afara: h1.length === 1 && !continut.contains(h1[0]) && h1[0].textContent === 'Cabo Espichel',
        duble: idDuble(doc), idInCapitol: [...continut.descendenti()].filter((e) => e.id).length,
        legaturi: legaturi.length, scena: doc.body.dataset.scena, canvas: doc.getElementById('scena') !== null,
        rol: continut.children[0]?.getAttribute('role') ?? null,
        focus: a && a === buton ? 'Reîncearcă' : a && a === continut.children[0] ? 'anunț' : a === doc.body ? '<body>' : 'altundeva',
        dispuse, pierdut,
      };
    };
    // Anunțul e `alert` peste tot. Focusul: pe „Reîncearcă” după garda pornirii, pe anunț după o
    // excepție de după pornire — harta fusese pe ecran —, neatins la încărcare, fără WebGL2. Scena
    // pornită se eliberează, o dată, cu contextul pierdut.
    const FOCUS = { 'fără WebGL2': '<body>', 'garda pornirii': 'Reîncearcă', 'după pornire': 'anunț' };
    const bun = (r, caz) => r !== null && r.text >= 2000 && r.santuario && r.anunt && r.h1 === 1 && r.h1Afara && r.duble.length === 0
      && r.idInCapitol === 0 && r.legaturi === NR_SURSE && r.scena === 'indisponibila' && !r.canvas
      && (caz === 'garda pornirii' ? r.reincearca === 'Reîncearcă' : r.reincearca === null)
      && r.rol === 'alert' && r.focus === FOCUS[caz] && r.dispuse === (caz === 'după pornire' ? 1 : 0) && r.pierdut === r.dispuse;
    const descrie = (r) => (r === null ? 'NECITIT' : `#continut ${r.text} caractere, „Santuário” ${r.santuario ? 'da' : 'NU'}, anunțul ${r.anunt ? 'primul' : 'LIPSĂ'}${r.reincearca ? `, „${r.reincearca}”` : ''}, ${r.legaturi} legături; h1 ${r.h1}${r.h1Afara ? ' (în afara lui #continut)' : ''}; id-uri duble ${r.duble.join(', ') || 'niciunul'}, id-uri în capitol ${r.idInCapitol}; data-scena „${r.scena}”, canvasul ${r.canvas ? 'RĂMAS' : 'scos'}; anunțul cu role „${r.rol}”, focusul pe ${r.focus}; scena eliberată de ${r.dispuse} ori, contextul pierdut de ${r.pierdut} ori`);
    for (const caz of Object.keys(CAZURI)) {
      const r = await faraScena(MAIN_JS, INDEX, caz);
      proba(bun(r, caz), `${caz}: ${descrie(r)}`);
    }
    // Controale.
    const control = async (ce, mainJs, index, caz, capitol) => {
      const r = await faraScena(mainJs, index, caz, capitol);
      proba(r !== null && !bun(r, caz), `control, ${ce} (${caz}): ${mainJs === null || index === null ? NEAPLICATA : descrie(r)} — pică`);
    };
    await control(`main.js de la ${REPER_ACCES}`, textVechi('src/main.js', REPER_ACCES), INDEX, 'fără WebGL2');
    await control(`index.html de la ${REPER_ACCES}`, MAIN_JS, textVechi('index.html', REPER_ACCES), 'fără WebGL2');
    await control('`h1` pus în #continut', MAIN_JS, muta(INDEX, ['    <header><h1 class="ascuns">Cabo Espichel</h1></header>\n', ''],
      ['<main id="continut"></main>', '<main id="continut"><h1 class="ascuns">Cabo Espichel</h1></main>']), 'fără WebGL2');
    const noscript = /^ {4}<noscript>.*<\/noscript>\n/m.exec(INDEX)?.[0] ?? null;
    await control('`<noscript>` pus în #continut', MAIN_JS, noscript === null ? null : muta(INDEX, [noscript, ''],
      ['<main id="continut"></main>', `<main id="continut">${noscript.trim()}</main>`]), 'fără WebGL2');
    await control('scena pornită neeliberată', muta(MAIN_JS, ['  elibereazaScena();\n  faraScena(e.message', '  faraScena(e.message']), INDEX, 'după pornire');
    await control('anunțul fără rol', muta(MAIN_JS, ["    anunt.setAttribute('role', 'alert');\n", '']), INDEX, 'fără WebGL2');
    await control('focusul nemutat', muta(MAIN_JS, ['    if (muta && (', '    if (false && (']), INDEX, 'garda pornirii');
    const cuId = await capitolMutat(["capitol = el('section', { className: 'capitol-sanctuar' });", "capitol = el('section', { className: 'capitol-sanctuar', id: 'sanctuar-fisa' });"],
      ["el('h2', {}, continut.nume)", "el('h2', { id: 'sanctuar-fisa-titlu' }, continut.nume)"]);
    if (cuId === null) proba(false, `control, capitolul cu id-urile fișei: ${NEAPLICATA} — pică`);
    else await control('capitolul cu id-urile fișei', MAIN_JS, INDEX, 'după pornire', cuId);
  } finally {
    for (const f of temporare) rmSync(f, { force: true });
    if (D0 === undefined) delete globalThis.document; else globalThis.document = D0;
    if (A0 === undefined) { delete globalThis.addEventListener; delete globalThis.removeEventListener; } else { globalThis.addEventListener = A0; globalThis.removeEventListener = R0; }
  }
}

// ------------------------------------------------------------ compilarea înaintea primului cadru

// three compilează programele la prima randare și așteaptă acolo, sincron, legarea fiecăruia:
// la prima vizită primul cadru ținea firul ~0,37 s, din care ~0,30 s numai legarea. scena.js
// le compilează întâi cu `compileAsync`, după ce toate plasele sunt în scenă și înaintea
// buclei. Între ele stă numai așteptarea fotografiei (`asteaptaSatelitul`; vezi „Satelit la
// pornire”, (k)), nicio altă așteptare. Timpii cer WebGL: în pagină (CLAUDE.md). Aici se
// păzește ordinea, pe sursă. Controale: scena.js de la REPER_VECHI, fără compilare, și sursa de
// azi cu compilarea mutată după `setAnimationLoop`.
console.log('\nCompilarea înaintea primului cadru (scena.js)');
{
  const COMPILA = 'try { await renderer.compileAsync(scena, camera); } catch', BUCLA = 'renderer.setAnimationLoop(() =>';
  const ordine = (src) => {
    const c = src.indexOf(COMPILA), b = src.indexOf(BUCLA), add = src.lastIndexOf('scena.add(');
    const bucata = c >= 0 && b > c ? src.slice(c + COMPILA.length, b) : null;
    const sat = bucata?.match(/\bawait asteaptaSatelitul\(/g)?.length ?? 0;
    const intre = bucata === null ? null : (bucata.match(/\bawait\b/g)?.length ?? 0) - sat;
    return { ok: c > 0 && add < c && b > c && intre === 0 && sat <= 1, c, b, add, intre, sat };
  };
  const azi = textSursa('src/scene/scena.js');
  const o = ordine(azi);
  proba(o.ok, `compileAsync (${o.c}) după ultimul scena.add (${o.add}) și înaintea buclei (${o.b}), cu ${o.intre} alte așteptări între ele în afara celei a fotografiei (${o.sat})`);
  const vechi = textVechi('src/scene/scena.js');
  proba(vechi !== null && !ordine(vechi).ok, `control, scena.js de la ${REPER_VECHI}: ${vechi === null ? 'NECITIT' : `compileAsync la ${ordine(vechi).c}`} — pică`);
  // Rândul compilării, scos și pus imediat după rândul buclei.
  const randul = (s, i) => [s.lastIndexOf('\n', i) + 1, s.indexOf('\n', i) + 1];
  let mutat = null;
  if (azi.includes(COMPILA) && azi.includes(BUCLA)) {
    const [a0, a1] = randul(azi, azi.indexOf(COMPILA));
    const fara = azi.slice(0, a0) + azi.slice(a1);
    const dupaBucla = randul(fara, fara.indexOf(BUCLA))[1];
    mutat = fara.slice(0, dupaBucla) + azi.slice(a0, a1) + fara.slice(dupaBucla);
  }
  const m = mutat === null ? null : ordine(mutat);
  proba(m !== null && !m.ok, `control, compilarea mutată după bucla: ${m === null ? NEAPLICATA : `${m.c} față de ${m.b}`} — pică`);
}

// ------------------------------------------------------------ anunțurile după apariția hărții

// Până la `data-scena`, panourile stau ascunse (main.css), deci în afara arborelui de
// accesibilitate: anunțurile scrise între timp în regiunile lor live — busola, eșecul fotografiei
// — nu le-a auzit nimeni, iar textul deja prezent al unei regiuni care apare nu se anunță. main.js
// cheamă atunci `scena.arata()` (proba de mai sus), iar ea, după două cadre ale paginii — în
// aceeași actualizare cu dezvăluirea tot nu s-ar anunța —, `reanunta()` pe busolă și pe Satelit
// (al lui Satelit: „Satelit la pornire”, (r)). `arata` trăiește în obiectul întors de
// construieste(), care cere WebGL: corpul ei se scoate din sursa lui scena.js și rulează cu o
// busolă, un Satelit și cadre ale paginii false. Busola se construiește întreagă, cu un DOM fals
// și pe ceasul virtual. Controale: `arata` care cheamă pe loc, `arata` fără Satelit, busola care
// scrie același text peste el.
console.log('\nAnunțurile după apariția hărții (scena.js, busola.js)');
{
  // `arata()` din scena.js, cu `busola` și `satelit` date și cu `viu` stins de `stinge()`.
  const SCENA = textSursa('src/scene/scena.js');
  const CAP = '    arata() {';
  const metoda = (src) => {
    const i = src.indexOf(CAP);
    if (i < 0) return null;
    let j = i + CAP.length - 1, ad = 0;
    for (; j < src.length; j++) {
      if (src[j] === '{') ad++;
      else if (src[j] === '}' && --ad === 0) break;
    }
    return src.slice(i + CAP.length - 1, j + 1);
  };
  const RAF = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  let cadre = [];
  globalThis.requestAnimationFrame = (f) => { cadre.push(f); return cadre.length; };
  const cadru = () => { const c = cadre; cadre = []; for (const f of c) f(); };
  /** Cheamă `arata()` și numără `reanunta()` pe busolă și pe Satelit, cadru cu cadru; `stingeLa` = cadrul la care scena se eliberează. */
  const ruleazaArata = (src, { cuBusola = true, cuSatelit = true, stingeLa = null } = {}) => {
    const corp = metoda(src);
    if (corp === null) return null;
    const chemari = [];
    let k = 0;
    const busola = cuBusola ? { reanunta: () => chemari.push(`busola@${k}`) } : null;
    const satelit = cuSatelit ? { reanunta: () => chemari.push(`satelit@${k}`) } : null;
    cadre = [];
    const s = new Function('busola', 'satelit', `let viu = true;\nreturn { arata() ${corp}, stinge() { viu = false; } };`)(busola, satelit);
    s.arata();
    for (; k < 3; ) {
      k++;
      if (stingeLa === k) s.stinge();
      cadru();
    }
    return chemari.join(', ') || 'nicio chemare';
  };
  const bunArata = (x) => x === 'busola@2, satelit@2';
  const a = ruleazaArata(SCENA);
  proba(bunArata(a), `scena.js, arata(): reanunta pe busolă și pe Satelit, la cadrul paginii: ${a ?? 'arata() NEGĂSITĂ'} (cerut amândouă la al doilea)`);
  const fara = [ruleazaArata(SCENA, { cuBusola: false }), ruleazaArata(SCENA, { cuSatelit: false }), ruleazaArata(SCENA, { stingeLa: 2 })];
  proba(fara[0] === 'satelit@2' && fara[1] === 'busola@2' && fara[2] === 'nicio chemare',
    `fără busolă: ${fara[0]}; fără Satelit: ${fara[1]}; scena eliberată înaintea celui de-al doilea cadru: ${fara[2]}`);
  const controlArata = (text, perechi) => {
    const s = muta(SCENA, ...perechi);
    const x = s === null ? null : ruleazaArata(s);
    proba(x !== null && !bunArata(x), `control, ${text}: ${s === null ? NEAPLICATA : x} — pică`);
  };
  controlArata('arata() care cheamă pe loc, în aceeași actualizare cu dezvăluirea',
    [['const cadruPagina = globalThis.requestAnimationFrame ?? ((f) => setTimeout(f, 16));', 'const cadruPagina = (f) => f();']]);
  controlArata('arata() fără Satelit', [['        satelit?.reanunta?.();\n', '']]);
  if (RAF) Object.defineProperty(globalThis, 'requestAnimationFrame', RAF); else delete globalThis.requestAnimationFrame;

  // Busola întreagă, cu un DOM fals și pe ceasul virtual: primul anunț la 600 ms; `reanunta()`
  // îl golește și îl scrie din nou după aceeași pauză — o schimbare a regiunii —; după dispose(),
  // nimic.
  globalThis.setTimeout = (f, ms = 0, ...x) => { const id = ceas.urm++; ceas.t.set(id, { la: ceas.acum + ms, f: () => f(...x) }); return id; };
  globalThis.clearTimeout = (id) => { ceas.t.delete(id); };
  const D0 = globalThis.document;
  const COLTURI = JSON.parse(readFileSync('public/data/harta_v4-dem.json', 'utf8')).colturi_geo;
  /** Busola din `M`, cu scrierile anunțului ei: clipa virtuală, textul, dacă l-au schimbat. */
  const busolaFalsa = (M) => {
    ceas.acum = 0; ceas.t.clear();
    const scrieri = [];
    const el = () => ({
      atribute: {}, asc: {}, textContent: '',
      setAttribute(n, v) { this.atribute[n] = String(v); }, getAttribute(n) { return this.atribute[n] ?? null; },
      addEventListener(t, f) { (this.asc[t] ??= []).push(f); }, removeEventListener(t, f) { this.asc[t] = (this.asc[t] ?? []).filter((g) => g !== f); },
      remove() { this.scos = true; },
    });
    let text = '';
    const anunt = el();
    Object.defineProperty(anunt, 'textContent', {
      get: () => text,
      set: (v) => { const nou = String(v); scrieri.push({ la: ceas.acum, text: nou, schimbare: nou !== text }); text = nou; },
    });
    const parti = { '.roza': el(), '.cadran': el(), '.citire': el(), '.anunt': anunt };
    const etichete = [['0', '-38'], ['38', '0'], ['0', '38'], ['-38', '0']].map(([x, y]) => { const e = el(); e.atribute.x = x; e.atribute.y = y; return e; });
    globalThis.document = {
      createElement: () => Object.assign(el(), { innerHTML: '', querySelector: (s) => parti[s] ?? null, querySelectorAll: (s) => (s === '.eticheta' ? etichete : []) }),
    };
    const controale = { getAzimuthalAngle: () => 0.6, addEventListener() {}, removeEventListener() {} };
    const b = M.creeazaBusola({ gazda: { appendChild() {} }, controale, colturi: COLTURI, laClic: () => {} });
    return { b, scrieri, anunt: () => text };
  };
  const descrie = (s) => (s.length ? s.map((x) => `„${x.text}” la ${x.la} ms${x.schimbare ? '' : ' (FĂRĂ SCHIMBARE)'}`).join(', ') : 'nicio scriere');
  const reanuntaBusola = async (M) => {
    const z = busolaFalsa(M);
    if (!z.b) return null;
    await avanseaza(600);
    const primul = z.anunt();
    const dinainte = z.scrieri.length;
    z.b.reanunta();
    const peLoc = z.anunt();
    await avanseaza(599);
    const la599 = z.anunt();
    await avanseaza(1);
    const dupa = z.scrieri.slice(dinainte);
    // După dispose(), reanunta nu mai scrie nimic.
    await avanseaza(1000);
    z.b.dispose();
    const laDispose = z.scrieri.length;
    z.b.reanunta();
    await avanseaza(2000);
    return { primul, peLoc, la599, dupa, dupaDispose: z.scrieri.slice(laDispose) };
  };
  const bunBusola = (x) => /^Privești dinspre /.test(x.primul) && x.peLoc === '' && x.la599 === '' && x.dupa.length === 2
    && x.dupa[0].text === '' && x.dupa[0].la === 600 && x.dupa[1].text === x.primul && x.dupa[1].la === 1200 && x.dupa.every((s) => s.schimbare);
  const B = await import('../src/scene/busola.js');
  const zb = await reanuntaBusola(B);
  proba(zb !== null && bunBusola(zb) && zb.dupaDispose.length === 0,
    zb === null ? 'busola nu s-a creat cu colțurile lui harta_v4' : `busola: primul anunț „${zb.primul}”; reanunta la 600 ms: ${descrie(zb.dupa)}; după dispose(): ${descrie(zb.dupaDispose)}`);
  const faraGolire = muta(textSursa('src/scene/busola.js'), ["      if (!viu) return;\n      anunt.textContent = '';\n      programeazaAnunt();", '      if (!viu) return;\n      programeazaAnunt();']);
  const cb = faraGolire === null ? null : await reanuntaBusola(await modulDin(faraGolire));
  proba(cb !== null && !bunBusola(cb), `control, busola cu reanunta fără golire (același text scris peste el): ${faraGolire === null ? NEAPLICATA : cb === null ? 'busola nu s-a creat' : `${descrie(cb.dupa)}, ${cb.dupa.filter((s) => s.schimbare).length} schimbări`} — pică`);
  globalThis.setTimeout = ST;
  globalThis.clearTimeout = CT;
  if (D0 === undefined) delete globalThis.document; else globalThis.document = D0;
}

console.warn = warn;
console.info = info;
console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
process.exitCode = picate ? 1 : 0;
