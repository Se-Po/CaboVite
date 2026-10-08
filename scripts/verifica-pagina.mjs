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
//   - mărimea canvasului (renderer.js): raportul de pixeli cel mult 2, plafonul de pixeli.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { WebGLRenderLists } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import * as L from '../src/scene/loaders.js';
import { creeazaCer } from '../src/scene/cer.js';
import { creeazaMare } from '../src/scene/mare.js';
import { creeazaLumini } from '../src/scene/lights.js';
import { paletaCurenta } from '../src/scene/palette.js';
import { redimensioneaza } from '../src/scene/renderer.js';
import { materialMareSatelit } from '../src/scene/satelit.js';

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

console.warn = warn;
console.info = info;
console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
process.exitCode = picate ? 1 : 0;
