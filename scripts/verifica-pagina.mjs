// Verifică, în Node, părți ale paginii pe care nu le acoperă celelalte probe — nici
// relieful (verifica-teren), nici sanctuarul și clădirile, nici împrejurimile, nici
// controalele.
//
//   npm run verifica-pagina
//
// Nu scrie nimic și nu cere rețea. Iese cu cod 1 dacă pică vreo probă. Fiecare probă de
// fond are un control negativ: aceeași măsurătoare pe o greșeală cunoscută trebuie să
// pice. Ce verifică azi:
//   - textura Satelit când transcodorul KTX2 nu răspunde (loaders.js): limita de timp,
//     abandonul, pagina ascunsă, verificarea dinaintea descărcării și API-ul lui
//     KTX2Loader pe care se sprijină;
//   - foaia de stil (main.css): fără `:has()`, `dvh` numai cu rezervă, iar selecția
//     oprită numai pe hartă și pe butoanele ei;
//   - ordinea de desenare (cer.js, mare.js): cerul ultimul, marea după teren, cu
//     `Less` strict pe mare, prin sortarea lui three însuși;
//   - mărimea canvasului (renderer.js): raportul de pixeli cel mult 2, plafonul de pixeli;
//   - cascada încărcării (loaders.js): stratul NDVI al fiecărei hărți se cere odată cu
//     sidecarul ei, nu după el; căile de eșec ale reliefului și ale stratului, neschimbate;
//   - garda pornirii (loaders.js, scena.js): un corp blocat abandonează pornirea după 20 s
//     fără niciun octet nicăieri; unul lent care curge și o cerere la coadă nu; opționalele
//     tac la abandon; pagina ascunsă și firul ocupat nu se numără; aceleași date ca fără ea;
//   - Satelit devreme (satelit.js, loaders.js, scena.js): prima treaptă cerută înaintea
//     construcției, fără petic, și urcată pe placă abia după primul cadru; peticul primul în a
//     doua treaptă, necerut fără compresie (`cuCompresie` față de alegerea transcodorului);
//     nimic cu preferința Relief; abandonul la dispose(); butonul arătat de la creare, ocupat,
//     iar un clic în timpul descărcării rămâne pe Relief, fără a doua treaptă;
//   - foaia de stil, și animațiile: numai transform/opacity, oprite sub reduced-motion;
//   - compilarea înaintea primului cadru (scena.js): `compileAsync` după ultimul `scena.add`
//     și înaintea buclei, pe sursă; timpii, în pagină (CLAUDE.md).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
  const CSS = readFileSync('src/styles/main.css', 'utf8');
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
  const c = verifica(CSS.replace('#versiune ~ * {', ':root:has(#versiune) {').replace('calc(var(--vizibil) ', 'calc(100dvh ') + '\nbody { user-select: none; }\n');
  proba(c.has === 1 && c.dvh.length === 1 && c.straine.includes('body'),
    `control, foaia cu \`:root:has(#versiune)\`, un \`100dvh\` și \`body { user-select: none }\`: ${c.has} / ${c.dvh.length} / ${c.straine.join(', ')} — pică`);

  // Animațiile — roțile mesajului de încărcare și ale butonului Satelit: numai `transform` și
  // `opacity` în @keyframes, iar fiecare regulă animată are sub reduced-motion `animation:
  // none`. Mesajul de încărcare pleacă odată cu `data-scena` și fără JavaScript.
  const animatii = (css) => {
    const fara = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const bloc = /\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/.source;
    const cadre = [...fara.matchAll(new RegExp(`@keyframes\\s+[\\w-]+\\s*${bloc}`, 'g'))].map((m) => m[1]);
    const proprietati = cadre.flatMap((c) => [...c.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]));
    const straine = [...new Set(proprietati.filter((p) => p !== 'transform' && p !== 'opacity'))];
    const reguli = [...fara.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), bloc: m[2] }));
    const animate = reguli.filter((r) => /(^|[;\s])animation\s*:(?!\s*none)/.test(r.bloc)).map((r) => r.sel);
    const oprite = new Set([...fara.matchAll(new RegExp(`@media\\s*\\(prefers-reduced-motion:\\s*reduce\\)\\s*${bloc}`, 'g'))]
      .flatMap((m) => [...m[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((x) => /animation\s*:\s*none/.test(x[2])).map((x) => x[1].trim())));
    const neoprite = animate.filter((s) => !oprite.has(s));
    const ascuns = /body\[data-scena\]\s+#incarcare\s*\{\s*display:\s*none;?\s*\}/.test(fara)
      && /@media\s*\(scripting:\s*none\)\s*\{\s*#incarcare\s*\{\s*display:\s*none;?\s*\}\s*\}/.test(fara);
    return { cadre: cadre.length, straine, animate: animate.length, neoprite, ascuns };
  };
  const a = animatii(CSS);
  proba(a.cadre > 0 && a.straine.length === 0 && a.animate > 0 && a.neoprite.length === 0 && a.ascuns,
    `animațiile: ${a.cadre} @keyframes, proprietăți în afara lui transform/opacity: ${a.straine.join(', ') || 'niciuna'}; ${a.animate} reguli animate, fără \`animation: none\` sub reduced-motion: ${a.neoprite.join(', ') || 'niciuna'}; mesajul de încărcare ascuns la data-scena și fără JavaScript: ${a.ascuns ? 'da' : 'NU'}`);
  const ca = animatii(CSS.replace(/@media \(prefers-reduced-motion: reduce\) \{\n  #incarcare::before \{ animation: none; \}\n\}/, '')
    + '\n@keyframes pulsa { to { left: 2px; } }\n.pulsa { animation: pulsa 1s infinite; }\n');
  proba(ca.straine.includes('left') && ca.neoprite.includes('#incarcare::before') && ca.neoprite.includes('.pulsa'),
    `control, fără oprirea roții mesajului și cu o animație pe \`left\`: ${ca.straine.join(', ')} / ${ca.neoprite.join(', ')} — pică`);
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
  const INDEX = readFileSync('index.html');
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
    const INDEX = readFileSync('index.html');
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
      const SRC = readFileSync('src/scene/scena.js', 'utf8');
      const s = verificaScena(SRC);
      proba(s.apeluri === 5 && s.faraGarda.length === 0 && s.goale.length === 0,
        `scena.js: ${s.apeluri} încărcători ai pornirii, ${s.faraGarda.length} fără gardă${s.faraGarda.length ? ` (${s.faraGarda.join(', ')})` : ''}, ${s.goale.length} așteptări fără verificare`);
      const c = verificaScena(SRC.replace('await asteapta(sanctuarGata)', 'await sanctuarGata').replace('incarcaCladiri(undefined, { garda })', 'incarcaCladiri()'));
      proba(c.faraGarda.length === 1 && c.goale.length === 1, `control, sanctuarul așteptat fără verificare și clădirile fără gardă: ${c.faraGarda.length} / ${c.goale.length} — pică`);
    }

    globalThis.fetch = F0;
    globalThis.setTimeout = ST;
    globalThis.clearTimeout = CT;
  }
}

// ------------------------------------------------------------ Satelit devreme

// Prima treaptă Satelit — baza și împrejurimile — pleacă înaintea construcției plaselor, nu
// după ea, și fără peticul de 6,33 MB; peticul vine primul în a doua treaptă, înaintea texturii
// fine a lui harta_v9, iar pe un GPU fără niciun format comprimat nu se mai cere deloc. Pe codul
// paginii — `descarcaSatelit` și `creeazaSatelit` —, cu un DOM, un renderer și un `fetch`
// falși, cu fișierele adevărate din public/data și cu transcodarea lui KTX2Loader înlocuită.
// Construcția cere WebGL: ordinea din scena.js se păzește pe sursă, iar timpii, în pagină
// (CLAUDE.md). Controalele rulează satelit.js și scena.js de la REPER_VECHI, din git.
console.log('\nSatelit devreme: prima treaptă înaintea construcției, peticul în a doua');
{
  // 0.1.5.02: ultimul commit cu Satelit cerut după construcție și cu peticul în prima treaptă.
  const REPER_VECHI = '30a22c9';
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, rmSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const S = await import('../src/scene/satelit.js');
  const BF = KTX2Loader.BasisFormat, EF = KTX2Loader.EngineFormat;

  /** Un modul de la REPER_VECHI, cu importurile relative și `three` duse la fișierele de azi. */
  const deLaReper = async (cale) => {
    let src;
    try { src = execFileSync('git', ['show', `${REPER_VECHI}:${cale}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
    src = src.replaceAll("from 'three'", `from '${import.meta.resolve('three')}'`)
      .replace(/from '\.\/([^']+)'/g, (_, f) => `from '${new URL(`../src/scene/${f}`, import.meta.url).href}'`);
    const f = join(tmpdir(), `cabo-reper-${process.pid}-${cale.replace(/\W/g, '_')}.mjs`);
    writeFileSync(f, src);
    try { return await import(pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
  };
  const V = await deLaReper('src/scene/satelit.js');

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
  const antete = readdirSync('public/data').filter((n) => n.endsWith('.ktx2')).map((n) => {
    const b = readFileSync(`public/data/${n}`), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const dfd = dv.getUint32(48, true), model = dv.getUint8(dfd + 12), mostre = (dv.getUint16(dfd + 10, true) - 24) / 16, canal = dv.getUint8(dfd + 31) & 15;
    return { n, w: dv.getUint32(20, true), h: dv.getUint32(24, true), basis: model === 166 ? BF.UASTC : BF.ETC1S, alfa: model === 166 ? canal === 3 || canal === 4 : mostre > 1, octeti: b.byteLength };
  });
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
    proba(n === 0 && configuratii.length === 96 && antete.length >= 7,
      `cuCompresie față de getTranscoderFormat: ${n} nepotriviri pe ${configuratii.length} configurații × ${antete.length} texturi`);
    const naiv = nepotriviri((c) => CHEI.some((k) => c[k]));
    proba(naiv > 0, `control, „oricare format” (și PVRTC, care cere laturi putere a lui 2): ${naiv} nepotriviri — pică`);
  } else proba(false, 'getTranscoderFormat din KTX2Loader.BasisWorker');

  // (b) Pornirea, pe codul paginii. Un jurnal comun: cererile, mărcile scenariului, texturile
  //     transcodate și cele urcate pe placă, în ordine.
  const OCTETI = new Map(antete.map((f) => [f.n.replace('.ktx2', ''), f.octeti]));
  const DUPA_MARIME = new Map(antete.map((f) => [f.octeti, f.n.replace('.ktx2', '')]));
  let jurnal = [], retinute = () => false, lipsa = () => false;
  // `abortLent`: o cerere reținută nu ascultă de oprire până nu e eliberată — o rețea care
  // oprește încet cererile.
  let abortLent = false;
  // Cererile reținute nu răspund decât oprite — sau la `raspundeRetinutelor()`, care le dă
  // fișierul, ca unei legături lente care ajunge totuși.
  let amanate = [];
  const raspundeRetinutelor = () => { const a = amanate; amanate = []; for (const f of a) f(); };
  const marca = (m) => jurnal.push({ marca: m });
  const F0 = globalThis.fetch;
  const fetchFals = (url, opt = {}) => new Promise((res, rej) => {
    jurnal.push({ url, semnal: opt.signal ?? null });
    const oprita = () => rej(new DOMException('cerere oprită', 'AbortError'));
    if (opt.signal?.aborted) return oprita();
    opt.signal?.addEventListener('abort', () => { if (!abortLent || !retinute(url)) oprita(); }, { once: true });
    const raspunde = () => (opt.signal?.aborted ? oprita()
      : res(existsSync('public' + url) ? new Response(readFileSync('public' + url), { status: 200 }) : new Response('', { status: 404 })));
    if (retinute(url)) { amanate.push(raspunde); return; }
    if (lipsa(url)) return res(new Response('', { status: 404 }));
    raspunde();
  });
  // Transcodarea: textura iese în formatul pe care l-ar alege transcodorul pentru placa asta.
  const numeTextura = new WeakMap();
  const P = KTX2Loader.prototype, init0 = P.init, parse0 = P.parse, dispose0 = P.dispose;
  let dispuse = 0;
  // Încărcătoarele pornite (`init`) și încă neeliberate: three avertizează când sunt două.
  const vii = new Set();
  let maxVii = 0;
  P.init = function () {
    if (!this.transcoderPending) { marca('transcodor'); this.transcoderPending = Promise.resolve(); vii.add(this); maxVii = Math.max(maxVii, vii.size); }
    return this.transcoderPending;
  };
  P.parse = function (buf, onLoad) {
    const dv = new DataView(buf), w = dv.getUint32(20, true), h = dv.getUint32(24, true), nume = DUPA_MARIME.get(buf.byteLength) ?? '?';
    jurnal.push({ parse: nume });
    this.init().then(() => {
      Object.assign(cfg, this.workerConfig);
      const format = alege ? alege(BF.UASTC, w, h, false).engineFormat : EF.RGBA_BPTC_Format;
      const t = new THREE.CompressedTexture([{ data: new Uint8Array(0), width: w, height: h }, { data: new Uint8Array(0), width: w >> 1, height: h >> 1 }], w, h, format);
      numeTextura.set(t, nume);
      jurnal.push({ transcodata: nume });
      onLoad(t);
    });
  };
  P.dispose = function () { dispuse++; vii.delete(this); return dispose0.call(this); };
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
  const deschide = ({ M, compresie = true, devreme = true, cuPrimulCadru = true, r = renderer(compresie) }) => {
    const teren = plasa(), petic = plasa(), mare = plasa();
    const soare = new THREE.DirectionalLight();
    soare.position.set(300, 120, -400);
    marca('date');   // toate datele pornirii au sosit
    const h = devreme && M.descarcaSatelit ? M.descarcaSatelit({ renderer: r, numeBaza: 'harta_v4', imprejurimi: NUME_IMP, fortatRelief: false }) : null;
    marca('constructie');
    let laCadru = null;
    const gazda = element();
    const primulCadru = cuPrimulCadru ? new Promise((res) => { laCadru = res; }) : undefined;
    const sat = M.creeazaSatelit({
      renderer: r, scena: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), teren, petic, mare, drapaj: [], soare,
      cer: null, umbre: null, centru, numeBaza: 'harta_v4', numePetic: 'harta_v5', gazda, cereRandare: () => {},
      laSursa: () => {}, fortatRelief: false, imprejurimi: NUME_IMP.map((nume) => ({ nume, obiect: plasa().obiect })),
      descarcare: h, primulCadru,
    });
    return { sat, teren, petic, h, gazda, laCadru: () => laCadru?.() };
  };
  /** Pornirea întreagă: construcția, primul cadru, Satelit, a doua treaptă. */
  const porneste = async (o) => {
    jurnal = []; avert = []; dispuse = 0;
    const d = deschide(o);
    const g = urmareste(d.sat.gata);
    let laSatelit = null;
    d.sat.gata.then(() => { marca('satelit'); laSatelit = { petic: numeTextura.get(d.petic.obiect.material.map), teren: numeTextura.get(d.teren.obiect.material.map) }; });
    await curge(() => g.gata || jurnal.filter((e) => e.transcodata).length >= 1 + NUME_IMP.length, 200_000);
    await curge(() => g.gata, 2000);
    const inainteDeCadru = { gata: g.gata, urcate: jurnal.filter((e) => e.urcata).length, material: d.teren.obiect.material.isMeshBasicMaterial && !d.teren.obiect.material.map };
    marca('primul-cadru');
    d.laCadru();
    await curge(() => g.gata, 200_000);
    const t2 = urmareste(d.sat.treaptaDoua ?? Promise.resolve());
    await curge(() => t2.gata, 200_000);
    const rez = { g, inainteDeCadru, laSatelit, final: { petic: numeTextura.get(d.petic.obiect.material.map), teren: numeTextura.get(d.teren.obiect.material.map) }, jurnal, avert: [...avert], d };
    d.sat.dispose();
    await curge(() => false, 200);
    rez.dispuse = dispuse;
    return rez;
  };
  const loc = (j, f) => j.findIndex(f);
  const cerereLa = (j, re) => loc(j, (e) => e.url && re.test(e.url));
  const marcaLa = (j, m) => loc(j, (e) => e.marca === m);
  const T1 = ['harta_v4-orto_v1', ...NUME_IMP.map((n) => `${n}-orto_v1${n === 'harta_v9' ? '-mic' : ''}`)];
  const descrie = (r) => {
    const j = r.jurnal, c = marcaLa(j, 'constructie'), s = marcaLa(j, 'satelit');
    const t1 = T1.filter((n) => { const i = cerereLa(j, new RegExp(`/${n}\\.ktx2$`)); return i >= 0 && i < c; }).length;
    const transcodate = j.slice(0, s < 0 ? j.length : s).filter((e) => e.transcodata).map((e) => e.transcodata);
    const octeti = transcodate.reduce((a, n) => a + (OCTETI.get(n) ?? 0), 0);
    const ultimaT1 = Math.max(...T1.map((n) => loc(j, (e) => e.transcodata === n)));
    return {
      t1, octeti, transcodate,
      peticInainte: cerereLa(j, /harta_v5-orto_v1/) >= 0 && cerereLa(j, /harta_v5-orto_v1/) < c,
      peticDupaT1: cerereLa(j, /harta_v5-orto_v1/) > ultimaT1,
      peticCereri: j.filter((e) => e.url?.includes('harta_v5-orto_v1')).length,
      peticInaintedeV9: cerereLa(j, /harta_v5-orto_v1\.ktx2$/) >= 0 && cerereLa(j, /harta_v5-orto_v1\.ktx2$/) < cerereLa(j, /harta_v9-orto_v1\.ktx2$/),
      v9: cerereLa(j, /harta_v9-orto_v1\.ktx2$/) >= 0,
    };
  };
  const MB = (n) => (n / 2 ** 20).toFixed(2);   // MB = 2^20 octeți, ca în CLAUDE.md

  {
    const r = await porneste({ M: S });
    const x = descrie(r);
    proba(r.g.v === true && x.t1 === T1.length && !x.peticInainte,
      `cererile primei trepte, înaintea construcției: ${x.t1} din ${T1.length} .ktx2, peticul ${x.peticInainte ? 'ȘI EL' : 'nu'}; Satelit ${r.g.v ? 'pornit' : 'NEPORNIT'}`);
    proba(!r.inainteDeCadru.gata && r.inainteDeCadru.urcate === 0 && r.inainteDeCadru.material,
      `înaintea primului cadru, cu texturile sosite: Satelit ${r.inainteDeCadru.gata ? 'APLICAT' : 'neaplicat'}, ${r.inainteDeCadru.urcate} texturi urcate pe placă`);
    proba(x.octeti === T1.reduce((a, n) => a + OCTETI.get(n), 0) && !x.transcodate.includes('harta_v5-orto_v1'),
      `transcodate până la Satelit: ${x.transcodate.length} texturi, ${MB(x.octeti)} MB (${x.transcodate.includes('harta_v5-orto_v1') ? 'cu' : 'fără'} petic)`);
    proba(r.laSatelit?.petic === 'harta_v4-orto_v1' && r.laSatelit?.teren === 'harta_v4-orto_v1',
      `la aplicarea Satelit, plasa peticului pe textura ${r.laSatelit?.petic}, baza pe ${r.laSatelit?.teren}`);
    proba(x.peticDupaT1 && x.peticInaintedeV9 && r.final.petic === 'harta_v5-orto_v1' && r.final.teren === 'harta_v4-orto_v1',
      `a doua treaptă: peticul cerut ${x.peticDupaT1 ? 'după prima treaptă' : 'ÎN prima treaptă'}, ${x.peticInaintedeV9 ? 'înaintea' : 'DUPĂ'} lui harta_v9; la capăt peticul pe ${r.final.petic}, baza pe ${r.final.teren}`);
    proba(r.avert.length === 0 && r.dispuse === 1, `avertismente ${r.avert.length}${r.avert[0] ? ` („${r.avert[0]}”)` : ''}, încărcătorul eliberat de ${r.dispuse} ori`);

    // Controale: Satelit fără prima treaptă pornită devreme — calea de la primul clic, cu
    // timpii de dinainte —, fără `primulCadru`, și satelit.js de la REPER_VECHI.
    const c1 = descrie(await porneste({ M: S, devreme: false }));
    proba(c1.t1 === 0, `control, cererile pornite din creeazaSatelit, ca înainte: ${c1.t1} din ${T1.length} înaintea construcției — pică`);
    const c2 = await porneste({ M: S, cuPrimulCadru: false });
    proba(c2.inainteDeCadru.urcate > 0, `control, fără așteptarea primului cadru: ${c2.inainteDeCadru.urcate} texturi urcate înaintea lui — pică`);
    if (V) {
      const rv = await porneste({ M: V });
      const xv = descrie(rv);
      proba(xv.t1 === 0 && xv.transcodate.includes('harta_v5-orto_v1') && !xv.peticDupaT1,
        `control, satelit.js de la ${REPER_VECHI}: ${xv.t1} cereri înaintea construcției, ${xv.transcodate.length} texturi și ${MB(xv.octeti)} MB până la Satelit, peticul în prima treaptă — pică`);
      const rvf = descrie(await porneste({ M: V, compresie: false }));
      proba(rvf.peticCereri > 0, `control, satelit.js de la ${REPER_VECHI}, fără compresie: peticul cerut de ${rvf.peticCereri} ori — pică`);
    } else proba(false, `satelit.js de la ${REPER_VECHI} nu s-a putut citi din git`);
  }

  // (c) Fără niciun format comprimat, peticul nu se cere: plasa lui rămâne pe textura bazei.
  {
    const r = await porneste({ M: S, compresie: false });
    const x = descrie(r);
    proba(r.g.v === true && x.peticCereri === 0 && r.final.petic === 'harta_v4-orto_v1' && !x.v9,
      `fără compresie: Satelit ${r.g.v ? 'pornit' : 'NEPORNIT'}, peticul cerut de ${x.peticCereri} ori, plasa lui pe ${r.final.petic}, harta_v9 întreagă ${x.v9 ? 'CERUTĂ' : 'necerută'}`);
  }

  // (d) Preferința Relief și `?previzualizare`: nimic nu pleacă devreme, iar Satelit cere numai
  //     sidecarul bazei până la primul clic. Control: preferința Satelit.
  {
    jurnal = [];
    preferinta = 'relief';
    const hr = S.descarcaSatelit({ renderer: renderer(true), numeBaza: 'harta_v4', imprejurimi: NUME_IMP });
    preferinta = null;
    const hp = S.descarcaSatelit({ renderer: renderer(true), numeBaza: 'harta_v4', imprejurimi: NUME_IMP, fortatRelief: true });
    proba(hr === null && hp === null && jurnal.length === 0, `preferința Relief și ?previzualizare: ${jurnal.length} cereri devreme`);
    preferinta = 'relief';
    jurnal = []; avert = [];
    const d = deschide({ M: S });
    await curge(() => false, 3000);
    d.laCadru();
    await curge(() => false, 3000);
    const cereri = jurnal.filter((e) => e.url).map((e) => e.url.replace('/data/', ''));
    proba(cereri.length === 1 && cereri[0] === 'harta_v4-orto_v1.json', `preferința Relief, până la primul clic: ${cereri.join(', ') || 'nicio cerere'}`);
    d.sat.dispose();
    preferinta = 'satelit';
    jurnal = [];
    const hs = S.descarcaSatelit({ renderer: renderer(true), numeBaza: 'harta_v4', imprejurimi: NUME_IMP });
    proba(hs && jurnal.filter((e) => e.url).length === 2 * T1.length, `control, preferința Satelit: ${jurnal.filter((e) => e.url).length} cereri devreme`);
    hs?.abandoneaza();
    preferinta = null;
    await curge(() => false, 200);
  }

  // (e) Transcodorul pleacă odată cu texturile, nu după prima sosită și verificată: cu fișierele
  //     .ktx2 reținute, se cere oricum. Control: satelit.js de la REPER_VECHI, unde îl cerea
  //     prima textură verificată.
  for (const [M, eticheta] of [[S, 'azi'], [V, REPER_VECHI]]) {
    if (!M) continue;
    jurnal = [];
    retinute = (u) => u.endsWith('.ktx2');
    const d = deschide({ M });
    await curge(() => false, 2000);
    const cerut = marcaLa(jurnal, 'transcodor') >= 0;
    if (M === S) proba(cerut, `cu fișierele .ktx2 încă în drum, transcodorul ${cerut ? 'cerut' : 'NECERUT'}`);
    else proba(!cerut, `control, satelit.js de la ${eticheta}: transcodorul ${cerut ? 'cerut' : 'necerut'} până la prima textură — pică`);
    d.sat.dispose();
    retinute = () => false;
    await curge(() => false, 200);
  }

  // (f) Abandonul: `dispose()` oprește și cererile pornite devreme, încă nepreluate sau în zbor,
  //     fără avertismente, iar încărcătorul se eliberează o singură dată. Control: fără dispose(),
  //     cererile reținute rămân deschise.
  for (const elibereaza of [true, false]) {
    jurnal = []; avert = []; dispuse = 0;
    retinute = (u) => u.endsWith('.ktx2');
    const d = deschide({ M: S });
    await curge(() => false, 2000);
    if (elibereaza) d.sat.dispose();
    await curge(() => false, 2000);
    const ktx = jurnal.filter((e) => e.url?.endsWith('.ktx2'));
    const oprite = ktx.filter((e) => e.semnal?.aborted).length;
    if (elibereaza) proba(ktx.length === T1.length && oprite === ktx.length && avert.length === 0 && dispuse === 1,
      `dispose() cu fișierele primei trepte în zbor: ${oprite} din ${ktx.length} cereri oprite, avertismente ${avert.length}, încărcătorul eliberat de ${dispuse} ori`);
    else proba(oprite === 0, `control, fără dispose(): ${oprite} din ${ktx.length} cereri oprite`);
    if (!elibereaza) d.sat.dispose();
    retinute = () => false;
    await curge(() => false, 200);
  }

  // (g) scena.js cere prima treaptă după TOATE datele pornirii și înaintea plaselor, îi dă
  //     mânerul lui creeazaSatelit și rezolvă `primulCadru` în buclă. Control: scena.js de la
  //     REPER_VECHI.
  {
    const ordine = (src) => {
      const i = (s) => src.indexOf(s);
      const toate = i('await asteapta(Promise.all([sanctuarGata, cladiriGata, imprejurimiGata]))');
      const dSat = i('descarcaSatelit({'), teren = i('creeazaTeren(relief'), relief = i('await asteapta(reliefGata)');
      return { ok: relief > 0 && toate > relief && dSat > toate && teren > dSat && i('descarcare: descarcareSatelit') > teren && /laPrimulCadru\(\)/.test(src), relief, toate, dSat, teren };
    };
    const o = ordine(readFileSync('src/scene/scena.js', 'utf8'));
    proba(o.ok, `scena.js: relieful (${o.relief}) → toate datele (${o.toate}) → descarcaSatelit (${o.dSat}) → creeazaTeren (${o.teren}), mânerul trecut lui creeazaSatelit, primulCadru rezolvat în buclă`);
    let vechi = null;
    try { vechi = execFileSync('git', ['show', `${REPER_VECHI}:src/scene/scena.js`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* fără git */ }
    proba(vechi !== null && !ordine(vechi).ok, `control, scena.js de la ${REPER_VECHI}: ${vechi === null ? 'NECITIT' : `descarcaSatelit la ${ordine(vechi).dSat}`} — pică`);
  }

  // (h) Butonul, de la creare: cât se descarcă prima treaptă se vede, apăsat — starea spre care
  //     merge — și ocupat, cu anunțul încărcării. Un clic în timpul ăsta înseamnă „rămân pe
  //     Relief”: preferința 'relief', cererile primei trepte oprite, nimic transcodat după el,
  //     Satelit neaplicat, a doua treaptă neplecată; un clic următor cere prima treaptă din nou
  //     și aplică Satelit. Control: satelit.js de la REPER_VECHI, cu butonul ascuns până la
  //     aplicare, iar apăsat totuși, ca un buton arătat devreme fără restul reparației.
  const butonul = (d) => { const rad = d.gazda.copii[0]; return { rad, b: rad?.copii[0], anunt: rad?.copii[1] }; };
  const clic = (b) => { for (const f of b.asc.click ?? []) f(); };
  const ANUNT = 'Se încarcă fotografia aeriană…';
  for (const [M, eticheta] of [[S, 'azi'], [V, REPER_VECHI]]) {
    if (!M) continue;
    jurnal = []; avert = []; dispuse = 0; preferinta = null;
    retinute = (u) => u.endsWith('.ktx2');
    const d = deschide({ M });
    const { rad, b, anunt } = butonul(d);
    const laCreare = { vizibil: !rad.hidden && !b.hidden, busy: b.atribute['aria-busy'], pressed: b.atribute['aria-pressed'], anunt: anunt.textContent };
    const g = urmareste(d.sat.gata);
    await curge(() => false, 2000);
    clic(b);
    const laClic = jurnal.length;
    const dupaClic = { preferinta, pressed: b.atribute['aria-pressed'], busy: b.atribute['aria-busy'] ?? null };
    const ktx = jurnal.filter((e) => e.url?.endsWith('.ktx2'));
    const oprite = ktx.filter((e) => e.semnal?.aborted).length;
    retinute = () => false;
    raspundeRetinutelor();
    d.laCadru();
    await curge(() => g.gata, 200_000);
    await curge(() => false, 2000);
    const dupa = jurnal.slice(laClic);
    const transcodate = dupa.filter((e) => e.transcodata).length, cereri = dupa.filter((e) => e.url).length;
    if (M === S) {
      proba(laCreare.vizibil && laCreare.busy === 'true' && laCreare.pressed === 'true' && laCreare.anunt === ANUNT,
        `butonul Satelit la creare: ${laCreare.vizibil ? 'vizibil' : 'ASCUNS'}, aria-busy ${laCreare.busy}, aria-pressed ${laCreare.pressed}, anunțul „${laCreare.anunt}”`);
      proba(dupaClic.preferinta === 'relief' && dupaClic.pressed === 'false' && dupaClic.busy === null && ktx.length === T1.length && oprite === ktx.length,
        `clic în timpul descărcării: preferința ${dupaClic.preferinta}, aria-pressed ${dupaClic.pressed}, aria-busy ${dupaClic.busy}, ${oprite} din ${ktx.length} cereri .ktx2 oprite`);
      proba(g.v === false && !d.sat.activ && transcodate === 0 && cereri === 0 && d.sat.treaptaDoua === null && avert.length === 0 && dispuse === 1,
        `după clic: Satelit ${d.sat.activ ? 'APLICAT' : 'neaplicat'}, ${transcodate} texturi transcodate și ${cereri} cereri noi, a doua treaptă ${d.sat.treaptaDoua ? 'PORNITĂ' : 'nepornită'}, avertismente ${avert.length}, încărcătorul eliberat de ${dispuse} ori`);
      const inainte = jurnal.length;
      clic(b);
      await curge(() => d.sat.activ, 200_000);
      const t2 = urmareste(d.sat.treaptaDoua ?? Promise.resolve());
      await curge(() => t2.gata, 200_000);
      const din = jurnal.slice(inainte), t1din = T1.filter((n) => din.some((e) => e.url === `/data/${n}.ktx2`)).length;
      const petic = din.some((e) => e.url === '/data/harta_v5-orto_v1.ktx2');
      proba(d.sat.activ && preferinta === 'satelit' && b.atribute['aria-pressed'] === 'true' && !b.atribute['aria-busy'] && t1din === T1.length && petic && avert.length === 0,
        `al doilea clic: Satelit ${d.sat.activ ? 'aplicat' : 'NEAPLICAT'}, ${t1din} din ${T1.length} texturi ale primei trepte cerute din nou, apoi peticul ${petic ? 'cerut' : 'NECERUT'}; avertismente ${avert.length}`);
    } else {
      proba(!laCreare.vizibil, `control, satelit.js de la ${eticheta}: butonul la creare ${laCreare.vizibil ? 'vizibil' : 'ascuns'} — pică`);
      proba(d.sat.activ && preferinta === 'satelit',
        `control, satelit.js de la ${eticheta}, butonul apăsat totuși în timpul descărcării: Satelit ${d.sat.activ ? 'aplicat' : 'neaplicat'}, preferința ${preferinta} — pică`);
    }
    d.sat.dispose();
    preferinta = null;
    await curge(() => false, 200);
  }

  // (i) Renunțarea târzie: texturile primei trepte au trecut de ultima așteptare (compilarea
  //     ținută). Prima treaptă se termină, dar Satelit nu se aplică și a doua nu pleacă; un clic
  //     următor aplică pe loc și o pornește, iar fără el `dispose()` eliberează încărcătorul
  //     păstrat. Un dublu-clic CU compilarea încă în curs — renunțarea, apoi clicul — aplică la
  //     capătul ei, tot cu a doua treaptă (recenzia: Satelit aplicat, dar peticul pe textura
  //     bazei și harta_v9 pe cea mică, toată sesiunea). Control: satelit.js de la REPER_VECHI
  //     aplică și pornește a doua treaptă.
  for (const [M, eticheta, aplicaApoi] of [[S, 'azi', false], [S, 'azi', true], [S, 'azi', 'dublu'], [V, REPER_VECHI, false]]) {
    if (!M) continue;
    jurnal = []; avert = []; dispuse = 0; preferinta = null;
    let gataCompilarea = null;
    const r = { ...renderer(true), compileAsync: () => new Promise((res) => { gataCompilarea = res; }) };
    const d = deschide({ M, r });
    const { b } = butonul(d);
    const g = urmareste(d.sat.gata);
    d.laCadru();
    await curge(() => gataCompilarea !== null, 200_000);
    clic(b);
    if (aplicaApoi === 'dublu') {
      clic(b);
      gataCompilarea();
      await curge(() => d.sat.activ, 200_000);
      const t2 = urmareste(d.sat.treaptaDoua ?? Promise.resolve());
      await curge(() => t2.gata, 200_000);
      const petic = numeTextura.get(d.petic.obiect.material.map);
      const v9 = jurnal.some((e) => e.url === '/data/harta_v9-orto_v1.ktx2');
      proba(d.sat.activ && preferinta === 'satelit' && d.sat.treaptaDoua !== null && petic === 'harta_v5-orto_v1' && v9 && avert.length === 0,
        `dublu-clic cu compilarea în curs: Satelit ${d.sat.activ ? 'aplicat' : 'NEAPLICAT'}, a doua treaptă ${d.sat.treaptaDoua ? 'pornită' : 'NEPORNITĂ'}, plasa peticului pe ${petic}, harta_v9 întreagă ${v9 ? 'cerută' : 'NECERUTĂ'}`);
      d.sat.dispose();
      await curge(() => false, 200);
      continue;
    }
    gataCompilarea();
    await curge(() => g.gata, 200_000);
    await curge(() => false, 2000);
    const fine = () => jurnal.filter((e) => e.url && /harta_v5-orto_v1|harta_v9-orto_v1\.(ktx2|json)$/.test(e.url)).length;
    const f0 = fine(), activ0 = d.sat.activ;
    if (M !== S) {
      proba(activ0 && f0 > 0, `control, satelit.js de la ${eticheta}, clic cu compilarea în curs: Satelit ${activ0 ? 'aplicat' : 'neaplicat'}, ${f0} cereri ale celei de-a doua trepte — pică`);
    } else if (!aplicaApoi) {
      d.sat.dispose();
      proba(g.v === false && !activ0 && preferinta === 'relief' && f0 === 0 && dispuse === 1 && avert.length === 0,
        `renunțare cu compilarea în curs: Satelit ${activ0 ? 'APLICAT' : 'neaplicat'}, ${f0} cereri ale celei de-a doua trepte; după dispose(), încărcătorul păstrat eliberat de ${dispuse} ori`);
    } else {
      clic(b);
      const peLoc = d.sat.activ;
      const t2 = urmareste(d.sat.treaptaDoua ?? Promise.resolve());
      await curge(() => t2.gata, 200_000);
      proba(!activ0 && f0 === 0 && peLoc && fine() > 0 && dispuse === 1 && avert.length === 0,
        `apoi clic pe Satelit: aplicat ${peLoc ? 'pe loc' : 'NU'}, a doua treaptă cu ${fine()} cereri, încărcătorul eliberat de ${dispuse} ori`);
    }
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (j) Eșecul pornirii automate (gardă, fără control: codul vechi nu arăta butonul deloc):
  //     baza lipsă (404) — butonul arătat devreme pleacă, cu anunțul eșecului.
  {
    jurnal = []; avert = []; preferinta = null;
    lipsa = (u) => u === '/data/harta_v4-orto_v1.ktx2';
    const d = deschide({ M: S });
    const { b, anunt } = butonul(d);
    const g = urmareste(d.sat.gata);
    d.laCadru();
    await curge(() => g.gata, 200_000);
    proba(g.v === false && b.hidden && !b.atribute['aria-busy'] && anunt.textContent === 'Fotografia aeriană nu s-a putut încărca.' && avert.some((a) => a.includes('harta_v4-orto_v1 lipsește')),
      `baza lipsă la pornire: butonul ${b.hidden ? 'scos' : 'RĂMAS'}, anunțul „${anunt.textContent}”, avertismente ${avert.length}`);
    lipsa = () => false;
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (k) Un deploy fără texturi: transcodorul (~0,6 MB) pleacă numai după sidecarul bazei, deci
  //     nu se mai descarcă degeaba. Control: cu texturile la locul lor, se cere.
  for (const faraTexturi of [true, false]) {
    jurnal = []; avert = []; preferinta = null;
    lipsa = faraTexturi ? (u) => /-orto_v1(-mic)?\.(json|ktx2)$/.test(u) : () => false;
    const d = deschide({ M: S });
    const g = urmareste(d.sat.gata);
    d.laCadru();
    await curge(() => g.gata, 200_000);
    const cerut = marcaLa(jurnal, 'transcodor') >= 0;
    if (faraTexturi) proba(g.v === false && !cerut, `fără nicio textură pe server: Satelit ${g.v ? 'PORNIT' : 'nepornit'}, transcodorul ${cerut ? 'CERUT' : 'necerut'}`);
    else proba(g.v === true && cerut, `control, cu texturile: transcodorul ${cerut ? 'cerut' : 'necerut'}`);
    lipsa = () => false;
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (l) Contextul WebGL pierdut chiar când sosește încărcătorul: `detectSupport` vede atunci
  //     toate extensiile lipsă. Satelit așteaptă refacerea contextului și reface configurația
  //     înaintea primei transcodări, deci texturile ies comprimate, iar peticul vine. Pe codul
  //     de dinainte (recenzia): RGBA, ~71 MB pe placă, fără petic, toată sesiunea.
  {
    jurnal = []; avert = []; preferinta = null;
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
    d.laCadru();
    await curge(() => g.gata, 200_000);
    const t2 = urmareste(d.sat.treaptaDoua ?? Promise.resolve());
    await curge(() => t2.gata, 200_000);
    const fmt = d.teren.obiect.material.map?.format;
    const petic = numeTextura.get(d.petic.obiect.material.map);
    proba(g.v === true && transcodateCatPierdut === 0 && fmt === THREE.RGBA_BPTC_Format && petic === 'harta_v5-orto_v1' && (asc.webglcontextrestored?.size ?? 0) === 0,
      `context pierdut la sosirea încărcătorului, refăcut apoi: ${transcodateCatPierdut} texturi transcodate cât era pierdut, baza ${fmt === THREE.RGBA_BPTC_Format ? 'BC7' : fmt === THREE.RGBAFormat ? 'RGBA NECOMPRIMAT' : fmt}, plasa peticului pe ${petic}, ascultători rămași ${asc.webglcontextrestored?.size ?? 0}`);
    d.sat.dispose();
    await curge(() => false, 200);
  }

  // (m) Renunțarea pe o rețea care oprește încet cererile: încercarea nouă o așteaptă pe cea
  //     oprită, deci încărcătoarele nu se suprapun — altfel three avertiza „Multiple active KTX2
  //     loaders” (văzut în pagină, cu .ktx2 întârziate). Un al patrulea clic, dat cât încercarea
  //     nouă încă așteaptă, o oprește și pe ea: nicio cerere a ei.
  for (const patruClicuri of [false, true]) {
    jurnal = []; avert = []; preferinta = 'relief'; vii.clear(); maxVii = 0;
    const d = deschide({ M: S });
    d.laCadru();
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
    preferinta = null;
    await curge(() => false, 200);
  }

  globalThis.fetch = F0;
  P.init = init0; P.parse = parse0; P.dispose = dispose0;
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

// ------------------------------------------------------------ compilarea înaintea primului cadru

// three compilează programele la prima randare și așteaptă acolo, sincron, legarea fiecăruia:
// la prima vizită primul cadru ținea firul ~0,37 s, din care ~0,30 s numai legarea. scena.js
// le compilează întâi cu `compileAsync`, după ce toate plasele sunt în scenă și înaintea
// buclei, fără altă așteptare între ele. Timpii cer WebGL: în pagină (CLAUDE.md). Aici se
// păzește ordinea, pe sursă. Controale: scena.js de la 30a22c9, fără compilare, și sursa de
// azi cu compilarea mutată după `setAnimationLoop`.
console.log('\nCompilarea înaintea primului cadru (scena.js)');
{
  const { execFileSync } = await import('node:child_process');
  const COMPILA = 'try { await renderer.compileAsync(scena, camera); } catch', BUCLA = 'renderer.setAnimationLoop(() =>';
  const ordine = (src) => {
    const c = src.indexOf(COMPILA), b = src.indexOf(BUCLA), add = src.lastIndexOf('scena.add(');
    const intre = c >= 0 && b > c ? src.slice(c + COMPILA.length, b).match(/\bawait\b/g)?.length ?? 0 : null;
    return { ok: c > 0 && add < c && b > c && intre === 0, c, b, add, intre };
  };
  const azi = readFileSync('src/scene/scena.js', 'utf8');
  const o = ordine(azi);
  proba(o.ok, `compileAsync (${o.c}) după ultimul scena.add (${o.add}) și înaintea buclei (${o.b}), cu ${o.intre} alte așteptări între ele`);
  let vechi = null;
  try { vechi = execFileSync('git', ['show', '30a22c9:src/scene/scena.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* fără git */ }
  proba(vechi !== null && !ordine(vechi).ok, `control, scena.js de la 30a22c9: ${vechi === null ? 'NECITIT' : `compileAsync la ${ordine(vechi).c}`} — pică`);
  const randul = (s, i) => [s.lastIndexOf('\n', i) + 1, s.indexOf('\n', i) + 1];
  const [a0, a1] = randul(azi, azi.indexOf(COMPILA));
  const fara = azi.slice(0, a0) + azi.slice(a1);
  const dupaBucla = randul(fara, fara.indexOf(BUCLA))[1];
  const mutat = fara.slice(0, dupaBucla) + azi.slice(a0, a1) + fara.slice(dupaBucla);
  const m = ordine(mutat);
  proba(mutat !== azi && !m.ok, `control, compilarea mutată după bucla (${m.c} față de ${m.b}) — pică`);
}

console.warn = warn;
console.info = info;
console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
process.exitCode = picate ? 1 : 0;
