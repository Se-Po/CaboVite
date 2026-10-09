// Verifică, în Node, mânuirea hărții: rotița, apucarea, pivotul și stările gesturilor,
// plus punctul pe care îl culege panoul „Coordonate” — același „ce e sub cursor” —,
// „Măsoară centrul”, tastatura și drona (tastatura.js, `comanda` din camera.js), anunțul busolei
// și Escape pe fișa sanctuarului și pe cutia „Coordonate” (eticheta.js, punct.js).
// Controalele pe codul de dinainte citesc modulele de la REPER_VECHI din git.
//
//   npm run verifica-controale
//
// Nu scrie nimic. Construiește alpha și împrejurimile cu CODUL PAGINII, ca
// verifica-imprejurimi, apoi camera și controalele din camera.js, și le dă
// evenimente ca ale browserului. Ecranul e 1600 × 900. Iese cu cod 1 dacă pică vreo
// probă. Fiecare probă de fond are un control negativ: aceeași măsurătoare pe o
// greșeală cunoscută trebuie să pice.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { incarcaCladiri, incarcaRelief, straturiNdvi } from '../src/scene/loaders.js';
import { creeazaTeren, mascaBazei } from '../src/scene/terrain.js';
import { creeazaSanctuar } from '../src/scene/sanctuar.js';
import { COTA_MARE } from '../src/scene/mare.js';
import { incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';
import { creeazaImprejurimi, incarcaImprejurimi } from '../src/scene/imprejurimi.js';
import { buclaNoduri, dreptunghiGrila } from '../src/scene/cusatura.js';
import { creeazaAlpha } from '../src/scene/alpha.js';
import { marsPeTeren, punctVazut, reliefRandat } from '../src/scene/raza.js';
import { FACTOR_TREAPTA, pasZoom, treapta } from '../src/scene/rotita.js';
import { ControaleHarta, creeazaCamera, descarcaInertia, LIBER_SOL, NEAR, PAS_MUTARE, STARE, urmaresteMarireaPaginii, VEDERE_START } from '../src/scene/camera.js';
import { creeazaZbor } from '../src/scene/zbor.js';
import * as PUNCT from '../src/scene/punct.js';
import { creeazaGeo } from '../src/scene/geo.js';
import { creeazaTastatura, DESCRIERE_TASTE } from '../src/scene/tastatura.js';
import * as BUSOLA from '../src/scene/busola.js';
import * as ETICHETA from '../src/scene/eticheta.js';

const { creeazaPunct } = PUNCT;
let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const LN = Math.log(FACTOR_TREAPTA);

// Controalele pe codul de dinainte: modulele de la REPER_VECHI, din git, sau mutații ale celor
// de azi. Textul se citește cu capetele de rând aduse la LF, deci proba nu depinde de
// core.autocrlf; o mutație care nu se mai aplică întoarce null, iar controlul ei pică
// („MUTAȚIA NU S-A APLICAT”). Fără git, controalele pe REPER_VECHI pică fiecare cu mesajul lui.
const REPER_VECHI = '6ad3a47';
const LF = (t) => t.replace(/\r\n/g, '\n');
const textSursa = (cale) => LF(readFileSync(cale, 'utf8'));
const textVechi = (cale) => {
  try {
    return LF(execFileSync('git', ['show', `${REPER_VECHI}:${cale}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }));
  } catch { return null; }
};
const NEAPLICATA = 'MUTAȚIA NU S-A APLICAT';
const muta = (text, ...perechi) => {
  if (text === null) return null;
  let s = text;
  for (const [din, inLoc] of perechi) {
    if (!s.includes(din)) return null;
    s = s.replace(din, () => inLoc);
  }
  return s;
};
/** Un modul din text, cu `three` și importurile relative duse la fișierele de azi din src/scene. */
let nrModul = 0;
const modulDin = async (src) => {
  if (src === null) return null;
  src = src.replace(/from '(three(?:\/[^']*)?)'/g, (_, s) => `from '${import.meta.resolve(s)}'`)
    .replace(/from '\.\/([^']+)'/g, (_, f) => `from '${new URL(`../src/scene/${f}`, import.meta.url).href}'`)
    .replace(/from '\.\.\/([^']+)'/g, (_, f) => `from '${new URL(`../src/${f}`, import.meta.url).href}'`);
  const f = join(tmpdir(), `cabo-controale-${process.pid}-${nrModul++}.mjs`);
  writeFileSync(f, src);
  try { return await import(pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
};

const INDEX = readFileSync('index.html');
globalThis.fetch = async (url) => {
  const f = 'public' + url;
  if (!existsSync(f)) return new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } });
  return new Response(readFileSync(f), { status: 200 });
};
const warn = console.warn;
console.warn = () => {};

// ------------------------------------------------------------ relieful paginii

await incarcaPaleta();
const paleta = paletaCurenta();
const incarcat = await incarcaRelief();
const relief = incarcat.baza, reliefPetic = incarcat;
const { pastreaza, subPetic, limitaDatelor } = mascaBazei(relief, reliefPetic);
const ndvi = straturiNdvi(relief, reliefPetic);
const teren = creeazaTeren(relief, { pastreaza, paleta, ndvi: ndvi.baza });
const petic = creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta, ndvi: ndvi.petic });
const margineAlpha = buclaNoduri(relief, { x: 0, z: 0 }, ndvi.baza, dreptunghiGrila(relief));
const imp = creeazaImprejurimi({ niveluri: await incarcaImprejurimi(), margineAlpha, paleta });
const inaltimeLa = (x, z) => (subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z));
// Farul și celelalte clădiri, ca în pagină: zoomul și apucarea le văd.
const bb = relief.meta.bbox_tm06;
const dateCladiri = await incarcaCladiri();
const cladiri = creeazaSanctuar({ date: dateCladiri, inaltimeLa, ancora: { x: (bb.xMin + bb.xMax) / 2, y: (bb.yMin + bb.yMax) / 2 }, eticheta: 'clădiri' });
console.warn = warn;
const alpha = creeazaAlpha(relief.meta);
const inaltimeRandata = reliefRandat({ alpha, inaltimeLa, imprejurimi: imp });
const TEREN = { inaltimeLa: inaltimeRandata, lim: imp.limite, alpha, loveste: (raza) => cladiri.loveste(raza) };

const W = 1600, H = 900, RECT = { left: 0, top: 0, width: W, height: H };
const raycaster = new THREE.Raycaster();
const razaLa = (camera, x, y) => {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(new THREE.Vector2((x / W) * 2 - 1, -((y / H) * 2 - 1)), camera);
  return raycaster.ray;
};
const proiect = (camera, p) => {
  camera.updateMatrixWorld();
  const v = p.clone().project(camera);
  return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
};
const subCursor = (camera, controale, x, y, teren = TEREN) => {
  const raza = razaLa(camera, x, y), r = camera.position.distanceTo(controale.target);
  const t = punctVazut(raza, teren, 3 * r);
  return raza.at(t ?? r, new THREE.Vector3());
};

// O cameră a paginii, la vederea de pornire, cu ceasul în mâna probei.
let ceas = 0;
performance.now = () => ceas;
const pagina = () => {
  const { camera, controale } = creeazaCamera(null);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  controale.seteazaTeren(TEREN);
  return { camera, controale };
};
const cadre = (controale, max = 400) => {
  let n = 0;
  for (; n < max; n++) { ceas += 1000 / 60; const m = controale.rotita.pas(); controale.update(); if (!m && !controale.rotita.activa) break; }
  return n;
};
const clic = (controale, x, y, deltaY = -100, deltaMode = 0) => controale.rotita.adauga({ clientX: x, clientY: y, deltaY, deltaMode }, RECT);

// ------------------------------------------------------------ 1. mersul pe rază

console.log('\nMersul pe rază, mutat din punct.js: identic cu bucla veche');
{
  // Bucla din punct.js de dinainte (v0.1.3), înghețată aici.
  const tmp = new THREE.Vector3();
  const vechi = (raza, h, lim, maxim) => {
    const inHarta = (p) => p.x >= lim.xMin && p.x <= lim.xMax && p.z >= lim.zMin && p.z <= lim.zMax;
    const subTeren = (t) => { raza.at(t, tmp); return inHarta(tmp) ? tmp.y - h(tmp.x, tmp.z) : null; };
    let tA = null, sA = null;
    for (let t = 0; t <= maxim; t += 8) {
      const d = subTeren(t);
      if (d === null) { tA = null; sA = null; continue; }
      if (sA !== null && sA > 0 && d <= 0) {
        let a = tA, b = t;
        for (let i = 0; i < 22; i++) { const m = (a + b) / 2; const dm = subTeren(m); if (dm === null || dm > 0) a = m; else b = m; }
        return (a + b) / 2;
      }
      tA = t; sA = d;
    }
    return null;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const lim = { xMin: alpha.xMin, xMax: alpha.xMax, zMin: alpha.zMin, zMax: alpha.zMax };
  let diferite = 0, lovite = 0;
  const raza = new THREE.Ray();
  for (let i = 0; i < 20000; i++) {
    raza.origin.set((rnd() - 0.5) * 3000, 150 + rnd() * 1500, (rnd() - 0.5) * 3500);
    raza.direction.set(rnd() - 0.5, -0.05 - rnd(), rnd() - 0.5).normalize();
    const a = marsPeTeren(raza, inaltimeLa, lim, 4000), b = vechi(raza, inaltimeLa, lim, 4000);
    if (!Object.is(a, b)) diferite++;
    if (a !== null) lovite++;
  }
  proba(diferite === 0 && lovite > 10000, `pe 20 000 de raze (${lovite} lovesc relieful), ${diferite} rezultate diferite`);
}

// ------------------------------------------------------------ 2. treptele

console.log('\nTreptele rotiței: un clic e o treaptă, în orice browser');
{
  // Evenimentul trece prin `_customWheelEvent` al controalelor paginii, ca în browser.
  const k = Object.create(ControaleHarta.prototype);
  k._controlActive = false;
  const roata = (o) => ({ clientX: 0, clientY: 0, ctrlKey: false, deltaMode: 0, ...o });
  const t = (o, ritm) => treapta(k._customWheelEvent(roata(o)), ritm)?.ln;
  const rel = (a) => Math.abs(a / LN);
  proba(t({ deltaY: 100 }) === LN && t({ deltaY: -120 }) === -LN, 'Chrome: 100 și 120 de pixeli, câte o treaptă');
  proba(t({ deltaY: 3, deltaMode: 1 }) === LN, 'Firefox: 3 linii, o treaptă');
  proba(t({ deltaY: 1, deltaMode: 2 }) === LN, 'o pagină, o treaptă');
  proba(t({ deltaY: 4.000244140625 }) === LN && t({ deltaY: -8.00048828125 }, { izolat: false, precedent: 4 }) === -LN, 'macOS (Safari, Chrome): 4,000244 px și multiplii lui, câte o treaptă');
  proba(t({ deltaY: 40 }, { dpr: 2.5, izolat: false, precedent: 40 }) === LN && t({ deltaY: 33.333 }, { dpr: 3, izolat: false, precedent: 33.333 }) === LN,
    'Chrome cu pagina mărită la 250% (40 px) și 300% (33 px), clicuri repetate: câte o treaptă');
  proba(t({ deltaY: 33.333 }, { dpr: 1, izolat: true }) === LN, 'Windows cu „1 linie pe clic” (33 px), un clic singur: o treaptă');
  let s = 0;
  for (let i = 0; i < 12; i++) s += t({ deltaY: 8.333 }, { izolat: i === 0, precedent: i ? 8.333 : null });
  proba(Math.abs(rel(s) - 1) < 0.01 && treapta({ deltaY: 8.333 }).imediat, `touchpad: 12 × 8,33 px fac ${rel(s).toFixed(4)} trepte, aplicate pe loc`);
  let rafala = 0;
  for (const [i, d] of [60, 75, 90].entries()) rafala += t({ deltaY: d }, { izolat: false, precedent: [55, 60, 75][i] });
  proba(Math.abs(rel(rafala) - 2.25) < 1e-9, `touchpad, o rafală de 60, 75, 90 px cu valori schimbătoare: ${rel(rafala).toFixed(2)} trepte, proporțional`);
  proba(Math.abs(t({ deltaY: -5, ctrlKey: true }) + 0.05) < 1e-15, 'ciupirea pe touchpad (rotiță cu Ctrl): −5 → ln −0,05, pe loc');
  // Control: același eveniment prin `_customWheelEvent` al lui OrbitControls (linii × 16,
  // ciupire × 10, fără `deltaMode`) dă alt rezultat.
  // În mijlocul unei rotiri repezi (nu izolat), unde contează felul evenimentului.
  const o = Object.create(OrbitControls.prototype);
  o._controlActive = false;
  const repede = { izolat: false, precedent: null };
  const lv = treapta(OrbitControls.prototype._customWheelEvent.call(o, roata({ deltaY: 3, deltaMode: 1 })), repede).ln;
  const cv = treapta(OrbitControls.prototype._customWheelEvent.call(o, roata({ deltaY: -5, ctrlKey: true })), repede).ln;
  proba(t({ deltaY: 3, deltaMode: 1 }, repede) === LN && lv !== LN && Math.abs(cv + 0.05) > 0.01,
    `control: prin normarea lui OrbitControls, 3 linii dau ${rel(lv).toFixed(2)} trepte, ciupirea ln ${cv.toFixed(3)} — pică`);
}

// ------------------------------------------------------------ 3. ancorarea

console.log('\nZoomul spre cursor: punctul de sub cursor rămâne pe pixel, orientarea la fel');
{
  const grila = [];
  for (const fx of [0.25, 0.5, 0.75]) for (const fy of [0.3, 0.5, 0.7]) grila.push([fx * W, fy * H]);
  for (const decalaj of [false, true]) {
    let maxPx = 0, maxUnghi = 0, maxSferic = 0, n = 0;
    for (const [x, y] of grila) {
      const { camera, controale } = pagina();
      if (decalaj) camera.setViewOffset(W, H, 0.2 * W, 0, W, H);   // fișa laterală
      const P = subCursor(camera, controale, x, y);
      const q0 = camera.quaternion.clone();
      const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controale.target));
      clic(controale, x, y);
      cadre(controale);
      const [px, py] = proiect(camera, P);
      const s1 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controale.target));
      maxPx = Math.max(maxPx, Math.hypot(px - x, py - y));
      maxUnghi = Math.max(maxUnghi, camera.quaternion.angleTo(q0));
      maxSferic = Math.max(maxSferic, Math.abs(s1.theta - s0.theta), Math.abs(s1.phi - s0.phi));
      n++;
    }
    // `angleTo` trece prin acos: sub ~1e-7 rad citește zgomotul de rotunjire, nu o rotire.
    proba(maxPx < 0.5 && maxUnghi < 1e-7 && maxSferic < 1e-9,
      `${decalaj ? 'cu decalajul fișei' : 'din vederea de pornire'}, ${n} cursoare: punctul la cel mult ${maxPx.toExponential(1)} px, `
      + `orientarea cu ${maxUnghi.toExponential(1)} rad (precizia lui acos), azimutul și înclinarea cu ${maxSferic.toExponential(1)} rad`);
  }
}

// ------------------------------------------------------------ 4. limitele

console.log('\nLimitele: 80 m de teren, 8 km de țintă, ținta în alpha');
{
  // Spre platou, 40 de clicuri: camera nu ajunge la mai puțin de 80 m de punct.
  const { camera, controale } = pagina();
  let minP = Infinity;
  for (let i = 0; i < 40; i++) {
    const P = subCursor(camera, controale, 800, 290);
    clic(controale, 800, 290);
    cadre(controale);
    minP = Math.min(minP, camera.position.distanceTo(P));
  }
  proba(minP >= 80 - 1e-6, `spre platou, 40 de clicuri: camera la cel puțin ${minP.toFixed(2)} m de punctul de sub cursor`);
  // Control: fără garda de 80 m (dMin = 1), camera intră în relief.
  {
    const { camera: c2, controale: k2 } = pagina();
    const P = subCursor(c2, k2, 800, 290);
    for (let i = 0; i < 40; i++) pasZoom({ camera: c2, tinta: k2.target, P, ln: -LN, dMin: 1, dMax: 8000, alpha });
    proba(c2.position.distanceTo(P) < 20, `control: fără gardă, camera ajunge la ${c2.position.distanceTo(P).toFixed(1)} m de punct — pică`);
  }

  // Spre plajă: camera rămâne deasupra țintei, ținta deasupra mării.
  const { camera: c3, controale: k3 } = pagina();
  let cx = null;
  for (let x = 100; x < W && !cx; x += 20) for (let y = 300; y < H && !cx; y += 20) {
    const P = subCursor(c3, k3, x, y);
    const h = inaltimeRandata(P.x, P.z);
    if (h > 0.2 && h < 4 && alpha.contine(P.x, P.z)) cx = [x, y];
  }
  let minPeste = Infinity, minY = Infinity;
  for (let i = 0; cx && i < 40; i++) {
    clic(k3, ...cx);
    cadre(k3);
    minPeste = Math.min(minPeste, c3.position.y - k3.target.y);
    minY = Math.min(minY, k3.target.y);
  }
  proba(cx && minPeste >= 80 * Math.sin(0.04) - 1e-6 && minY >= 0,
    `spre plajă (${cx}), 40 de clicuri: camera cu cel puțin ${minPeste.toFixed(2)} m peste țintă (80 · sin 0,04 = 3,20), ținta la y ≥ ${minY.toFixed(2)}`);

  // Spre un deal din împrejurimi: ținta rămâne în alpha, deci limita n-are ce muta.
  const { camera: c4, controale: k4 } = pagina();
  let cy = null;
  for (let y = 40; y < 300 && !cy; y += 4) for (let x = 0; x < W && !cy; x += 40) {
    const P = subCursor(c4, k4, x, y);
    if (!alpha.contine(P.x, P.z) && inaltimeRandata(P.x, P.z) > 1) cy = [x, y];
  }
  let mutari = 0;
  for (let i = 0; cy && i < 12; i++) {
    clic(k4, ...cy);
    for (let k = 0; k < 60; k++) { ceas += 1000 / 60; k4.rotita.pas(); k4.update(); if (alpha.limiteaza(k4.target.clone(), c4.clone())) mutari++; }
  }
  proba(cy && mutari === 0, `spre împrejurimi (${cy}), 12 clicuri: limita lui alpha a avut ${mutari} ținte de mutat`);
  // Control: fără cutia lui alpha, ținta iese din ea.
  {
    const { camera: c5, controale: k5 } = pagina();
    let iese = 0;
    for (let i = 0; cy && i < 12; i++) {
      const P = subCursor(c5, k5, ...cy);
      pasZoom({ camera: c5, tinta: k5.target, P, ln: -LN, dMin: 80, dMax: 8000, alpha: null });
      if (!alpha.contine(k5.target.x, k5.target.z)) iese++;
    }
    proba(iese > 0, `control: fără cutia lui alpha, ținta iese din ea de ${iese} ori — pică`);
  }

  // 40 de clicuri înapoi ajung exact la 8 km.
  const { camera: c6, controale: k6 } = pagina();
  let rMax = 0;
  for (let i = 0; i < 40; i++) { clic(k6, 800, 450, 100); cadre(k6); rMax = Math.max(rMax, c6.position.distanceTo(k6.target)); }
  proba(Math.abs(rMax - 8000) < 1e-6, `40 de clicuri înapoi: distanța ajunge la ${rMax.toFixed(6)} m`);

  // De la 8 km la 80 m, pe raza din centru, fără teren: 14 clicuri (ln 100 / ln 1,4 = 13,7).
  const { camera: c7, controale: k7 } = pagina();
  k7.seteazaTeren(null);
  k7.rotita.seteazaTeren(null);
  for (let i = 0; i < 40; i++) { clic(k7, 800, 450, 100); cadre(k7); }
  const [cxx, cyy] = proiect(c7, k7.target);
  let clicuri = 0;
  for (; clicuri < 40 && c7.position.distanceTo(k7.target) > 80 + 1e-6; clicuri++) { clic(k7, cxx, cyy); cadre(k7); }
  proba(clicuri === 14, `de la ${8000} m la 80 m: ${clicuri} clicuri`);
}

// ------------------------------------------------------------ 5. alunecarea

console.log('\nAlunecarea: o treaptă întreagă, în ~0,2 s; fără amortizare, pe loc');
{
  const { camera, controale } = pagina();
  const P = subCursor(camera, controale, 800, 290);
  const d0 = camera.position.distanceTo(P);
  clic(controale, 800, 290);
  const n = cadre(controale);
  const aplicat = Math.log(d0 / camera.position.distanceTo(P));
  let dupa = 0;
  for (let i = 0; i < 60; i++) { ceas += 1000 / 60; if (controale.rotita.pas()) dupa++; }
  proba(Math.abs(aplicat - LN) < 1e-12 && n <= 30 && dupa === 0, `${n} cadre, ln aplicat ${aplicat.toFixed(15)} (ln 1,4 = ${LN.toFixed(15)}); după, ${dupa} cadre cerute`);
  const { camera: c2, controale: k2 } = pagina();
  k2.enableDamping = false;
  const P2 = subCursor(c2, k2, 800, 290), e0 = c2.position.distanceTo(P2);
  const peLoc = clic(k2, 800, 290);
  proba(peLoc && Math.abs(Math.log(e0 / c2.position.distanceTo(P2)) - LN) < 1e-12, 'fără amortizare (prefers-reduced-motion): treapta se aplică pe loc, întreagă');
}

// ------------------------------------------------------------ 5b. ce a găsit recenzia

console.log('\nCe a găsit recenzia');
{
  // Un eveniment mic de touchpad, aplicat pe loc, nu mai aruncă treptele din coadă.
  const treptePe = (secventa, golesteInainteDeMic = false) => {
    const { camera, controale } = pagina();
    const P = subCursor(camera, controale, 800, 450);
    const d0 = camera.position.distanceTo(P);
    for (const d of secventa) {
      if (golesteInainteDeMic && Math.abs(d) < 50) controale.rotita.opreste();
      controale.rotita.adauga({ clientX: 800, clientY: 450, deltaY: d, deltaMode: 0 }, RECT);
      ceas += 1000 / 60; controale.rotita.pas(); controale.update();
    }
    cadre(controale, 600);
    return Math.log(d0 / camera.position.distanceTo(P)) / LN;
  };
  const amestec = treptePe([-120, -120, -30]), golit = treptePe([-120, -120, -30], true);
  proba(amestec >= 2 && golit < 2, `rotiță 120, 120, apoi touchpad 30 px: ${amestec.toFixed(3)} trepte (control, cu coada golită ca înainte: ${golit.toFixed(3)} — pică)`);

  // Ținta lipită de peretele de vest al lui alpha, pe mare, camera dincolo de perete:
  // raza privirii abia atinge cutia. Niciun clic nu are voie să rămână fără efect.
  const strict = (o, u) => {
    let t0 = -Infinity, t1 = Infinity;
    for (const [k, lo, hi] of [['x', alpha.xMin, alpha.xMax], ['y', alpha.yMin, alpha.yMax], ['z', alpha.zMin, alpha.zMax]]) {
      if (Math.abs(u[k]) < 1e-12) { if (o[k] < lo || o[k] > hi) return null; continue; }
      const ta = (lo - o[k]) / u[k], tb = (hi - o[k]) / u[k];
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    return t0 <= t1 ? [t0, t1] : null;
  };
  let stari = 0, degenerate = 0, blocate = 0;
  for (const z of [-1200, -600, 0, 500, 1100]) for (const r of [500, 1500, 3000]) for (const phi of [1.0, 1.15, 1.3]) {
    const { camera, controale } = pagina();
    controale.target.set(alpha.xMin, 0, z);
    camera.position.setFromSpherical(new THREE.Spherical(r, phi, -Math.PI / 2 + 0.1)).add(controale.target);
    controale.update();
    if (camera.position.x >= alpha.xMin) continue;
    stari++;
    const u = controale.target.clone().sub(camera.position).normalize();
    if (!strict(camera.position, u)) degenerate++;
    for (const [x, y, d] of [[800, 200, 100], [800, 450, 100], [800, 450, -100]]) {
      const r0 = camera.position.distanceTo(controale.target);
      if (d > 0 && r0 > 8000 - 1e-6) continue;
      clic(controale, x, y, d);
      cadre(controale);
      if (Math.abs(camera.position.distanceTo(controale.target) - r0) < 1e-6) blocate++;
    }
  }
  proba(blocate === 0 && degenerate > 0, `ținta în peretele de vest, pe mare: ${stari} stări (${degenerate} cu raza privirii tangentă, unde fără toleranță cutia ieșea goală), ${blocate} clicuri fără efect`);

  // Zoomul spre far: P e turnul, nu terenul din spatele lui.
  {
    const { camera, controale } = pagina();
    let px = null;
    for (let y = 120; y < 260 && !px; y += 2) for (let x = 1150; x < 1400 && !px; x += 2) {
      const c = cladiri.loveste(razaLa(camera, x, y));
      if (c && c.y > 150) px = [x, y];
    }
    const faraCladiri = { ...TEREN, loveste: undefined };
    // Distanța până la punctul lanternei lovit din vederea de pornire, fix: camera care
    // trece prin turn nu-l mai vede, deci o rază refăcută la fiecare clic l-ar pierde.
    const lanterna = px && (() => { const h = cladiri.loveste(razaLa(camera, ...px)); return new THREE.Vector3(h.x, h.y, h.z); })();
    const spre = (teren) => {
      const { camera: c, controale: k } = pagina();
      k.seteazaTeren(teren);
      let minDist = c.position.distanceTo(lanterna);
      for (let i = 0; i < 14; i++) {
        clic(k, ...px);
        for (let f = 0; f < 60; f++) { ceas += 1000 / 60; k.rotita.pas(); k.update(); minDist = Math.min(minDist, c.position.distanceTo(lanterna)); }
      }
      return minDist;
    };
    const cu = px && spre(TEREN), fara = px && spre(faraCladiri);
    proba(px && cu >= 80 - 1e-6 && fara < 20, `14 clicuri spre lanterna farului (${px}): camera la cel puțin ${cu?.toFixed(2)} m de ea (control, fără clădiri: ${fara?.toFixed(2)} m — pică)`);
  }

  // Butonul din mijloc, după un zoom spre platou: camera nu intră în relief.
  const nod = () => ({ addEventListener() {}, removeEventListener() {} });
  const fals = () => ({ ...nod(), style: { removeProperty() {} }, ownerDocument: nod(), getRootNode: nod, setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => RECT, clientWidth: W, clientHeight: H });
  const ev = (o) => ({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: 800, clientY: 450, pageX: 800, pageY: 450, ctrlKey: false, metaKey: false, shiftKey: false, ...o });
  const controaleFalse = () => {
    const camera = new THREE.PerspectiveCamera(45, W / H, 10, 60000);
    camera.position.fromArray(VEDERE_START.pozitie);
    const k = new ControaleHarta(camera, fals());
    k.target.fromArray(VEDERE_START.tinta);
    k.minDistance = 80; k.maxDistance = 8000; k.maxPolarAngle = Math.PI / 2 - 0.04; k.minPolarAngle = 0.15;
    k.update();
    k.seteazaTeren(TEREN);
    return { camera, k };
  };
  const mijloc = (faraPivot) => {
    const { camera, k } = controaleFalse();
    if (faraPivot) k.pivotPeTeren = () => {};
    for (let i = 0; i < 6; i++) { clic(k, 800, 290); cadre(k); }
    // Tras în sus de mai multe ori, până la distanța minimă de țintă.
    let minPeste = Infinity;
    for (let tragere = 0; tragere < 8; tragere++) {
      k._onPointerDown(ev({ button: 1, clientY: 800, pageY: 800 }));
      for (let y = 780; y > 0; y -= 20) {
        k._onPointerMove(ev({ button: 1, clientY: y, pageY: y }));
        minPeste = Math.min(minPeste, camera.position.y - inaltimeRandata(camera.position.x, camera.position.z));
      }
      k._onPointerUp(ev({ button: 1, clientY: 0, pageY: 0 }));
    }
    return minPeste;
  };
  const pesteCu = mijloc(false), pesteFara = mijloc(true);
  proba(pesteCu > 0 && pesteFara < 0, `6 clicuri spre platou, apoi butonul din mijloc tras: camera cu ${pesteCu.toFixed(2)} m peste relief (control, fără pivotul pe teren: ${pesteFara.toFixed(2)} m — pică)`);

  // Apucarea pe mare: suprafața mării rămâne sub cursor, nu umplutura de −8 m.
  {
    const { camera, k } = controaleFalse();
    const raza = razaLa(camera, 800, 820);
    const mare = raza.at((raza.origin.y - COTA_MARE) / -raza.direction.y, new THREE.Vector3());
    const umplutura = raza.at((raza.origin.y + 8) / -raza.direction.y, new THREE.Vector3());
    const subPunct = inaltimeRandata(mare.x, mare.z);
    k._onPointerDown(ev({ clientY: 820, pageY: 820 }));
    let x = 800, y = 820;
    for (let i = 0; i < 8; i++) { x += 12; y -= 25; k._onPointerMove(ev({ clientX: x, pageX: x, clientY: y, pageY: y })); }
    k._onPointerUp(ev({ clientX: x, pageX: x, clientY: y, pageY: y }));
    const [mx, my] = proiect(camera, mare), [ux, uy] = proiect(camera, umplutura);
    const dMare = Math.hypot(mx - x, my - y), dUmpl = Math.hypot(ux - x, uy - y);
    proba(subPunct < COTA_MARE && dMare < 0.5 && dUmpl > 2, `apucată pe mare, trasă 200 px: suprafața mării la ${dMare.toExponential(1)} px de cursor (control, umplutura de −8 m: ${dUmpl.toFixed(1)} px — pică)`);
  }
}

// ------------------------------------------------------------ 6. zborul golește rotița

console.log('\nUn zbor golește treptele rotiței');
{
  // Sub prefers-reduced-motion zborul sare direct la capăt, deci treptele rămase ar
  // împinge camera de acolo. Zborul animat le-ar acoperi oricum: își rescrie poziția la
  // fiecare cadru și ține mai mult decât alunecarea lor.
  const zboara = (cuGolire) => {
    const { camera, controale } = pagina();
    globalThis.matchMedia = () => ({ matches: true, addEventListener() {} });
    const zbor = creeazaZbor({ camera, controale, cereRandare: () => {} });
    globalThis.matchMedia = undefined;
    controale.target.set(100, 60, 100); camera.position.set(600, 500, 900); controale.update();
    clic(controale, 800, 400); clic(controale, 800, 400);
    zbor.spre(VEDERE_START);
    if (!cuGolire) { clic(controale, 800, 400); clic(controale, 800, 400); }   // ca și cum n-ar fi golit
    for (let i = 0; i < 400; i++) { ceas += 1000 / 60; zbor.pas(); controale.rotita.pas(); controale.update(); }
    return Math.max(controale.target.distanceTo(new THREE.Vector3(...VEDERE_START.tinta)), camera.position.distanceTo(new THREE.Vector3(...VEDERE_START.pozitie)));
  };
  const e = zboara(true), ctl = zboara(false);
  proba(e < 1e-9, `rotiță, apoi zborul acasă: aterizează la ${e.toExponential(1)} m`);
  proba(ctl > 1, `control: cu treptele lăsate în coadă, aterizează la ${ctl.toFixed(1)} m — pică`);
}

// ------------------------------------------------------------ 7. stările gesturilor

console.log('\nStările gesturilor, citite la `start`, ca în gest.js');
{
  const nod = () => ({ addEventListener() {}, removeEventListener() {} });
  const stil = { removeProperty(k) { delete this[k]; } };
  const el = {
    ...nod(), style: stil, ownerDocument: nod(), getRootNode: nod,
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => RECT, clientWidth: W, clientHeight: H,
  };
  const camera = new THREE.PerspectiveCamera(45, W / H, 10, 60000);
  camera.position.fromArray(VEDERE_START.pozitie);
  const k = new ControaleHarta(camera, el);
  k.target.fromArray(VEDERE_START.tinta);
  k.update();
  proba(!('cursor' in stil), 'la creare, niciun cursor inline pe canvas (connect → disconnect îl scria)');
  let laStart = null;
  k.addEventListener('start', () => { laStart = k.state; });
  const ev = (o) => ({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: 800, clientY: 450, pageX: 800, pageY: 450, ctrlKey: false, metaKey: false, shiftKey: false, ...o });
  const apasa = (o) => { laStart = null; k._onPointerDown(ev(o)); const s = laStart; k._onPointerUp(ev(o)); return s; };
  proba(apasa({ button: 2 }) === STARE.ROTIRE, 'butonul drept: rotire');
  proba(apasa({ button: 0 }) === STARE.MUTARE, 'butonul stâng: mutare');
  proba(apasa({ button: 0, shiftKey: true }) === STARE.ROTIRE, 'Shift + stâng: rotire');
  proba(apasa({ button: 1 }) === STARE.ZOOM, 'mijlocul: zoom prin tragere');
  laStart = null;
  k._onPointerDown(ev({ pointerType: 'touch', pointerId: 11 }));
  const unu = laStart;
  k._onPointerDown(ev({ pointerType: 'touch', pointerId: 12, pageX: 900, clientX: 900 }));
  const doi = laStart;
  k._onPointerUp(ev({ pointerType: 'touch', pointerId: 12 }));
  const iarUnu = laStart;
  k._onPointerUp(ev({ pointerType: 'touch', pointerId: 11 }));
  proba(unu === STARE.DEGET_MUTARE && doi === STARE.DEGETE_ZOOM_ROTIRE && iarUnu === STARE.DEGET_MUTARE,
    `degetele: unul ${unu}, două ${doi}, ridicat unul ${iarUnu} (aștept ${STARE.DEGET_MUTARE}, ${STARE.DEGETE_ZOOM_ROTIRE}, ${STARE.DEGET_MUTARE})`);
  // Ce folosim din OrbitControls fără să fie public: dacă three se schimbă, aici pică.
  const priv = ['_handleMouseWheel', '_customWheelEvent', '_handleMouseDownPan', '_handleMouseMovePan', '_handleTouchStartPan',
    '_handleTouchMovePan', '_handleMouseDownRotate', '_handleTouchStartDollyRotate', '_handleTouchMoveDolly', '_getSecondPointerPosition',
    '_isTrackingPointer', '_pan', '_rotateLeft', '_rotateUp'];
  const lipsa = priv.filter((m) => typeof OrbitControls.prototype[m] !== 'function');
  const CAMPURI = ['_panOffset', '_controlActive', '_pointers', '_dollyStart', '_pointerPositions', '_onPointerMove', '_onPointerUp'];
  const campuri = CAMPURI.filter((c) => !(c in k));
  proba(!lipsa.length && !campuri.length, `metodele și câmpurile private folosite există (${priv.length} + ${CAMPURI.length})${lipsa.length || campuri.length ? ': lipsesc ' + [...lipsa, ...campuri].join(', ') : ''}`);
  k.dispose();
  proba(!('cursor' in stil), 'după dispose(), niciun cursor inline: disconnect() scrie „auto”, iar dispose() îl scoate');
  const { controale } = creeazaCamera(null);
  descarcaInertia(controale);
  proba(controale instanceof ControaleHarta && controale.mouseButtons.LEFT === THREE.MOUSE.PAN && controale.mouseButtons.RIGHT === THREE.MOUSE.ROTATE
    && controale.touches.ONE === THREE.TOUCH.PAN && controale.touches.TWO === THREE.TOUCH.DOLLY_ROTATE && controale.screenSpacePanning === false,
  'creeazaCamera: stânga mută, dreapta rotește, un deget mută, două ciupesc și rotesc, mutarea pe orizontală');
}

// ------------------------------------------------------------ 8. panoul punctului

console.log('\nPanoul „Coordonate”: punctul e ce se vede sub cursor, ca la rotiță și la apucare');
{
  // Panoul adevărat, prin `culegeLa`, cu un DOM falsificat cât îi trebuie: elemente care
  // țin `textContent` și `hidden`, câte unul pe selector, și ascultătorii lor (`asc`).
  const fals = () => ({ hidden: false, textContent: '', title: '', classList: { toggle() {} }, setAttribute() {}, toggleAttribute() {},
    removeAttribute() {}, addEventListener(t, f) { (this.asc ??= {})[t] = f; }, removeEventListener(t) { if (this.asc) delete this.asc[t]; },
    focus() {}, remove() {} });
  const noduri = new Map();
  const unul = (s) => noduri.get(s) ?? noduri.set(s, fals()).get(s);
  const NR_AXE = { '.sc .axa': 3, '.tm .axa': 2 };
  globalThis.document = { documentElement: fals(), addEventListener() {}, removeEventListener() {}, createElement: () => ({ ...fals(), set innerHTML(_) {}, querySelector: unul,
    querySelectorAll: (s) => Array.from({ length: NR_AXE[s] ?? 0 }, (_, i) => unul(`${s} ${i}`)) }) };
  globalThis.addEventListener = globalThis.removeEventListener = () => {};
  const { camera } = pagina();
  camera.updateMatrixWorld();
  const loveste = TEREN.loveste, lim = imp.limite;
  const panou = creeazaPunct({ gazda: { appendChild() {} }, canvas: { ...fals(), getBoundingClientRect: () => RECT }, camera,
    geo: creeazaGeo(relief.meta), inaltimeLa: inaltimeRandata, limitaDatelor, limiteMars: lim, inAlpha: alpha.contine,
    zMin: relief.meta.zMin_m, loveste });
  proba(panou?.culegeLa(800, 450) === null, 'minimizat, `culegeLa` nu culege nimic');
  panou.activeaza();

  // Compunerea de dinainte din punct.js (v0.1.5), înghețată aici: mersul numai pe relief,
  // apoi planul y = 0, apoi clădirile. Pe apă relieful e umplutura de −8 m.
  const planVechi = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const vechi = (raza, maxim) => {
    const tmp = new THREE.Vector3();
    let p = null;
    const t = marsPeTeren(raza, inaltimeRandata, lim, maxim);
    if (t !== null) { raza.at(t, tmp); p = { x: tmp.x, z: tmp.z, t }; }
    else if (raza.intersectPlane(planVechi, tmp)) p = { x: tmp.x, z: tmp.z, t: tmp.distanceTo(raza.origin) };
    const c = loveste(raza);
    return c && !(p && p.t <= c.t) ? { x: c.x, z: c.z, t: c.t } : p;
  };

  // Grila de pixeli a vederii de pornire, 100 × 56, la 1600 × 900.
  const diag = Math.hypot(lim.xMax - lim.xMin, lim.zMax - lim.zMin);
  let n = 0, departe = 0, mare = 0, apa = 0, axe = 0;
  const peMare = [], peMareVechi = [];
  for (let py = 8; py < H; py += 16) for (let px = 8; px < W; px += 16) {
    const raza = razaLa(camera, px, py).clone();
    const maxim = raza.origin.length() + diag * 1.5;
    const t = punctVazut(raza, { inaltimeLa: inaltimeRandata, lim, loveste }, maxim);
    if (t === null) continue;
    const v = raza.at(t, new THREE.Vector3());
    const p = panou.culegeLa(px, py);
    n++;
    const d = p ? Math.max(Math.hypot(p.x - v.x, p.z - v.z), Math.abs(p.t - t)) : Infinity;
    if (d > 1e-6) departe++;
    if (Math.abs(v.y - COTA_MARE) > 1e-6 || !alpha.contine(v.x, v.z)) continue;
    // Marea din alpha: eticheta altitudinii e „apă”, iar fiecare axă stă în elementul ei.
    mare++;
    if (unul('.alt').textContent === 'apă') apa++;
    if ([0, 1, 2].every((i) => /^[XYZ] \S+$/.test(unul(`.sc .axa ${i}`).textContent))) axe++;
    peMare.push(d);
    const w = vechi(raza, maxim);
    peMareVechi.push(w ? Math.hypot(w.x - v.x, w.z - v.z) : Infinity);
  }
  const mediana = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  const maxNou = Math.max(...peMare);
  proba(n > 4000 && departe === 0 && mare > 1000,
    `${n} pixeli cu ceva sub cursor, ${mare} pe marea din alpha: punctul panoului e cel văzut (\`punctVazut\`) peste tot, `
    + `${departe} la peste 1 µm (pe mare, cel mult ${maxNou.toExponential(1)} m)`);
  proba(apa >= 0.999 * mare && axe === mare, `pe marea din alpha, „apă” pe ${apa} din ${mare} pixeli; axele scrise câte una pe element pe ${axe}`);
  const mv = mediana(peMareVechi), maxV = Math.max(...peMareVechi);
  proba(mv > 1, `control: compunerea veche (relieful, apoi y = 0) pune punctul pe umplutura de −8 m, la mediana ${mv.toFixed(2)} m `
    + `(cel mult ${maxV.toFixed(2)} m) de suprafața văzută — pică`);
  panou.dispose();

  // „Măsoară centrul”: panoul fără mouse. Clicul pe buton culege punctul din centrul vederii
  // (`centru`, din controale; implicit centrul canvasului), cu aceeași culegere ca un clic pe
  // hartă; minimizat, nimic. Control: punct.js de la REPER_VECHI, fără buton.
  const centrul = (M, centru) => {
    noduri.clear();
    const p = M.creeazaPunct({ gazda: { appendChild() {} }, canvas: { ...fals(), getBoundingClientRect: () => RECT }, camera,
      geo: creeazaGeo(relief.meta), inaltimeLa: inaltimeRandata, limitaDatelor, limiteMars: lim, inAlpha: alpha.contine,
      zMin: relief.meta.zMin_m, loveste, centru });
    const apasaButonul = () => { const f = unul('.centru').asc?.click; f?.(); return Boolean(f); };
    const scris = () => ['.alt', '.lon', '.lat'].map((s) => unul(s).textContent).join(' / ');
    const exista = apasaButonul();
    const minimizat = scris();
    p.activeaza();
    apasaButonul();
    const dinButon = scris();
    p.culegeLa(100, 820);
    const altul = scris();
    const c = centru?.() ?? { x: W / 2, y: H / 2 };
    p.culegeLa(c.x, c.y);
    const dinClic = scris();
    p.dispose();
    return { exista, minimizat, dinButon, altul, dinClic };
  };
  const bunCentru = (r) => r.exista && r.minimizat === ' /  / ' && /\d/.test(r.dinButon) && r.dinButon === r.dinClic && r.dinButon !== r.altul;
  const cImplicit = centrul(PUNCT), cDat = centrul(PUNCT, () => ({ x: 400, y: 300 }));
  proba(bunCentru(cImplicit) && bunCentru(cDat) && cImplicit.dinButon !== cDat.dinButon,
    `„Măsoară centrul”: minimizat nu scrie nimic; activat, scrie „${cImplicit.dinButon}” — cât un clic în centrul canvasului; `
    + `cu centrul vederii dat la (400, 300), „${cDat.dinButon}”, cât un clic acolo`);
  const PV = await modulDin(textVechi('src/scene/punct.js'));
  const cv = PV ? centrul(PV) : null;
  proba(cv !== null && !bunCentru(cv), `control, punct.js de la ${REPER_VECHI}: ${cv === null ? 'NECITIT' : cv.exista ? 'butonul există' : 'niciun buton, nicio cale fără mouse'} — pică`);
  delete globalThis.document;
  delete globalThis.addEventListener;
  delete globalThis.removeEventListener;
}

// ------------------------------------------------------------ 9. gestul întrerupt

console.log('\nGestul întrerupt: zborul pornit cu harta ținută, focusul sau captura pierdute în mijlocul unei trageri');
{
  // Un canvas, un document și o fereastră ca ale browserului, cât le trebuie controalelor:
  // ascultătorii chiar se înscriu și chiar primesc evenimentele, deci unul scos nu mai aude
  // nimic. `pointermove` și `pointerup` ajung la document, unde urcă de pe canvasul
  // capturat. Captura se ține minte: o atingere se capturează singură la apăsare, eliberarea
  // emite `lostpointercapture` pe loc — browserul îl emite înaintea următorului eveniment de
  // pointer —, iar pe un pointer care nu mai e activ aruncă NotFoundError, ca în
  // specificație. După `pointerup`, captura rămasă se pierde implicit.
  const browser = ({ faraMiscare = false } = {}) => {
    const doc = new EventTarget(), fereastra = new EventTarget();
    globalThis.addEventListener = fereastra.addEventListener.bind(fereastra);
    globalThis.removeEventListener = fereastra.removeEventListener.bind(fereastra);
    const el = Object.assign(new EventTarget(), {
      style: { removeProperty() {} }, ownerDocument: doc, getRootNode: () => doc,
      getBoundingClientRect: () => RECT, clientWidth: W, clientHeight: H,
    });
    const capturat = new Set(), activ = new Set([1]);   // mouse-ul e mereu activ
    const pierde = (id) => { if (capturat.delete(id)) el.dispatchEvent(Object.assign(new Event('lostpointercapture'), { pointerId: id })); };
    el.setPointerCapture = (id) => { capturat.add(id); };
    el.releasePointerCapture = (id) => {
      if (!activ.has(id)) throw new DOMException('pointerul nu mai e activ', 'NotFoundError');
      pierde(id);
    };
    const ev = (tip, { x = 800, y = 450, ...o } = {}) => Object.assign(new Event(tip), { pointerId: 1, pointerType: 'mouse', button: 0,
      buttons: 1, clientX: x, clientY: y, pageX: x, pageY: y, ctrlKey: false, metaKey: false, shiftKey: false, ...o });

    const { camera, controale } = creeazaCamera(el);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    controale.seteazaTeren(TEREN);
    controale.enableDamping = !faraMiscare;
    // Limita lui alpha, ca în scena.js: la `change` și în buclă.
    const tine = () => { const t = controale.target, x = t.x, z = t.z; alpha.limiteaza(t, camera); controale.mutaApucarea(t.x - x, t.z - z); };
    controale.addEventListener('change', tine);
    globalThis.matchMedia = () => ({ matches: faraMiscare, addEventListener() {} });
    const zbor = creeazaZbor({ camera, controale, cereRandare: () => {} });
    globalThis.matchMedia = undefined;
    let sfarsit = 0;
    controale.addEventListener('end', () => sfarsit++);
    return {
      camera, controale, zbor, el, fereastra, activ,
      get sfarsit() { return sfarsit; },
      apasa(o = {}) {
        const id = o.pointerId ?? 1;
        if (o.pointerType === 'touch') { activ.add(id); capturat.add(id); }
        el.dispatchEvent(ev('pointerdown', o));
      },
      misca(o = {}) { doc.dispatchEvent(ev('pointermove', o)); },
      ridica(o = {}) {
        const id = o.pointerId ?? 1;
        doc.dispatchEvent(ev('pointerup', { ...o, buttons: 0 }));
        pierde(id);
        if (o.pointerType === 'touch') activ.delete(id);
      },
      pierdeCaptura: pierde,
      blur() { fereastra.dispatchEvent(new Event('blur')); },
      cadre(n) { for (let i = 0; i < n; i++) { ceas += 1000 / 60; zbor.pas(); controale.update(); tine(); } },
      dispose() { zbor.dispose(); controale.dispose(); delete globalThis.addEventListener; delete globalThis.removeEventListener; },
    };
  };
  // Codul de dinainte n-avea niciun ascultător de captură pierdută sau de focus.
  const faraAscultatori = (b) => {
    b.el.removeEventListener('lostpointercapture', b.controale._laCapturaPierduta);
    b.fereastra.removeEventListener('blur', b.controale._laBlur);
  };

  // --- Zborul acasă (Home) cu harta ținută: apoi 1 px de mișcare și 300 de cadre.
  const ACASA_T = new THREE.Vector3(...VEDERE_START.tinta), ACASA_P = new THREE.Vector3(...VEDERE_START.pozitie);
  const departeDeAcasa = (b) => Math.max(b.controale.target.distanceTo(ACASA_T), b.camera.position.distanceTo(ACASA_P));
  const acasaInTragere = ({ deget, faraMiscare, inlocuieste }) => {
    const b = browser({ faraMiscare });
    if (inlocuieste) b.controale.incheieGestul = inlocuieste(b.controale);
    const p = deget ? { pointerType: 'touch', pointerId: 11 } : {};
    // Departe de casă: deasupra farului, spre sud-est.
    b.controale.target.set(450, 60, 900);
    b.camera.position.set(700, 500, 1300);
    b.controale.update();
    b.cadre(5);
    // Apasă pe hartă și trage 290 px; apucarea ține un punct de teren, în coordonate de lume.
    b.apasa({ ...p, x: 800, y: 600 });
    const apucat = Boolean(b.controale._apucat);
    for (let x = 810; x <= 1100; x += 10) b.misca({ ...p, x, y: 600 });
    b.cadre(1);
    // Home, cu harta încă ținută (scena.js: acasa() → zbor.spre(VEDERE_START)), zborul dus la capăt.
    b.zbor.spre(VEDERE_START);
    for (let n = 0; b.zbor.activ && n < 1000; n++) b.cadre(1);
    b.cadre(3);
    const aterizare = departeDeAcasa(b);
    // Un pixel, cu harta tot ținută, apoi amortizarea stinsă.
    b.misca({ ...p, x: 1101, y: 600 });
    b.cadre(300);
    const salt = departeDeAcasa(b);
    b.ridica({ ...p, x: 1101, y: 600 });
    const sfarsit = b.sfarsit;
    // O apăsare nouă apucă din nou terenul și trage harta: punctul rămâne sub cursor.
    const q = deget ? { pointerType: 'touch', pointerId: 12 } : {};
    const c0 = b.camera.position.clone();
    b.apasa({ ...q, x: 800, y: 450 });
    const P = b.controale._apucat?.clone();
    b.misca({ ...q, x: 850, y: 420 });
    const [px, py] = P ? proiect(b.camera, P) : [Infinity, Infinity];
    const din_nou = { apucat: Boolean(P), sub: Math.hypot(px - 850, py - 420), mutat: b.camera.position.distanceTo(c0) };
    b.ridica({ ...q, x: 850, y: 420 });
    b.dispose();
    return { apucat, aterizare, salt, sfarsit, din_nou };
  };
  for (const deget of [false, true]) {
    const r = [false, true].map((faraMiscare) => acasaInTragere({ deget, faraMiscare }));
    const nume = deget ? 'un deget' : 'mouse-ul';
    proba(r.every((x) => x.apucat && x.aterizare < 1e-9 && x.salt < 1e-9 && x.sfarsit === 1),
      `${nume}, tras 290 px, Home cu harta ținută, zbor animat și sub reduced-motion: aterizează la `
      + `${Math.max(...r.map((x) => x.aterizare)).toExponential(1)} m, iar 1 px și 300 de cadre îl lasă la `
      + `${Math.max(...r.map((x) => x.salt)).toExponential(1)} m de acasă; ${r.map((x) => x.sfarsit).join(' / ')} \`end\``);
    proba(r.every((x) => x.din_nou.apucat && x.din_nou.sub < 0.5 && x.din_nou.mutat > 1),
      `${nume}, apoi o apăsare nouă: apucă din nou terenul, mută harta cu ${r[0].din_nou.mutat.toFixed(1)} m, `
      + `punctul la ${Math.max(...r.map((x) => x.din_nou.sub)).toExponential(1)} px de cursor`);
    const vechi = acasaInTragere({ deget, faraMiscare: false, inlocuieste: () => () => {} });
    const numaiPunct = acasaInTragere({ deget, faraMiscare: false, inlocuieste: (k) => () => { k._apucat = null; } });
    proba(vechi.salt > 1000 && numaiPunct.salt > 100,
      `control, ${nume}: fără gestul încheiat la zbor, 1 px aruncă harta la ${vechi.salt.toFixed(1)} m de acasă; `
      + `uitând numai punctul apucat, la ${numaiPunct.salt.toFixed(1)} m (\`_panStart\` rămâne cel de la apăsare) — pică`);
  }

  // --- Tragerea „lipită”: fără `pointerup`, 200 px de mișcare cu `buttons: 0`.
  const lipita = ({ declansator, buton = 0, vechi = false }) => {
    const b = browser();
    if (vechi) faraAscultatori(b);
    b.apasa({ x: 800, y: 500, button: buton, buttons: buton === 2 ? 2 : 1 });
    b.misca({ x: 820, y: 500, buttons: buton === 2 ? 2 : 1 });
    if (declansator === 'blur') b.blur(); else b.pierdeCaptura(1);
    // Inerția rotirii se stinge cu 0,92 pe cadru: după 300 de cadre mai mută camera cu 10⁻⁹ m.
    b.cadre(600);
    const p0 = b.camera.position.clone(), stare = b.controale.state;
    for (let x = 840; x <= 1020; x += 20) b.misca({ x, y: 500, buttons: 0 });
    b.cadre(300);
    const r = { mutat: b.camera.position.distanceTo(p0), sfarsit: b.sfarsit, stare };
    b.dispose();
    return r;
  };
  for (const declansator of ['blur', 'lostpointercapture']) for (const buton of [0, 2]) {
    const r = lipita({ declansator, buton }), v = lipita({ declansator, buton, vechi: true });
    proba(r.mutat === 0 && r.sfarsit === 1 && r.stare === STARE.NIMIC && v.mutat > 10 && v.sfarsit === 0,
      `\`${declansator}\` în mijlocul unei ${buton ? 'rotiri' : 'mutări'}, fără \`pointerup\`: 200 px fără buton mută camera cu `
      + `${r.mutat} m, ${r.sfarsit} \`end\` (control, fără ascultătorii noi: ${v.mutat.toFixed(1)} m, ${v.sfarsit} \`end\`, starea ${v.stare} — pică)`);
  }

  // O tragere obișnuită: un singur `end`, iar captura pierdută după `pointerup` nu mai adaugă unul.
  {
    const b = browser();
    b.apasa({ x: 800, y: 500 });
    for (let x = 820; x <= 900; x += 20) b.misca({ x, y: 500 });
    b.ridica({ x: 900, y: 500 });
    b.blur();
    const p0 = b.camera.position.clone();
    b.misca({ x: 1000, y: 500, buttons: 0 });
    proba(b.sfarsit === 1 && b.controale.state === STARE.NIMIC && b.camera.position.distanceTo(p0) === 0,
      `tragere obișnuită, apoi \`blur\`: ${b.sfarsit} \`end\`, starea ${b.controale.state}`);
    b.dispose();
  }

  // Două degete: ridicarea lui A, cu captura lui pierdută după, îl lasă pe B să mute harta.
  const doua = (gresit) => {
    const b = browser();
    if (gresit) {
      // Greșeala de evitat: captura pierdută încheie `_pointers[0]`, nu pointerul ei.
      faraAscultatori(b);
      b.el.addEventListener('lostpointercapture', () => { const k = b.controale; if (k._pointers.length) k._onPointerUp({ pointerId: k._pointers[0] }); });
    }
    const A = { pointerType: 'touch', pointerId: 21 }, B = { pointerType: 'touch', pointerId: 22 };
    b.apasa({ ...A, x: 700, y: 500 });
    b.apasa({ ...B, x: 900, y: 500 });
    b.ridica({ ...A, x: 700, y: 500 });
    b.cadre(300);
    const p0 = b.camera.position.clone(), inainte = b.sfarsit;
    for (let x = 920; x <= 1100; x += 20) b.misca({ ...B, x, y: 500 });
    const r = { mutat: b.camera.position.distanceTo(p0), inainte };
    b.ridica({ ...B, x: 1100, y: 500 });
    r.dupa = b.sfarsit;
    b.dispose();
    return r;
  };
  const d2 = doua(false), d2g = doua(true);
  proba(d2.mutat > 10 && d2.inainte === 0 && d2.dupa === 1 && d2g.mutat === 0,
    `două degete, ridicat A: B mută harta cu ${d2.mutat.toFixed(1)} m, ${d2.inainte} \`end\` până la ridicarea lui B, apoi ${d2.dupa} `
    + `(control, captura pierdută încheie \`_pointers[0]\`: B mută ${d2g.mutat} m — pică)`);

  // Două degete, iar A își pierde captura FĂRĂ să se ridice: numai A iese din gest. Proba de
  // deasupra nu ajunge aici — acolo `pointerup` îl scoate pe A înaintea capturii pierdute.
  const capturaA = (mutatie) => {
    const b = browser();
    if (mutatie) {
      faraAscultatori(b);
      b.el.addEventListener('lostpointercapture', (e) => { const k = b.controale; if (mutatie === 'tot' && k._isTrackingPointer(e)) k.incheieGestul(); });
    }
    const A = { pointerType: 'touch', pointerId: 21 }, B = { pointerType: 'touch', pointerId: 22 };
    b.apasa({ ...A, x: 700, y: 500 });
    b.apasa({ ...B, x: 900, y: 500 });
    b.pierdeCaptura(21);
    b.cadre(300);
    const p0 = b.camera.position.clone();
    const r = { inainte: b.sfarsit, pointeri: [...b.controale._pointers].join(','), stare: b.controale.state };
    for (let x = 920; x <= 1100; x += 20) b.misca({ ...B, x, y: 500 });
    r.mutat = b.camera.position.distanceTo(p0);
    b.dispose();
    return r;
  };
  const ca = capturaA(), caTot = capturaA('tot'), caNimic = capturaA('nimic');
  proba(ca.pointeri === '22' && ca.stare === STARE.DEGET_MUTARE && ca.mutat > 10 && ca.inainte === 0
    && caTot.mutat === 0 && caTot.inainte === 1 && caNimic.pointeri === '21,22',
    `două degete, A își pierde captura fără să se ridice: rămâne B (${ca.pointeri}), starea ${ca.stare}, mută harta cu `
    + `${ca.mutat.toFixed(1)} m, ${ca.inainte} \`end\` (control: încheiat tot gestul, ${caTot.mutat} m și ${caTot.inainte} \`end\`; `
    + `fără ascultător, pointerii ${caNimic.pointeri} — pică)`);

  // Un deget rămas pe sticlă după un gest încheiat de zbor sau de `blur` nu mai e al hărții:
  // un deget nou o apucă, iar mișcările celui vechi, care urcă tot la document, n-o mai mută.
  const fantoma = ({ declansator, nefiltrat }) => {
    const b = browser();
    if (nefiltrat) b.controale._onPointerMove = b.controale._onPointerMoveOrbit;
    const A = { pointerType: 'touch', pointerId: 41 }, C = { pointerType: 'touch', pointerId: 43 };
    b.apasa({ ...A, x: 800, y: 600 });
    for (let x = 810; x <= 1100; x += 10) b.misca({ ...A, x, y: 600 });
    b.cadre(1);
    if (declansator === 'zbor') {
      b.zbor.spre(VEDERE_START);
      for (let n = 0; b.zbor.activ && n < 1000; n++) b.cadre(1);
    } else b.blur();
    b.cadre(300);
    b.apasa({ ...C, x: 700, y: 450 });
    const P = b.controale._apucat?.clone(), c0 = b.camera.position.clone();
    b.misca({ ...A, x: 1101, y: 600 });
    b.cadre(300);
    const [px, py] = P ? proiect(b.camera, P) : [Infinity, Infinity];
    const r = { salt: b.camera.position.distanceTo(c0), sub: Math.hypot(px - 700, py - 450) };
    b.dispose();
    return r;
  };
  for (const declansator of ['zbor', 'blur']) {
    const r = fantoma({ declansator }), v = fantoma({ declansator, nefiltrat: true });
    proba(r.salt < 1e-6 && r.sub < 0.5 && v.salt > 100,
      `un deget rămas pe sticlă după ${declansator === 'zbor' ? 'zborul acasă' : '`blur`'}, apoi altul pus pe hartă: mișcarea celui vechi `
      + `mută camera cu ${r.salt.toExponential(1)} m, punctul apucat la ${r.sub.toExponential(1)} px de degetul nou `
      + `(control, fără filtrul mișcării: ${v.salt.toFixed(1)} m — pică)`);
  }

  // Un deget pus pe busolă, jos-dreapta ca pe telefon, cât altul ține harta: apăsarea lui nu
  // ajunge la canvas, mișcarea da. (Mai sus, pe cer, mutarea n-ar avea plan de apucat.)
  const strain = (nefiltrat) => {
    const b = browser();
    if (nefiltrat) b.controale._onPointerMove = b.controale._onPointerMoveOrbit;
    b.apasa({ pointerType: 'touch', pointerId: 51, x: 800, y: 500 });
    b.cadre(5);
    const c0 = b.camera.position.clone();
    for (let x = 1300; x <= 1400; x += 20) b.misca({ pointerType: 'touch', pointerId: 52, x, y: 650 });
    b.cadre(300);
    const salt = b.camera.position.distanceTo(c0);
    b.dispose();
    return salt;
  };
  const st = strain(false), stv = strain(true);
  proba(st < 1e-6 && stv > 100,
    `un deget ține harta, altul se mișcă pe busolă: camera se mută cu ${st.toExponential(1)} m `
    + `(control, fără filtrul mișcării: ${stv.toFixed(1)} m — pică)`);

  // Un deget care nu mai e activ: eliberarea capturii aruncă NotFoundError, iar gestul tot se încheie.
  {
    const b = browser();
    const D = { pointerType: 'touch', pointerId: 31 };
    b.apasa({ ...D, x: 800, y: 500 });
    b.misca({ ...D, x: 820, y: 500 });
    b.activ.delete(31);
    let eroare = null;
    try { b.blur(); } catch (e) { eroare = e; }
    const bun = !eroare && b.sfarsit === 1 && b.controale.state === STARE.NIMIC && !b.controale._pointers.length;
    b.dispose();
    // Control: fiecare pointer ridicat prin `_onPointerUp`, cu eliberarea lui OrbitControls neprinsă.
    const c = browser();
    c.apasa({ ...D, x: 800, y: 500 });
    c.activ.delete(31);
    let aruncat = null;
    try { for (const id of [...c.controale._pointers]) c.controale._onPointerUp({ pointerId: id }); } catch (e) { aruncat = e; }
    const blocat = c.controale.state !== STARE.NIMIC && c.sfarsit === 0;
    c.dispose();
    proba(bun && aruncat?.name === 'NotFoundError' && blocat,
      `un deget care nu mai e activ, apoi \`blur\`: starea ${STARE.NIMIC}, un \`end\`, nimic aruncat `
      + `(control, prin \`_onPointerUp\`: ${aruncat?.name}, gestul rămâne deschis — pică)`);
  }
}

// ------------------------------------------------------------ 10. pagina mărită

console.log('\nPagina mărită cu degetele: harta dă degetele înapoi paginii, până la micșorare');
{
  // Un visualViewport fals, care își ține ascultătorii, și un canvas cât le trebuie
  // controalelor. Scara se pune ÎNAINTE de creare: pagina poate porni mărită.
  const vvFals = (scale) => {
    const asc = new Set();
    return {
      scale, get ascultatori() { return asc.size; },
      addEventListener: (tip, f) => { if (tip === 'resize') asc.add(f); },
      removeEventListener: (tip, f) => { if (tip === 'resize') asc.delete(f); },
      redimensioneaza(s) { this.scale = s; for (const f of asc) f(); },
    };
  };
  const canvasFals = () => {
    const doc = new EventTarget();
    return Object.assign(new EventTarget(), {
      style: { removeProperty() {} }, ownerDocument: doc, getRootNode: () => doc,
      getBoundingClientRect: () => RECT, clientWidth: W, clientHeight: H,
      setPointerCapture() {}, releasePointerCapture() {},
    });
  };
  // Ca scena.js: camera, apoi urmărirea. `fara` dă codul de dinainte, fără urmărire.
  const porneste = (vv, urmareste = urmaresteMarireaPaginii) => {
    const el = canvasFals();
    const { controale } = creeazaCamera(el);
    const scoate = urmareste ? urmareste(controale, vv) : () => {};
    let start = 0;
    controale.addEventListener('start', () => start++);
    const apasa = () => {
      el.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1, pointerType: 'touch', button: 0, buttons: 1, clientX: 800, clientY: 450, pageX: 800, pageY: 450 }));
      const r = { start, stare: controale.state };
      el.ownerDocument.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, pointerType: 'touch', button: 0, buttons: 0, clientX: 800, clientY: 450, pageX: 800, pageY: 450 }));
      return r;
    };
    const citeste = () => ({ ta: el.style.touchAction, enabled: controale.enabled });
    return { el, controale, apasa, citeste, dispose() { scoate(); controale.dispose(); } };
  };
  const scrie = (s) => `touch-action „${s.ta}”, controalele ${s.enabled ? 'pornite' : 'oprite'}`;

  // 1. Pornită mărită, fără niciun `resize`.
  {
    const vv = vvFals(2), p = porneste(vv);
    const s = p.citeste(), a = p.apasa();
    proba(s.ta === 'manipulation' && s.enabled === false && a.start === 0 && a.stare === STARE.NIMIC,
      `pornită la scara 2, fără niciun resize: ${scrie(s)}; o atingere pe hartă pornește ${a.start} gesturi`);
    p.dispose();
    // Controale: codul de dinainte, fără urmărire; urmărirea fără citirea de la creare.
    const v = porneste(vvFals(2), null), sv = v.citeste();
    v.dispose();
    const numaiResize = (controale, vvx) => {
      const aplica = () => { const m = vvx.scale > 1.01; controale.domElement.style.touchAction = m ? 'manipulation' : 'none'; controale.enabled = !m; };
      vvx.addEventListener('resize', aplica);
      return () => vvx.removeEventListener('resize', aplica);
    };
    const r = porneste(vvFals(2), numaiResize), sr = r.citeste();
    r.dispose();
    proba(sv.ta === 'none' && sv.enabled && sr.ta === 'none' && sr.enabled,
      `control: codul de dinainte dă ${scrie(sv)}; urmărirea numai la resize, ${scrie(sr)} — pică`);
  }

  // 2. Pornită la scara 1, mărită, apoi micșorată la loc; apoi eliberarea.
  {
    const vv = vvFals(1), p = porneste(vv);
    const s1 = p.citeste(), a1 = p.apasa();
    vv.redimensioneaza(2);
    const s2 = p.citeste(), a2 = p.apasa();
    vv.redimensioneaza(1.005);
    const s3 = p.citeste(), a3 = p.apasa();
    proba(s1.ta === 'none' && s1.enabled && a1.start === 1 && a1.stare === STARE.DEGET_MUTARE,
      `la scara 1: ${scrie(s1)}; o atingere mută harta (starea ${a1.stare})`);
    proba(s2.ta === 'manipulation' && !s2.enabled && a2.start === 1 && a2.stare === STARE.NIMIC,
      `mărită la 2: ${scrie(s2)}; o atingere nu mai pornește nimic`);
    proba(s3.ta === 'none' && s3.enabled && a3.start === 2 && a3.stare === STARE.DEGET_MUTARE,
      `micșorată la 1,005, sub prag: ${scrie(s3)}; o atingere mută din nou harta`);
    const inainte = vv.ascultatori;
    p.dispose();
    proba(inainte === 1 && vv.ascultatori === 0, `ascultători pe visualViewport: ${inainte} cât trăiește scena, ${vv.ascultatori} după eliberare`);
  }

  // 3. Fără visualViewport — un browser vechi —, harta rămâne cum era.
  {
    const p = porneste(undefined), s = p.citeste();
    p.dispose();
    proba(s.ta === 'none' && s.enabled, `fără visualViewport: ${scrie(s)}`);
  }

  // 4. Scena o cheamă după creeazaCamera și o eliberează prin aceeași listă.
  const sursa = readFileSync('src/scene/scena.js', 'utf8');
  const iCam = sursa.indexOf('creeazaCamera(canvas)'), iUrm = sursa.indexOf('deEliberat.push(urmaresteMarireaPaginii(controale))');
  proba(iCam > 0 && iUrm > iCam, `scena.js: \`deEliberat.push(urmaresteMarireaPaginii(controale))\` după \`creeazaCamera\` (${iUrm > iCam ? 'da' : 'nu'})`);
}

// ------------------------------------------------------------ 11. tastatura

console.log('\nTastatura, ca o dronă: săgețile și W A S D mută, Q și E rotesc, Shift urcă, Ctrl coboară, plus și minus apropie; tastele rămân ale câmpurilor și panourilor');
// Un document și un canvas cât le trebuie tastaturii (tastatura.js) și controalelor: elemente
// care își țin atributele și răspund la `closest()` după selectorii pe care îi „poartă”, un
// document care își ține ascultătorii și îi cheamă cu evenimente simple, cu `target` ales.
const elementFals = (potriviri = []) => ({
  potriviri, atribute: {}, scos: false,
  getAttribute(k) { return this.atribute[k] ?? null; }, setAttribute(k, v) { this.atribute[k] = String(v); }, removeAttribute(k) { delete this.atribute[k]; },
  closest(sel) { return sel.split(',').map((s) => s.trim()).some((s) => this.potriviri.includes(s)) ? this : null; },
  remove() { this.scos = true; },
});
const documentFals = () => {
  const asc = new Map();
  return {
    body: elementFals(), documentElement: elementFals(), activeElement: null, visibilityState: 'visible',
    createElement: () => elementFals(),
    addEventListener(t, f) { (asc.get(t) ?? asc.set(t, new Set()).get(t)).add(f); },
    removeEventListener(t, f) { asc.get(t)?.delete(f); },
    emit(t, e) { for (const f of [...(asc.get(t) ?? [])]) f(e); },
    numara(t) { return asc.get(t)?.size ?? 0; },
  };
};
// `key` pentru fiecare `code` folosit aici; restul au `key` egal cu `code` ('ArrowUp', '+', 'Home').
const KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', KeyF: 'f', Tab: 'Tab',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', ControlRight: 'Control', Equal: '=', Minus: '-' };
const ASCULTATE = ['keydown', 'keyup', 'pointerdown', 'wheel', 'visibilitychange'];
/**
 * Camera și controalele paginii pe un canvas fals de W × h, cu limita lui alpha ca în scena.js,
 * și tastatura legată de ele. `M`: modulul camerei (camera.js de azi, de la REPER_VECHI sau
 * mutat); `T`: modulul tastaturii, sau null — la REPER_VECHI nu exista; `asculta`: în loc de
 * tastatură, `listenToKeyEvents` al lui OrbitControls, reparația simplă din constatare.
 */
const pagina2 = ({ h = H, faraMiscare = false, M = { creeazaCamera }, T = { creeazaTastatura }, asculta = false } = {}) => {
  const doc = documentFals();
  const rect = { left: 0, top: 0, width: W, height: h };
  const el = Object.assign(new EventTarget(), elementFals(), {
    style: { removeProperty() {} }, ownerDocument: new EventTarget(), getRootNode: () => doc,
    getBoundingClientRect: () => rect, clientWidth: W, clientHeight: h,
    setPointerCapture() {}, releasePointerCapture() {},
    dupa: [], after(...n) { this.dupa.push(...n); },
  });
  const { camera, controale } = M.creeazaCamera(el);
  camera.aspect = W / h;
  camera.updateProjectionMatrix();
  controale.seteazaTeren(TEREN);
  controale.enableDamping = !faraMiscare;
  if (asculta) controale.listenToKeyEvents(el);
  const tine = () => { const t = controale.target, x = t.x, z = t.z; alpha.limiteaza(t, camera); controale.mutaApucarea(t.x - x, t.z - z); };
  controale.addEventListener('change', tine);
  const inainte = Object.fromEntries(ASCULTATE.map((t) => [t, doc.numara(t)]));
  let acasa = 0;
  const tast = T ? T.creeazaTastatura({ canvas: el, controale, acasa: () => acasa++, doc }) : null;
  // Comenzile date controalelor, în ordine: câte pași a făcut fiecare tastă.
  const comenzi = [];
  if (controale.comanda) { const c = controale.comanda.bind(controale); controale.comanda = (n) => { comenzi.push(n); return c(n); }; }
  const b = {
    doc, el, rect, camera, controale, tast, inainte, comenzi,
    get acasa() { return acasa; },
    /** O apăsare de tastă, cu ținta ei — canvasul, dacă nu se spune altfel —, ridicată pe loc dacă nu e `tine`. */
    apasa(cod, { target = el, tine = false, ...o } = {}) {
      const e = { type: 'keydown', key: KEY[cod] ?? cod, code: cod, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
        isComposing: false, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...o };
      doc.emit('keydown', e);
      if (asculta && target === el) controale._onKeyDown(e);
      if (!tine) b.ridica(cod);
      return e;
    },
    ridica(cod) { doc.emit('keyup', { type: 'keyup', key: KEY[cod] ?? cod, code: cod }); },
    apasaPe(target) { doc.emit('pointerdown', { target }); },
    /** n cadre ale buclei, ca în scena.js: tastele ținute, treptele rotiței, urcarea, amortizarea, limita lui alpha. */
    cadre(n = 400, laFiecare = null) {
      for (let k = 0; k < n; k++) {
        ceas += 1000 / 60;
        tast?.pas();
        if (controale.rotita.pas() && !controale.enableDamping) controale.update();
        controale.pasVertical?.();
        controale.update();
        tine();
        laFiecare?.();
      }
    },
    centru: () => [W / 2, h / 2],
    dispose() { tast?.dispose(); controale.dispose(); },
  };
  return b;
};
const GRADE = 180 / Math.PI;
const CameraVeche = await modulDin(textVechi('src/scene/camera.js'));
const TASTATURA_JS = textSursa('src/scene/tastatura.js'), CAMERA_JS = textSursa('src/scene/camera.js');
/** Ce se vede pe raza privirii, de la cameră: distanța până la el, sau null. */
const vazutInFata = (camera, controale) => {
  const u = controale.target.clone().sub(camera.position).normalize();
  return punctVazut(new THREE.Ray(camera.position.clone(), u), TEREN, 8000);
};
/**
 * Cât stă camera peste ce e sub ea — relief, mare sau acoperiș —, pe discul pe care îl ocupă
 * planul apropiat al camerei date: raza colțurilor lui, cu 10% marjă; centrul, 16 puncte pe
 * cerc și 16 la jumătatea razei. E definiția din camera.js, scrisă aici din nou; cu 64 de puncte
 * relieful dintre ele iese cu până la 0,8 m mai sus. Ce vede camera de fapt măsoară proba
 * trunchiului, mai jos.
 */
const pesteSol = (p, camera) => {
  const tv = Math.tan((camera.fov * Math.PI) / 360);
  const R = 1.1 * camera.near * Math.sqrt(1 + tv * tv * (1 + camera.aspect * camera.aspect));
  let sol = COTA_MARE;
  const jos = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  for (let k = -1; k < 32; k++) {
    const a = (k * Math.PI) / 8, q = k < 0 ? 0 : k < 16 ? R : R / 2;
    const x = p.x + q * Math.cos(a), z = p.z + q * Math.sin(a);
    sol = Math.max(sol, inaltimeRandata(x, z));
    jos.origin.set(x, p.y, z);
    const c = TEREN.loveste(jos);
    if (c && c.t > 0) sol = Math.max(sol, p.y - c.t);
  }
  return p.y - sol;
};
const directie = (camera, controale) => controale.target.clone().sub(camera.position).normalize();
{
  // Canvasul devine elementul hărții: Tab, nume, descrierea tastelor, inelul; dispose() le scoate.
  const b = pagina2();
  const a = { ...b.el.atribute }, desc = b.el.dupa.find((n) => n.id === a['aria-describedby']), inel = b.el.dupa.find((n) => n.className === 'inel-harta');
  b.tast.dispose();
  const scoase = Object.keys(b.el.atribute).length === 0 && desc?.scos && inel?.scos && ASCULTATE.every((t) => b.doc.numara(t) === b.inainte[t]);
  b.controale.dispose();
  proba(a.tabindex === '0' && a.role === 'application' && a['aria-roledescription'] === 'hartă' && /Cabo Espichel/.test(a['aria-label'] ?? '')
    && desc?.textContent === DESCRIERE_TASTE && /W, A, S, D/.test(DESCRIERE_TASTE) && /Shift urcă, Ctrl coboară/.test(DESCRIERE_TASTE)
    && inel?.atribute['aria-hidden'] === 'true' && scoase,
  `canvasul: tabindex ${a.tabindex}, role ${a.role}, „${a['aria-label']}”, descrierea „${desc?.textContent}”, inelul ${inel ? 'pus' : 'LIPSĂ'}; `
    + `după dispose(): ${scoase ? 'atributele, inelul, descrierea și ascultătorii scoși' : 'RĂMAS CEVA'}`);
  const idx = textVechi('index.html'), sv = textVechi('src/scene/scena.js');
  const vechi = idx === null || sv === null ? null : /<canvas[^>]*tabindex/i.test(idx) || /tabindex|tabIndex/.test(sv);
  proba(vechi === false, `control, la ${REPER_VECHI}: ${vechi === null ? 'NECITIT' : vechi ? 'canvasul avea tabindex' : 'canvasul fără tabindex în index.html și în scena.js, deci Tab nu ajunge pe hartă'} — pică`);
}
{
  // Mutarea: ↑ și W înainte, pe direcția privirii, → și D la dreapta, cu PAS_MUTARE din
  // înălțimea vederii la distanța țintei; camera merge cu ținta, deci orientarea rămâne. Cu
  // amortizare și sub reduced-motion (pe loc, 0 cadre).
  const rez = [];
  for (const faraMiscare of [false, true]) {
    for (const [tasta, axa] of [['ArrowUp', 'fata'], ['KeyW', 'fata'], ['ArrowRight', 'dreapta'], ['KeyD', 'dreapta'],
      ['ArrowDown', 'spate'], ['KeyS', 'spate'], ['ArrowLeft', 'stanga'], ['KeyA', 'stanga']]) {
      const b = pagina2({ faraMiscare });
      const r = b.camera.position.distanceTo(b.controale.target);
      const pas = 2 * PAS_MUTARE * r * Math.tan((b.camera.fov / 2) * Math.PI / 180);
      const fata = b.controale.target.clone().sub(b.camera.position).setY(0).normalize();
      const dreapta = new THREE.Vector3().crossVectors(fata, new THREE.Vector3(0, 1, 0));
      const dir = { fata, dreapta, spate: fata.clone().negate(), stanga: dreapta.clone().negate() }[axa];
      const t0 = b.controale.target.clone(), c0 = b.camera.position.clone();
      const e = b.apasa(tasta);
      if (!faraMiscare) b.cadre(400);
      const dT = b.controale.target.clone().sub(t0), dC = b.camera.position.clone().sub(c0);
      rez.push({ eroare: dT.clone().sub(dir.clone().multiplyScalar(pas)).length() / pas, laolalta: dT.distanceTo(dC), prevenit: e.defaultPrevented, pas });
      b.dispose();
    }
  }
  const maxE = Math.max(...rez.map((x) => x.eroare)), maxL = Math.max(...rez.map((x) => x.laolalta));
  proba(maxE < 1e-6 && maxL < 1e-9 && rez.every((x) => x.prevenit),
    `săgețile și W A S D, cu amortizare și pe loc: ținta se mută cu ${rez[0].pas.toFixed(2)} m (5% din înălțimea vederii la ${(rez[0].pas / (0.1 * Math.tan(Math.PI / 8))).toFixed(1)} m), `
    + `pe direcția cerută cu eroarea ${maxE.toExponential(1)}, camera cu ea la ${maxL.toExponential(1)} m; pagina nu defilează (preventDefault)`);
}
{
  // „+” și „−”: o treaptă de rotiță spre centrul vederii; punctul văzut acolo rămâne pe pixel.
  // Și cu decalajul fișei laterale, unde centrul vederii e al părții libere.
  const rez = [];
  for (const faraMiscare of [false, true]) for (const decalaj of [false, true]) {
    const b = pagina2({ faraMiscare });
    if (decalaj) b.camera.setViewOffset(W, H, 0.2 * W, 0, W, H);
    const c = b.controale.centruVederii();
    const P = subCursor(b.camera, b.controale, c.x, c.y), d0 = b.camera.position.distanceTo(P);
    b.apasa('+');
    if (!faraMiscare) b.cadre(400);
    const d1 = b.camera.position.distanceTo(P), [px, py] = proiect(b.camera, P);
    b.apasa('-');
    if (!faraMiscare) b.cadre(400);
    const d2 = b.camera.position.distanceTo(P);
    rez.push({ apropiat: d0 / d1, departat: d2 / d1, px: Math.hypot(px - c.x, py - c.y), c, tinta: d0 / b.camera.position.distanceTo(b.controale.target) });
    b.dispose();
  }
  const ok = rez.every((x) => Math.abs(x.apropiat / FACTOR_TREAPTA - 1) < 0.01 && Math.abs(x.departat / FACTOR_TREAPTA - 1) < 0.01 && x.px < 1e-6);
  proba(ok, `„+”: distanța cameră–punctul din centru scade de ${rez.map((x) => x.apropiat.toFixed(6)).join(' / ')} ori, „−” o crește de `
    + `${rez.map((x) => x.departat.toFixed(6)).join(' / ')} ori (cu amortizare, cu decalajul fișei, pe loc, pe loc cu decalaj), `
    + `punctul la cel mult ${Math.max(...rez.map((x) => x.px)).toExponential(1)} px de centrul vederii (${rez[1].c.x.toFixed(1)}, ${rez[1].c.y.toFixed(1)} cu fișa)`);
  // Celelalte forme: „=”, „_” (Shift + −) și plusul și minusul tastaturii numerice, pe loc.
  const forme = [['Equal', { key: '=' }, 'apropie'], ['Equal', { key: '+', shiftKey: true }, 'apropie'], ['Minus', { key: '_', shiftKey: true }, 'departeaza'],
    ['NumpadAdd', { key: '+' }, 'apropie'], ['NumpadSubtract', { key: '-' }, 'departeaza']].map(([cod, o, asteptat]) => {
    const b = pagina2({ faraMiscare: true });
    b.apasa(cod, o);
    const r = b.comenzi.join();
    b.dispose();
    return { cod: `${cod}/${o.key}`, ok: r === asteptat, r };
  });
  proba(forme.every((f) => f.ok), `celelalte forme: ${forme.map((f) => `${f.cod} → ${f.r || 'nimic'}`).join(', ')}`);
  // Control: la REPER_VECHI nu exista tastatura; cu `listenToKeyEvents`, „=” nu face nimic.
  const z = [];
  for (const asculta of [false, true]) {
    const b = CameraVeche ? pagina2({ M: CameraVeche, T: null, asculta }) : null;
    if (!b) { z.push(null); continue; }
    const P = subCursor(b.camera, b.controale, W / 2, H / 2), d0 = b.camera.position.distanceTo(P);
    b.apasa('+'); b.apasa('=');
    b.cadre(400);
    z.push(d0 / b.camera.position.distanceTo(P));
    b.dispose();
  }
  proba(z.every((x) => x !== null && Math.abs(x - 1) < 1e-9), `control, camera.js de la ${REPER_VECHI}: „+” și „=” lasă distanța de ${z.map((x) => x?.toFixed(6) ?? 'NECITIT').join(' / ')} ori (fără tastatură / cu listenToKeyEvents) — pică`);
}
{
  // Q și E: 15° pe apăsare, oricât de înalt e ecranul, cu amortizare și pe loc. E crește
  // citirea busolei (theta scade), Q o scade. Shift + → nu mai rotește: mută, ca →.
  const rot = (o, tasta, h, extra = {}) => {
    const b = pagina2({ h, ...o });
    const s0 = new THREE.Spherical().setFromVector3(b.camera.position.clone().sub(b.controale.target));
    b.apasa(tasta, extra);
    b.cadre(600);
    const s1 = new THREE.Spherical().setFromVector3(b.camera.position.clone().sub(b.controale.target));
    b.dispose();
    return { theta: (s1.theta - s0.theta) * GRADE, phi: (s1.phi - s0.phi) * GRADE };
  };
  const r = [];
  for (const h of [900, 700]) for (const faraMiscare of [false, true]) {
    r.push({ h, faraMiscare, e: rot({ faraMiscare }, 'KeyE', h).theta, q: rot({ faraMiscare }, 'KeyQ', h).theta,
      shift: rot({ faraMiscare }, 'ArrowRight', h, { shiftKey: true }) });
  }
  proba(r.every((x) => Math.abs(x.e + 15) < 0.5 && Math.abs(x.q - 15) < 0.5 && Math.abs(x.shift.theta) < 1e-6 && Math.abs(x.shift.phi) < 1e-6),
    `E / Q, la înălțimea 900 și 700, cu amortizare și pe loc: theta ${r.map((x) => x.e.toFixed(4)).join(', ')} / ${r.map((x) => x.q.toFixed(4)).join(', ')}°; `
    + `Shift + → nu rotește (cel mult ${Math.max(...r.map((x) => Math.abs(x.shift.theta))).toExponential(1)}°)`);
  const v = [];
  for (const h of [900, 700]) for (const asculta of [false, true]) v.push(CameraVeche ? rot({ M: CameraVeche, T: null, asculta }, 'KeyE', h).theta : null);
  proba(v.every((x) => x !== null && Math.abs(Math.abs(x) - 15) > 0.5),
    `control, camera.js de la ${REPER_VECHI}, E la 900 și la 700: ${v.map((x) => (x === null ? 'NECITIT' : `${x.toFixed(3)}°`)).join(', ')} (fără tastatură, cu listenToKeyEvents) — pică`);
}
{
  // Pivotul: înaintea rotirii ținta coboară pe ce se vede. După șase clicuri de rotiță spre
  // platou ținta stă sub relief; șase apăsări pe E țin punctul din centrul ecranului pe loc.
  const pivot = (M) => {
    const b = pagina2(M ? { M } : {});
    for (let i = 0; i < 6; i++) { clic(b.controale, 800, 290); b.cadre(60); }
    const tintaSub = b.controale.target.y - inaltimeRandata(b.controale.target.x, b.controale.target.z);
    const P = subCursor(b.camera, b.controale, W / 2, H / 2);
    let minPeste = Infinity;
    for (let i = 0; i < 6; i++) {
      b.apasa('KeyE');
      for (let k = 0; k < 120; k++) { b.cadre(1); minPeste = Math.min(minPeste, b.camera.position.y - inaltimeRandata(b.camera.position.x, b.camera.position.z)); }
    }
    const [px, py] = proiect(b.camera, P);
    b.dispose();
    return { tintaSub, px: Math.hypot(px - W / 2, py - H / 2), minPeste };
  };
  const p = pivot(null);
  const fara = await modulDin(muta(CAMERA_JS,
    ["case 'roteste-dreapta': pas = () => { this.pivotPeTeren(); this._rotateLeft(UNGHI_PAS);", "case 'roteste-dreapta': pas = () => { this._rotateLeft(UNGHI_PAS);"]));
  const pf = fara ? pivot(fara) : null;
  proba(p.tintaSub < 0 && p.px < 0.5, `6 clicuri spre platou (ținta la ${p.tintaSub.toFixed(2)} m față de relief), apoi 6 × E: punctul din centru la `
    + `${p.px.toExponential(1)} px, camera cu cel puțin ${p.minPeste.toFixed(2)} m peste relief`);
  proba(pf !== null && pf.px > 50, `control, fără pivotul pe teren: ${pf === null ? NEAPLICATA : `punctul fuge la ${pf.px.toFixed(1)} px, camera coboară la ${pf.minPeste.toFixed(2)} m peste relief`} — pică`);
}
{
  // Ritmul rotiței: un clic de 40 px la mărirea de 250%, venit la 100 ms după „+”, e tot o
  // treaptă întreagă — „+” nu trece prin `adauga`. Control: „+” ca rotiță falsă de 100 px.
  const DPR = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  globalThis.devicePixelRatio = 2.5;
  const ritm = (fals) => {
    const b = pagina2();
    const P = subCursor(b.camera, b.controale, W / 2, H / 2), d0 = b.camera.position.distanceTo(P);
    if (fals) b.controale.rotita.adauga({ clientX: W / 2, clientY: H / 2, deltaY: -100, deltaMode: 0 }, b.rect);
    else b.apasa('+');
    b.cadre(6);   // 100 ms
    clic(b.controale, W / 2, H / 2, -40);
    b.cadre(600);
    const trepte = Math.log(d0 / b.camera.position.distanceTo(P)) / LN;
    b.dispose();
    return trepte;
  };
  const bun = ritm(false), rau = ritm(true);
  if (DPR) Object.defineProperty(globalThis, 'devicePixelRatio', DPR); else delete globalThis.devicePixelRatio;
  // Rotița își caută din nou punctul de sub cursor (22 de bisecții), deci 2 la ~10⁻⁹, nu la bit.
  proba(Math.abs(bun - 2) < 1e-6, `„+”, apoi la 100 ms un clic de rotiță de 40 px la DPR 2,5: ${bun.toFixed(9)} trepte (cerut 2)`);
  proba(Math.abs(rau - 2) > 0.1, `control, „+” trimis ca rotiță falsă de 100 px prin \`adauga\`: ${rau.toFixed(4)} trepte — clicul de după iese touchpad — pică`);
}
{
  // Unde: tastele rămân ale câmpurilor, fișei, panoului, capitolelor și modalei, iar un buton
  // își păstrează săgețile; pe hartă (focus pe canvas, sau pe <body> după o apăsare pe hartă ori
  // înaintea oricărei apăsări) mută. Alt și Cmd rămân ale browserului; cu Ctrl, mutarea merge
  // mai departe, dar plusul rămâne al paginii.
  const locuri = (Tmod) => {
    const r = {};
    const caz = (nume, pregateste, tasta = 'ArrowUp', o = {}) => {
      const b = pagina2({ T: Tmod });
      const tinta = pregateste(b);
      const c0 = b.camera.position.clone();
      const e = b.apasa(tasta, { target: tinta, ...o });
      b.cadre(400);
      r[nume] = { mutat: b.camera.position.distanceTo(c0), prevenit: e.defaultPrevented };
      b.dispose();
    };
    const pe = (sel) => () => elementFals([sel]);
    caz('câmp', pe('input'));
    caz('câmp, W', pe('input'), 'KeyW');
    caz('fișă', pe('#sanctuar-fisa'));
    caz('panoul deschis', pe('#punct .cutie'));
    caz('capitole', pe('#continut'));
    caz('modală', pe('dialog[open]'));
    caz('buton', () => elementFals());
    caz('<body> după un clic în fișă', (b) => { b.apasaPe(elementFals(['#sanctuar-fisa'])); return b.doc.body; });
    caz('<body> după un clic pe un buton', (b) => { b.apasaPe(elementFals()); return b.doc.body; });
    caz('Ctrl + „+” pe hartă', (b) => b.el, '+', { ctrlKey: true });
    caz('Alt + ← pe hartă', (b) => b.el, 'ArrowLeft', { altKey: true });
    caz('Cmd + W pe hartă', (b) => b.el, 'KeyW', { metaKey: true });
    caz('pagina mărită', (b) => { b.controale.enabled = false; return b.el; });
    caz('canvas', (b) => b.el);
    caz('canvas, W', (b) => b.el, 'KeyW');
    caz('Ctrl + ↑ pe hartă', (b) => b.el, 'ArrowUp', { ctrlKey: true });
    caz('Shift + W pe hartă', (b) => b.el, 'KeyW', { shiftKey: true });
    caz('<body>, înaintea oricărei apăsări', (b) => b.doc.body);
    caz('<body> după un clic pe hartă', (b) => { b.apasaPe(b.el); return b.doc.body; });
    return r;
  };
  const MUTA = ['canvas', 'canvas, W', 'Ctrl + ↑ pe hartă', 'Shift + W pe hartă', '<body>, înaintea oricărei apăsări', '<body> după un clic pe hartă'];
  // Sub 10⁻⁹ m e rotunjirea amortizării pe vederea de pornire, cu sau fără tastă.
  const bun = (r) => Object.entries(r).every(([k, x]) => (MUTA.includes(k) ? x.mutat > 1 && x.prevenit : x.mutat < 1e-9 && !x.prevenit));
  const r = locuri({ creeazaTastatura });
  const maxNu = Math.max(...Object.entries(r).filter(([k]) => !MUTA.includes(k)).map(([, x]) => x.mutat));
  proba(bun(r), `nu mută (cel mult ${maxNu.toExponential(1)} m) și nu opresc tasta: ${Object.entries(r).filter(([k]) => !MUTA.includes(k)).map(([k, x]) => `${k}${x.mutat >= 1e-9 ? ` ${x.mutat.toFixed(1)} m` : ''}${x.prevenit ? ' (OPRITĂ)' : ''}`).join(', ')}; `
    + `mută: ${MUTA.map((k) => `${k} ${r[k].mutat.toFixed(1)} m`).join(', ')}`);
  const faraLoc = await modulDin(muta(TASTATURA_JS,
    ['    if (unde?.closest?.(UNDE_NU)) return;\n', ''], ['if (!nume || !peHarta(e.target) || !controale.enabled) return;', 'if (!nume || !controale.enabled) return;']));
  const rf = faraLoc ? locuri(faraLoc) : null;
  proba(rf !== null && !bun(rf), `control, fără locul tastei: ${rf === null ? NEAPLICATA : Object.entries(rf).filter(([k, x]) => !MUTA.includes(k) && x.mutat > 0).map(([k, x]) => `${k} ${x.mutat.toFixed(1)} m`).join(', ')} — pică`);
}
{
  // Home: de oriunde în afara locurilor lui, o dată la o apăsare ținută, nu cu Shift sau Ctrl.
  const b = pagina2();
  b.apasa('Home');
  b.apasa('Home', { repeat: true });
  b.apasa('Home', { shiftKey: true });
  b.apasa('Home', { ctrlKey: true });
  b.apasa('Home', { target: elementFals(['input']) });
  b.apasa('Home', { target: elementFals() });
  b.apasaPe(elementFals(['#sanctuar-fisa']));
  const e = b.apasa('Home', { target: b.doc.body });
  const n = b.acasa;
  b.dispose();
  proba(n === 2 && !e.defaultPrevented, `Home: pe hartă și pe un buton, acasă (${n} din 2); repetat, cu Shift, cu Ctrl, într-un câmp sau pe <body> după un clic în fișă, nu`);
}
{
  // O tastă ținută: un pas la apăsare, apoi câte unul la INTERVAL_REPETARE ms, numărați de
  // buclă. W ținut o secundă: 7 pași, cu sau fără repetările sistemului (la 33 ms), iar după
  // ridicare niciunul. Control: fără ceasul buclei, ținută, tasta face un singur pas — ca pe
  // macOS, unde Shift și Ctrl nu se repetă deloc.
  const tinuta = (Tmod, repetari) => {
    const b = pagina2({ T: Tmod });
    const r = b.camera.position.distanceTo(b.controale.target);
    const pas = 2 * PAS_MUTARE * r * Math.tan((b.camera.fov / 2) * Math.PI / 180);
    const t0 = b.controale.target.clone();
    b.apasa('KeyW', { tine: true });
    for (let i = 0; i < 30; i++) { b.cadre(2); if (repetari) b.apasa('KeyW', { tine: true, repeat: true }); }
    const n1 = b.comenzi.length;
    b.ridica('KeyW');
    b.cadre(600);
    const n2 = b.comenzi.length, mers = b.controale.target.distanceTo(t0) / pas;
    b.dispose();
    return { n1, dupa: n2 - n1, mers };
  };
  const a = tinuta({ creeazaTastatura }, false), c = tinuta({ creeazaTastatura }, true);
  proba(a.n1 === 7 && c.n1 === 7 && a.dupa === 0 && c.dupa === 0 && Math.abs(a.mers - 7) < 1e-6,
    `W ținut o secundă: ${a.n1} pași (${c.n1} cu repetările sistemului la 33 ms), ${a.dupa} după ridicare; ținta merge ${a.mers.toFixed(6)} pași`);
  const fara = await modulDin(muta(TASTATURA_JS, ['        pasul(h.nume);\n', '']));
  const f = fara ? tinuta(fara, false) : null;
  proba(f !== null && f.n1 !== 7, `control, fără ceasul buclei: ${f === null ? NEAPLICATA : `${f.n1} pas într-o secundă`} — pică`);
}
{
  // Tastele ținute se opresc fără ridicare: `blur` pe fereastră (Alt + Tab), fila ascunsă,
  // focusul plecat de pe hartă (pe un buton), pagina mărită. Câți pași mai vin în secunda de
  // după. Fereastra e un EventTarget pus pe globalThis cât ține proba.
  const F0 = { a: globalThis.addEventListener, r: globalThis.removeEventListener };
  const fereastra = new EventTarget();
  globalThis.addEventListener = fereastra.addEventListener.bind(fereastra);
  globalThis.removeEventListener = fereastra.removeEventListener.bind(fereastra);
  const opreste = (Tmod) => {
    const r = {};
    for (const [nume, f] of [['blur', () => { fereastra.dispatchEvent(new Event('blur')); }],
      ['fila ascunsă', (b) => { b.doc.visibilityState = 'hidden'; b.doc.emit('visibilitychange', {}); }],
      ['focusul pe un buton', (b) => { b.doc.activeElement = elementFals(); }],
      ['pagina mărită', (b) => { b.controale.enabled = false; }]]) {
      const b = pagina2({ T: Tmod });
      b.apasa('KeyW', { tine: true });
      b.cadre(20);
      const n = b.comenzi.length;
      f(b);
      b.cadre(1);
      b.controale.enabled = true; b.doc.activeElement = null; b.doc.visibilityState = 'visible';
      b.cadre(60);
      r[nume] = b.comenzi.length - n;
      b.dispose();
    }
    return r;
  };
  const z = opreste({ creeazaTastatura });
  proba(Object.values(z).every((n) => n === 0), `W ținut, apoi: ${Object.entries(z).map(([k, n]) => `${k} → ${n} pași`).join(', ')}`);
  const fara = await modulDin(muta(TASTATURA_JS, ['      if (!controale.enabled || !peHarta(doc.activeElement)) { golesteTot(); return; }\n', ''],
    ["  const laAscundere = () => { if (doc.visibilityState === 'hidden') golesteTot(); };", '  const laAscundere = () => {};']));
  const zf = fara ? opreste(fara) : null;
  proba(zf !== null && Object.values(zf).some((n) => n > 0), `control, fără oprire: ${zf === null ? NEAPLICATA : Object.entries(zf).map(([k, n]) => `${k} → ${n} pași`).join(', ')} — pică`);
  const fb = await modulDin(muta(TASTATURA_JS, ["  globalThis.addEventListener?.('blur', golesteTot);\n", '']));
  const zb = fb ? opreste(fb) : null;
  proba(zb !== null && zb.blur > 0, `control, fără ascultătorul de \`blur\`: ${zb === null ? NEAPLICATA : `blur → ${zb.blur} pași`} — pică`);
  globalThis.addEventListener = F0.a; globalThis.removeEventListener = F0.r;
  if (F0.a === undefined) { delete globalThis.addEventListener; delete globalThis.removeEventListener; }
}
{
  // `start` și `end`, cu starea NIMIC, ca rotița: un zbor în curs se oprește la o tastă.
  const b = pagina2();
  let start = 0, sfarsit = 0, stare = null;
  b.controale.addEventListener('start', () => { start++; stare = b.controale.state; });
  b.controale.addEventListener('end', () => sfarsit++);
  const zbor = creeazaZbor({ camera: b.camera, controale: b.controale, cereRandare: () => {} });
  zbor.spre({ tinta: [300, 80, 300], distanta: 900, azimut: 120, elevatie: 30 });
  for (let i = 0; i < 5; i++) { ceas += 1000 / 60; zbor.pas(); }
  const inZbor = zbor.activ;
  b.apasa('ArrowUp');
  const oprit = !zbor.activ;
  zbor.dispose();
  b.dispose();
  proba(inZbor && oprit && start === 1 && sfarsit === 1 && stare === STARE.NIMIC,
    `o săgeată în timpul unui zbor: ${start} \`start\`, ${sfarsit} \`end\`, starea ${stare}; zborul ${oprit ? 'oprit' : 'TOT ACTIV'}`);
}

console.log('\nDrona: Shift urcă, Ctrl coboară, cu privirea neschimbată');
{
  // Shift ținut o secundă, de la vederea de pornire: camera urcă pe verticală — x și z,
  // direcția privirii rămân —, iar ținta trece pe ce se vede, în alpha. Primul pas vine abia
  // după GRATIE ms. Cu amortizare și pe loc. Control: ținta urcată odată cu camera (o
  // translație simplă) — limita alpha o oprește la cota cea mai înaltă a hărții.
  const urca = (o = {}) => {
    const b = pagina2(o);
    const c0 = b.camera.position.clone(), u0 = directie(b.camera, b.controale);
    b.apasa('ShiftLeft', { tine: true, shiftKey: true });
    b.cadre(12);   // 200 ms
    const laGratie = b.camera.position.y - c0.y;
    b.cadre(50);
    b.ridica('ShiftLeft');
    b.cadre(600);
    const c1 = b.camera.position, t = b.controale.target;
    const d = vazutInFata(b.camera, b.controale), r = c1.distanceTo(t);
    const rez = { laGratie, urcat: c1.y - c0.y, xz: Math.hypot(c1.x - c0.x, c1.z - c0.z), unghi: Math.acos(Math.min(1, directie(b.camera, b.controale).dot(u0))),
      tintaPeVazut: d === null ? Infinity : Math.abs(d - r), inAlpha: alpha.contine(t.x, t.z) && t.y >= alpha.yMin && t.y <= alpha.yMax, pasi: b.comenzi.filter((n) => n === 'urca').length };
    b.dispose();
    return rez;
  };
  const r = [urca(), urca({ faraMiscare: true })];
  proba(r.every((x) => Math.abs(x.laGratie) < 1e-9 && x.urcat > 150 && x.xz < 1e-9 && x.unghi < 1e-7 && x.tintaPeVazut < 1e-6 && x.inAlpha && x.pasi === 6),
    `Shift ținut o secundă: ${r.map((x) => `${x.pasi} pași, +${x.urcat.toFixed(1)} m`).join(' / ')} (cu amortizare / pe loc), nimic în primele 200 ms; `
    + `x și z la ${Math.max(...r.map((x) => x.xz)).toExponential(1)} m, privirea la ${Math.max(...r.map((x) => x.unghi)).toExponential(1)} rad, `
    + `ținta pe ce se vede la ${Math.max(...r.map((x) => x.tintaPeVazut)).toExponential(1)} m, în alpha`);
  const tr = await modulDin(muta(CAMERA_JS, ['    if (!t) {\n      C.y += dy;', '    if (true) {\n      C.y += dy;']));
  const rt = tr ? urca({ M: tr }) : null;
  proba(rt !== null && (rt.urcat < 150 || rt.tintaPeVazut > 1), `control, ținta urcată odată cu camera: ${rt === null ? NEAPLICATA : `+${rt.urcat.toFixed(1)} m, ținta la ${rt.tintaPeVazut.toFixed(1)} m de ce se vede`} — pică`);
}
{
  // Urcarea are un tavan: unde privirea nu mai găsește nimic în alpha la cel mult 8 km.
  // Shift ținut 20 s: camera se oprește, x și z rămân, ținta rămâne în alpha. Control: fără
  // intervalul lui alpha, ținta iese din cutie, iar limita mută camera pe orizontală.
  const tavan = (M) => {
    const b = pagina2(M ? { M } : {});
    const c0 = b.camera.position.clone();
    let xz = 0;
    b.apasa('ShiftLeft', { tine: true, shiftKey: true });
    b.cadre(1200, () => { xz = Math.max(xz, Math.hypot(b.camera.position.x - c0.x, b.camera.position.z - c0.z)); });
    const y1 = b.camera.position.y;
    b.cadre(120);
    const rez = { y: b.camera.position.y, oprit: Math.abs(b.camera.position.y - y1) < 1e-6, xz, r: b.camera.position.distanceTo(b.controale.target) };
    b.ridica('ShiftLeft');
    b.dispose();
    return rez;
  };
  const z = tavan(null);
  proba(z.oprit && z.xz < 1e-9 && z.r <= 8000, `Shift ținut 20 s de la vederea de pornire: camera se oprește la ${z.y.toFixed(1)} m, x și z la ${z.xz.toExponential(1)} m, ținta la ${z.r.toFixed(0)} m`);
  const fa = await modulDin(muta(CAMERA_JS, ['      if (t.alpha) {\n        const iv = t.alpha.intervalRaza(_q, _u);', '      if (false) {\n        const iv = t.alpha.intervalRaza(_q, _u);']));
  const zf = fa ? tavan(fa) : null;
  proba(zf !== null && zf.xz > 1, `control, fără intervalul lui alpha: ${zf === null ? NEAPLICATA : `camera mutată pe orizontală cu ${zf.xz.toFixed(1)} m`} — pică`);
}
{
  // Ctrl ținut 20 s, cu x, z și privirea neschimbate, din trei locuri:
  // - vederea de pornire, peste mare: până la cota mării a cutiei lui alpha, unde ținta nu mai
  //   are loc, cu ce se vede în față la 80 m;
  // - deasupra platoului, privind în jos la 45°: până ce se vede în față ajunge la 80 m (garda
  //   zoomului), cu mult peste LIBER_SOL;
  // - deasupra unei faleze, privind spre larg la 10° sub orizont: ce se vede e departe, deci
  //   oprește LIBER_SOL peste stâncă. Locul: marginea cea mai înaltă din alpha de unde privirea
  //   trece peste ea și cade la cel puțin 300 m.
  // Controale: fără garda celor 80 m, pe platou; fără garda solului, pe faleză.
  const peste = (b, P, u, r) => {
    b.camera.position.copy(P).addScaledVector(u, -r);
    b.controale.target.copy(P);
    b.controale.update();
    b.controale.pivotPeTeren();
    b.controale.update();
  };
  // Platoul: punctul cel mai înalt din alpha în jurul căruia relieful, pe 120 m, nu urcă
  // nicăieri cu mai mult de 10 m — privirea de 45° cade pe el.
  let platou = null;
  for (let x = -1040; x <= 1040; x += 40) for (let z = -1360; z <= 1360; z += 40) {
    const s0 = inaltimeRandata(x, z);
    if (platou && s0 <= platou.y) continue;
    let plat = true;
    for (let k = 0; k < 16 && plat; k++) for (const r of [40, 80, 120]) if (Math.abs(inaltimeRandata(x + r * Math.cos(k * Math.PI / 8), z + r * Math.sin(k * Math.PI / 8)) - s0) > 10) plat = false;
    if (plat) platou = new THREE.Vector3(x, s0, z);
  }
  let faleza = null;
  for (let x = -1140; x <= 1140; x += 20) for (let z = -1480; z <= 1480; z += 20) {
    const s0 = inaltimeRandata(x, z);
    if (!(s0 > 40) || (faleza && s0 <= faleza.s0)) continue;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, u = new THREE.Vector3(Math.sin(a) * Math.cos(10 / GRADE), -Math.sin(10 / GRADE), -Math.cos(a) * Math.cos(10 / GRADE));
      if (inaltimeRandata(x + u.x * 200, z + u.z * 200) > s0 - 30) continue;
      const o = new THREE.Vector3(x, s0 + LIBER_SOL, z), d = punctVazut(new THREE.Ray(o, u), TEREN, 8000);
      const iv = alpha.intervalRaza(o, u);
      if (d === null || d < 300 || !iv || Math.max(80, iv[0]) > Math.min(8000, iv[1])) continue;
      faleza = { x, z, s0, u };
      break;
    }
  }
  const LOCURI = {
    'pornire': () => {},
    'platou': (b) => peste(b, platou, new THREE.Vector3(0, -1, -1).normalize(), 350),
    'faleză': (b) => peste(b, new THREE.Vector3(faleza.x, faleza.s0 + 120, faleza.z).addScaledVector(faleza.u, 600), faleza.u, 600),
  };
  const coboara = (loc, M) => {
    const b = pagina2(M ? { M } : {});
    LOCURI[loc](b);
    const c0 = b.camera.position.clone(), u0 = directie(b.camera, b.controale);
    let minSol = Infinity;
    b.apasa('ControlLeft', { tine: true, ctrlKey: true });
    b.cadre(1200, () => { minSol = Math.min(minSol, pesteSol(b.camera.position, b.camera)); });
    b.ridica('ControlLeft');
    b.cadre(300);
    const c1 = b.camera.position;
    const rez = { y: c1.y, d: vazutInFata(b.camera, b.controale), sol: pesteSol(c1, b.camera), minSol, xz: Math.hypot(c1.x - c0.x, c1.z - c0.z),
      unghi: Math.acos(Math.min(1, directie(b.camera, b.controale).dot(u0))) };
    b.dispose();
    return rez;
  };
  const z = Object.fromEntries(Object.keys(LOCURI).map((k) => [k, coboara(k)]));
  const comun = Object.values(z).every((x) => x.minSol >= LIBER_SOL - 1e-6 && x.xz < 1e-9 && x.unghi < 1e-7 && x.d >= 80 - 1e-6);
  proba(comun && z.platou.d < 81 && z.platou.sol > LIBER_SOL + 10 && Math.abs(z['faleză'].sol - LIBER_SOL) < 0.5 && z['faleză'].d > 100,
    `Ctrl ținut 20 s: ${Object.entries(z).map(([k, x]) => `${k} — camera la ${x.y.toFixed(2)} m, ${x.sol.toFixed(2)} m peste sol, ce se vede în față la ${x.d.toFixed(1)} m`).join('; ')} `
    + `(platoul: (${platou.x}; ${platou.z}), ${platou.y.toFixed(1)} m; faleza: (${faleza.x}; ${faleza.z}), ${faleza.s0.toFixed(1)} m); x, z și privirea neschimbate, cel puțin ${Math.min(...Object.values(z).map((x) => x.minSol)).toFixed(2)} m peste sol`);
  const f80 = await modulDin(muta(CAMERA_JS, ['      if (d === null ? dy > 0 : dy < 0 && d < this.minDistance) return null;', '      if (d === null) return dy > 0 ? null : this.maxDistance;']));
  const fs = await modulDin(muta(CAMERA_JS, ['      if (y < sol) return null;\n', '']));
  const zp = f80 ? coboara('platou', f80) : null, zs = fs ? coboara('faleză', fs) : null;
  proba(zp !== null && zp.d < 79, `control, fără garda celor 80 m, pe platou: ${zp === null ? NEAPLICATA : `ce se vede în față la ${zp.d.toFixed(2)} m`} — pică`);
  proba(zs !== null && zs.minSol < LIBER_SOL - 1, `control, fără garda solului, pe faleză: ${zs === null ? NEAPLICATA : `camera la ${zs.minSol.toFixed(2)} m față de sol`} — pică`);
}
// Deasupra farului, cu privirea spre vest la 10° sub orizont: ce e sub cameră e lanterna.
const [xFar, zFar] = dateCladiri.cupole[0].centru;
const pesteFar = (b) => {
  const u = new THREE.Vector3(-Math.cos(10 / GRADE), -Math.sin(10 / GRADE), 0);
  b.camera.position.set(xFar, 380, zFar);
  b.controale.target.copy(b.camera.position).addScaledVector(u, 600);
  b.controale.update();
  b.controale.pivotPeTeren();
  b.controale.update();
};
const VARF_FAR = 380 - TEREN.loveste(new THREE.Ray(new THREE.Vector3(xFar, 380, zFar), new THREE.Vector3(0, -1, 0))).t;
{
  // Ctrl ținut 20 s deasupra farului: camera se oprește la LIBER_SOL peste lanternă, nu peste
  // teren. Control: fără clădirile de sub cameră, coboară până ce privirea atinge lanterna.
  const coboara = (M) => {
    const b = pagina2(M ? { M } : {});
    pesteFar(b);
    let minY = Infinity;
    b.apasa('ControlLeft', { tine: true, ctrlKey: true });
    b.cadre(1200, () => { minY = Math.min(minY, b.camera.position.y); });
    b.ridica('ControlLeft');
    b.cadre(300);
    const rez = { y: b.camera.position.y, minY };
    b.dispose();
    return rez;
  };
  const z = coboara(null);
  proba(z.minY >= VARF_FAR + LIBER_SOL - 1e-6 && z.y < VARF_FAR + LIBER_SOL + 0.5,
    `deasupra farului (vârful la ${VARF_FAR.toFixed(2)} m), Ctrl ținut 20 s: camera se oprește la ${z.y.toFixed(2)} m, cel mai jos ${z.minY.toFixed(2)} m`);
  const fc = await modulDin(muta(CAMERA_JS, ['      if (t.loveste) {\n        _jos.origin', '      if (false) {\n        _jos.origin']));
  const zc = fc ? coboara(fc) : null;
  proba(zc !== null && zc.minY < VARF_FAR + LIBER_SOL - 1, `control, fără clădirile de sub cameră: ${zc === null ? NEAPLICATA : `coboară la ${zc.minY.toFixed(2)} m, lipită de lanternă`} — pică`);
}
{
  // Jos, mutarea de la tastatură urcă peste ce are în cale, fără ca planul apropiat să taie
  // stânca și fără salturi. Locurile: 16 faleze de peste 60 m, la 8–40 m de un punct de plajă
  // sau de mare, la cel puțin 100 m una de alta. Pornirea: 40 m înapoi (cu W) sau chiar pe plajă
  // (cu S, faleza în spate), la LIBER_SOL peste maximul de pe un disc de 15 m, privind la 10° sub
  // orizont. W sau S ținut 3 s, apoi 200 de cadre. Pe fiecare cadru se măsoară tot trunchiul
  // vederii — o grilă de 9 × 7 raze, adâncimea a ce se vede până la 25 m, proiectată pe direcția
  // privirii —, cât urcă camera și cât stă peste sol (discul planului apropiat).
  // Controale: `_solSub` numai pe verticala punctului; discul de rază NEAR; mutarea fără
  // amânare (urcarea rămâne în urmă).
  const locuri = [];
  for (let x = -1150; x <= 1150; x += 10) for (let z = -1480; z <= 1480; z += 10) {
    const s0 = inaltimeRandata(x, z);
    if (s0 > 1) continue;
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8, dx = Math.sin(a), dz = -Math.cos(a);
      let maxH = -Infinity;
      for (let s = 8; s <= 40; s += 2) maxH = Math.max(maxH, inaltimeRandata(x + dx * s, z + dz * s));
      if (maxH - s0 > 60) locuri.push({ x, z, dx, dz, H: maxH - s0 });
    }
  }
  locuri.sort((a, b) => b.H - a.H);
  const faleze = [];
  for (const l of locuri) { if (faleze.every((a) => Math.hypot(a.x - l.x, a.z - l.z) > 100)) faleze.push(l); if (faleze.length >= 16) break; }
  const rc = new THREE.Raycaster(), fata = new THREE.Vector3();
  const adancimeMin = (camera) => {
    camera.updateMatrixWorld();
    camera.getWorldDirection(fata);
    let m = Infinity;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 6; j++) {
      rc.setFromCamera(new THREE.Vector2(-1 + i / 4, -1 + j / 3), camera);
      const d = punctVazut(rc.ray, TEREN, 25);
      if (d !== null) m = Math.min(m, d * rc.ray.direction.dot(fata));
    }
    return m;
  };
  const zboara = (l, tasta, M) => {
    const b = pagina2(M ? { M } : {});
    const semn = tasta === 'KeyS' ? -1 : 1, ina = tasta === 'KeyS' ? 0 : 40;
    const u = new THREE.Vector3(semn * l.dx * Math.cos(10 / GRADE), -Math.sin(10 / GRADE), semn * l.dz * Math.cos(10 / GRADE));
    const px = l.x - l.dx * ina, pz = l.z - l.dz * ina;
    let m = Math.max(COTA_MARE, inaltimeRandata(px, pz));
    for (let r = 1; r <= 15; r++) for (let q = 0; q < 64; q++) m = Math.max(m, inaltimeRandata(px + r * Math.cos(q * Math.PI / 32), pz + r * Math.sin(q * Math.PI / 32)));
    b.camera.position.set(px, m + LIBER_SOL + 0.01, pz);
    b.controale.target.copy(b.camera.position).addScaledVector(u, 200);
    b.controale.update(); b.controale.pivotPeTeren(); b.controale.update();
    let salt = 0, adanc = Infinity, minSol = Infinity, yPrec = b.camera.position.y;
    const p0 = b.camera.position.clone();
    const masoara = () => {
      const c = b.camera.position;
      salt = Math.max(salt, c.y - yPrec); yPrec = c.y;
      adanc = Math.min(adanc, adancimeMin(b.camera));
      minSol = Math.min(minSol, pesteSol(c, b.camera));
    };
    b.apasa(tasta, { tine: true });
    b.cadre(180, masoara);
    b.ridica(tasta);
    b.cadre(200, masoara);
    const mers = Math.hypot(b.camera.position.x - p0.x, b.camera.position.z - p0.z);
    b.dispose();
    return { salt, adanc, minSol, mers };
  };
  const toate = (M) => {
    const w = faleze.map((l) => zboara(l, 'KeyW', M)), s = faleze.map((l) => zboara(l, 'KeyS', M));
    const r = [...w, ...s];
    return { n: faleze.length, taiate: r.filter((x) => x.adanc < NEAR).length, adanc: Math.min(...r.map((x) => x.adanc)),
      salt: Math.max(...r.map((x) => x.salt)), minSol: Math.min(...r.map((x) => x.minSol)), mers: w.reduce((a, x) => a + x.mers, 0) };
  };
  const text = (x) => (x === null ? NEAPLICATA : `trunchiul tăiat de planul apropiat în ${x.taiate} din ${2 * x.n} zboruri, adâncimea minimă ${x.adanc.toFixed(2)} m; `
    + `saltul cel mai mare pe cadru ${x.salt.toFixed(2)} m; camera cel puțin ${x.minSol.toFixed(2)} m peste sol; cu W, ${x.mers.toFixed(0)} m parcurși în total`);
  const z = toate(null);
  // Saltul: urcarea alunecă — o faleză de 147 m se urcă în ~0,2 s, cu cel mult 8% din rest pe
  // un cadru, cum alunecă treptele (TAU_VERTICAL). Pragul de 15 m o lasă; urcarea dintr-odată,
  // nu (controlul de mai jos).
  proba(z.n === 16 && z.taiate === 0 && z.adanc >= NEAR && z.salt < 15 && z.minSol > LIBER_SOL - 0.01,
    `W și S ținute 3 s, la 20 m peste plajă, spre ${z.n} faleze de peste 60 m și cu ele în spate: ${text(z)}`);
  const SOL = ['    for (let k = -1; k < 32; k++) {', '    for (let k = -1; k < 0; k++) {'];
  for (const [ce, perechi, cere] of [
    ['`_solSub` numai pe verticala punctului', [SOL], (x) => x.taiate > 0],
    ['discul de rază NEAR', [['    const raza = 1.1 * cam.near * Math.sqrt(1 + tv * tv * (1 + cam.aspect * cam.aspect));', '    const raza = cam.near;']], (x) => x.taiate > 0],
    ['mutarea fără amânare', [['          am.copy(po).multiplyScalar(1 - a);\n          po.multiplyScalar(a);\n', '']], (x) => x.taiate > 0 || x.salt >= 15 || x.minSol < 0],
    ['partea care nu încape aruncată, nu amânată', [['          am.copy(po).multiplyScalar(1 - a);\n', '']], (x) => x.mers < 0.8 * z.mers],
    ['urcarea dintr-odată', [['      const dy = Math.abs(rest) < 1e-3 ? rest : rest * (1 - Math.exp(-dt / TAU_VERTICAL));', '      const dy = rest;']], (x) => x.salt >= 15],
  ]) {
    const M = await modulDin(muta(CAMERA_JS, ...perechi));
    const x = M ? toate(M) : null;
    proba(x !== null && cere(x), `control, ${ce}: ${text(x)} — pică`);
  }
}
{
  // Rotirea și zoomul de la tastatură, după o coborâre cu Ctrl: camera la 150 m peste
  // (216,3; −302,5), privind spre azimutul de grilă 210,3° la 6,5° sub orizont, Ctrl ținut 20 s,
  // apoi E sau Q de 6 ori, ori „−” sau „+” de 3 ori, cu amortizare și pe loc. Camera rămâne la
  // cel puțin LIBER_SOL peste sol. Controale: rotirea fără pază (recenzia: −61,7 m), zoomul fără
  // pază și zoomul păzit numai spre P, nu și la retragere (−50,7 m).
  const scenariu = (M, faraMiscare, tasta, n) => {
    const b = pagina2(M ? { M, faraMiscare } : { faraMiscare });
    const a = 210.3 / GRADE, e = 6.5 / GRADE;
    const x = 216.3, z = -302.5;
    b.camera.position.set(x, inaltimeRandata(x, z) + 150, z);
    b.controale.target.copy(b.camera.position).addScaledVector(new THREE.Vector3(Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)), 500);
    b.controale.update(); b.controale.pivotPeTeren(); b.controale.update();
    b.apasa('ControlLeft', { tine: true, ctrlKey: true });
    b.cadre(1200);
    b.ridica('ControlLeft');
    b.cadre(300);
    const dupaCtrl = pesteSol(b.camera.position, b.camera);
    let min = Infinity;
    for (let i = 0; i < n; i++) { b.apasa(tasta); b.cadre(90, () => { min = Math.min(min, pesteSol(b.camera.position, b.camera)); }); }
    b.dispose();
    return { dupaCtrl, min };
  };
  const rul = (M) => Object.fromEntries([['E', 'KeyE', 6], ['Q', 'KeyQ', 6], ['−', '-', 3], ['+', '+', 3]].flatMap(([k, t, n]) =>
    [[k, scenariu(M, false, t, n)], [`${k} pe loc`, scenariu(M, true, t, n)]]));
  const z = rul(null);
  const ok = (r) => Object.values(r).every((x) => x.min >= LIBER_SOL - 1e-6);
  const text = (r) => Object.entries(r).map(([k, x]) => `${k} ${x.min.toFixed(2)}`).join(', ');
  proba(ok(z) && Math.abs(z.E.dupaCtrl - LIBER_SOL) < 1, `după Ctrl (${z.E.dupaCtrl.toFixed(2)} m peste sol), cel mai jos: ${text(z)} m`);
  for (const [ce, perechi, chei] of [
    ['rotirea fără pază', [['      if (this._sphericalDelta.theta && this._pazesteRotirea(f)) mutat = true;\n', '']], ['E', 'E pe loc']],
    ['zoomul fără pază', [["    liber: dinTasta && teren ? controale.liberLa ?? null : null,", '    liber: null,']], ['−', '− pe loc']],
    ['zoomul păzit numai spre P', [['    if (!retras(sT)) {', '    if (false) {']], ['−', '− pe loc']],
  ]) {
    let M = null;
    if (ce.startsWith('zoom')) {
      const R = muta(textSursa('src/scene/rotita.js'), ...perechi);
      if (R !== null) {
        const f = join(tmpdir(), `cabo-rotita-${process.pid}-${nrModul++}.mjs`);
        writeFileSync(f, R.replace(/from '(three(?:\/[^']*)?)'/g, (_, s) => `from '${import.meta.resolve(s)}'`)
          .replace(/from '\.\/([^']+)'/g, (_, g) => `from '${new URL(`../src/scene/${g}`, import.meta.url).href}'`));
        M = await modulDin(muta(CAMERA_JS, ["import { creeazaRotita } from './rotita.js';", `import { creeazaRotita } from '${pathToFileURL(f).href}';`]));
        rmSync(f, { force: true });
      }
    } else M = await modulDin(muta(CAMERA_JS, ...perechi));
    const R = M ? rul(M) : null;
    const x = R ? Object.fromEntries(chei.map((k) => [k, R[k]])) : null;
    proba(x !== null && !ok(x), `control, ${ce}: ${x === null ? NEAPLICATA : text(x)} m — pică`);
  }
}
{
  // Shift și Ctrl sunt și taste de modificare: Shift + Tab, Shift + = („+”), Ctrl + F, Ctrl + plus,
  // Shift cu un clic sau cu rotița, Shift și Ctrl deodată, o apăsare scurtă — nu urcă și nu coboară.
  // Cu W ținut, da: mutarea și urcarea merg împreună. Pașii numărați pe comenzile date
  // controalelor. Controale: fără anularea la alte taste, și fără grația de GRATIE ms.
  const cazuri = (Tmod) => {
    const r = {};
    const caz = (nume, f) => { const b = pagina2({ T: Tmod }); f(b); b.cadre(300); r[nume] = b.comenzi.reduce((m, n) => ({ ...m, [n]: (m[n] ?? 0) + 1 }), {}); b.dispose(); };
    const sh = { tine: true, shiftKey: true }, ct = { tine: true, ctrlKey: true };
    caz('Shift scurt', (b) => { b.apasa('ShiftLeft', sh); b.cadre(9); b.ridica('ShiftLeft'); });
    caz('Shift + Tab', (b) => { b.apasa('ShiftLeft', sh); b.cadre(9); b.apasa('Tab', { shiftKey: true }); b.cadre(30); b.ridica('ShiftLeft'); });
    caz('Shift + „+”', (b) => { b.apasa('ShiftLeft', sh); b.cadre(9); b.apasa('Equal', { key: '+', shiftKey: true, tine: true }); b.cadre(30); b.ridica('Equal'); b.ridica('ShiftLeft'); });
    caz('Shift + clic', (b) => { b.apasa('ShiftLeft', sh); b.cadre(9); b.apasaPe(b.el); b.cadre(30); b.ridica('ShiftLeft'); });
    caz('Shift + rotiță', (b) => { b.apasa('ShiftLeft', sh); b.cadre(9); b.doc.emit('wheel', {}); b.cadre(30); b.ridica('ShiftLeft'); });
    caz('Shift și Ctrl', (b) => { b.apasa('ShiftLeft', sh); b.apasa('ControlLeft', { ...ct, shiftKey: true }); b.cadre(60); b.ridica('ControlLeft'); b.ridica('ShiftLeft'); });
    caz('Ctrl + F', (b) => { b.apasa('ControlLeft', ct); b.cadre(9); b.apasa('KeyF', { ctrlKey: true }); b.cadre(30); b.ridica('ControlLeft'); });
    caz('Ctrl + „+”', (b) => { b.apasa('ControlLeft', ct); b.cadre(9); b.apasa('Equal', { key: '=', ctrlKey: true }); b.cadre(30); b.ridica('ControlLeft'); });
    caz('Shift ținut', (b) => { b.apasa('ShiftLeft', sh); b.cadre(62); b.ridica('ShiftLeft'); });
    caz('Ctrl ținut', (b) => { b.apasa('ControlLeft', ct); b.cadre(62); b.ridica('ControlLeft'); });
    caz('Shift + W', (b) => { b.apasa('ShiftLeft', sh); b.cadre(3); b.apasa('KeyW', sh); b.cadre(59); b.ridica('KeyW'); b.ridica('ShiftLeft'); });
    caz('Ctrl + W', (b) => { b.apasa('ControlLeft', ct); b.cadre(3); b.apasa('KeyW', ct); b.cadre(59); b.ridica('KeyW'); b.ridica('ControlLeft'); });
    return r;
  };
  const ASTEPTAT = {
    'Shift scurt': {}, 'Shift + Tab': {}, 'Shift + „+”': { apropie: 4 }, 'Shift + clic': {}, 'Shift + rotiță': {}, 'Shift și Ctrl': {},
    'Ctrl + F': {}, 'Ctrl + „+”': {}, 'Shift ținut': { urca: 6 }, 'Ctrl ținut': { coboara: 6 },
    'Shift + W': { urca: 6, sus: 7 }, 'Ctrl + W': { coboara: 6, sus: 7 },
  };
  const text = (r) => Object.entries(r).map(([k, v]) => `${k}: ${Object.entries(v).map(([n, c]) => `${n} ${c}`).join(' ') || 'nimic'}`).join('; ');
  const cheie = (o) => JSON.stringify(Object.entries(o ?? {}).sort());
  const gresite = (r) => Object.keys(ASTEPTAT).filter((k) => cheie(r[k]) !== cheie(ASTEPTAT[k]));
  const z = cazuri({ creeazaTastatura });
  proba(gresite(z).length === 0, `${text(z)}${gresite(z).length ? ` — greșite: ${gresite(z).join(', ')}` : ''}`);
  const fa = await modulDin(muta(TASTATURA_JS, ['    if (!MISCARI[e.code]) anuleazaVerticale();\n', '']));
  const za = fa ? cazuri(fa) : null;
  proba(za !== null && gresite(za).length > 0, `control, fără anularea la alte taste: ${za === null ? NEAPLICATA : `greșite ${gresite(za).join(', ')}`} — pică`);
  const fg = await modulDin(muta(TASTATURA_JS, ['urmatorul: ceas() + GRATIE,', 'urmatorul: ceas(),']));
  const zg = fg ? cazuri(fg) : null;
  proba(zg !== null && gresite(zg).length > 0, `control, fără grație: ${zg === null ? NEAPLICATA : `greșite ${gresite(zg).join(', ')}`} — pică`);
}
{
  // Shift ținut peste GRATIE, apoi Tab: pasul pornit nu mai alunecă până la capăt — camera
  // rămâne unde a ajuns. Shift ținut 300 ms (un pas, la 250 ms), apoi Tab și 300 de cadre.
  // Control: anularea fără oprirea urcării (recenzia: pasul întreg, 26,8 m).
  const tab = (Tmod) => {
    const b = pagina2({ T: Tmod });
    const y0 = b.camera.position.y;
    b.apasa('ShiftLeft', { tine: true, shiftKey: true });
    b.cadre(18);
    b.apasa('Tab', { shiftKey: true });
    b.cadre(12);
    b.ridica('ShiftLeft');
    b.cadre(300);
    const r = { urcat: b.camera.position.y - y0, pasi: b.comenzi.filter((n) => n === 'urca').length };
    b.dispose();
    return r;
  };
  const z = tab({ creeazaTastatura });
  const fa = await modulDin(muta(TASTATURA_JS, ['    if (pornit) controale.opresteUrcarea?.();\n', '']));
  const zf = fa ? tab(fa) : null;
  proba(z.pasi === 1 && z.urcat > 0 && z.urcat < 15, `Shift ținut 300 ms, apoi Tab: ${z.pasi} pas, camera urcată ${z.urcat.toFixed(2)} m, cât apucase`);
  proba(zf !== null && zf.urcat > 20, `control, fără oprirea urcării: ${zf === null ? NEAPLICATA : `${zf.urcat.toFixed(2)} m`} — pică`);
}
{
  // Ctrl după „−” de 8 ori: de la 2,9 km ce se vede pe raza privirii e dincolo de 8 km, iar
  // coborârea nu se mai refuza deloc (recenzia). Ctrl ținut 3 s coboară, cu amortizare și pe
  // loc, cu privirea neschimbată. Control: pasul refuzat când nu se vede nimic în 8 km.
  const dupaDepartare = (M, faraMiscare) => {
    const b = pagina2(M ? { M, faraMiscare } : { faraMiscare });
    for (let i = 0; i < 8; i++) { b.apasa('-'); b.cadre(40); }
    const nimic = vazutInFata(b.camera, b.controale) === null, y0 = b.camera.position.y, u0 = directie(b.camera, b.controale);
    b.apasa('ControlLeft', { tine: true, ctrlKey: true });
    b.cadre(180);
    b.ridica('ControlLeft');
    b.cadre(300);
    const r = { nimic, y0, dy: b.camera.position.y - y0, unghi: Math.acos(Math.min(1, directie(b.camera, b.controale).dot(u0))) };
    b.dispose();
    return r;
  };
  const z = [dupaDepartare(null, false), dupaDepartare(null, true)];
  proba(z.every((x) => x.nimic && x.dy < -100 && x.unghi < 1e-7),
    `„−” ×8 (camera la ${z[0].y0.toFixed(1)} m, nimic văzut în 8 km), apoi Ctrl ținut 3 s: ${z.map((x) => `${x.dy.toFixed(2)} m`).join(' / ')} (cu amortizare / pe loc), privirea neschimbată`);
  const fa = await modulDin(muta(CAMERA_JS, ['      if (d === null ? dy > 0 : dy < 0 && d < this.minDistance) return null;', '      if (d === null || (dy < 0 && d < this.minDistance)) return null;']));
  const zf = fa ? dupaDepartare(fa, false) : null;
  proba(zf !== null && zf.dy > -1, `control, pasul refuzat când nu se vede nimic în 8 km: ${zf === null ? NEAPLICATA : `${zf.dy.toFixed(2)} m`} — pică`);
}
{
  // O tastă apăsată cât harta e ținută de mouse: `start` și `end` numai fără gest deschis,
  // altfel gest.js stingea cursorul și sfera pivotului în mijlocul tragerii (recenzia).
  // Control: `start` și `end` și cu un gest deschis.
  const gest = (M) => {
    const b = pagina2(M ? { M } : {});
    let start = 0, end = 0;
    b.controale.addEventListener('start', () => start++);
    b.controale.addEventListener('end', () => end++);
    b.controale.state = STARE.MUTARE;
    b.apasa('KeyW'); b.apasa('KeyE');
    const inGest = [start, end];
    b.controale.state = STARE.NIMIC;
    b.apasa('KeyW');
    const r = { inGest, liber: [start - inGest[0], end - inGest[1]] };
    b.dispose();
    return r;
  };
  const z = gest(null);
  const fa = await modulDin(muta(CAMERA_JS, ['    const liber = this.state === STARE.NIMIC;', '    const liber = true;']));
  const zf = fa ? gest(fa) : null;
  proba(z.inGest.join() === '0,0' && z.liber.join() === '1,1', `W și E cu harta ținută: ${z.inGest[0]} \`start\`, ${z.inGest[1]} \`end\`; fără gest, ${z.liber.join(' / ')}`);
  proba(zf !== null && zf.inGest.join() !== '0,0', `control, \`start\` și \`end\` și în gest: ${zf === null ? NEAPLICATA : zf.inGest.join(' / ')} — pică`);
}
{
  // Un zbor golește urcarea care încă alunecă, ca treptele rotiței: sub reduced-motion zborul
  // sare direct la capăt, iar urcarea rămasă l-ar împinge de acolo.
  const zboara = (M) => {
    const b = pagina2(M ? { M } : {});
    globalThis.matchMedia = () => ({ matches: true, addEventListener() {} });
    const zbor = creeazaZbor({ camera: b.camera, controale: b.controale, cereRandare: () => {} });
    globalThis.matchMedia = undefined;
    b.apasa('ShiftLeft', { tine: true, shiftKey: true });
    b.cadre(24);
    b.ridica('ShiftLeft');
    const ramas = b.controale._vertical;
    zbor.spre(VEDERE_START);
    b.cadre(400, () => zbor.pas());
    const e = Math.max(b.controale.target.distanceTo(new THREE.Vector3(...VEDERE_START.tinta)), b.camera.position.distanceTo(new THREE.Vector3(...VEDERE_START.pozitie)));
    zbor.dispose();
    b.dispose();
    return { ramas, e };
  };
  const z = zboara(null);
  // zbor.js își ia `descarcaInertia` din camera.js de azi: controlul golește metoda controalelor.
  const fg = await modulDin(muta(CAMERA_JS, ['  opresteVertical() {\n    this._vertical = 0;', '  opresteVertical() {\n    return;']));
  const zf = fg ? zboara(fg) : null;
  proba(z.ramas > 1 && z.e < 1e-9, `Shift ținut 400 ms, apoi zborul acasă cu ${z.ramas.toFixed(1)} m de urcare rămași: aterizează la ${z.e.toExponential(1)} m`);
  proba(zf !== null && zf.e > 1, `control, cu urcarea lăsată în coadă: ${zf === null ? NEAPLICATA : `aterizează la ${zf.e.toFixed(1)} m`} — pică`);
}

// ------------------------------------------------------------ 12. anunțul busolei

console.log('\nBusola: anunțul se scrie numai când direcția s-a schimbat');
{
  // Busola întreagă, pe controalele paginii, cu un DOM fals și un ceas virtual pentru
  // cronometrul ei de 600 ms. 10 mutări și zoomuri fără rotire, apoi o rotire.
  const ST = globalThis.setTimeout, CT = globalThis.clearTimeout, D0 = globalThis.document;
  const anunta = (M) => {
    let acum = 0, urm = 1;
    const t = new Map();
    globalThis.setTimeout = (f, ms = 0) => { const id = urm++; t.set(id, { la: acum + ms, f }); return id; };
    globalThis.clearTimeout = (id) => { t.delete(id); };
    const avanseaza = (ms) => {
      const tinta = acum + ms;
      for (;;) {
        let u = null;
        for (const e of t) if (e[1].la <= tinta && (!u || e[1].la < u[1].la)) u = e;
        if (!u) break;
        t.delete(u[0]); acum = u[1].la; u[1].f();
      }
      acum = tinta;
    };
    const scrieri = [];
    let text = '';
    const el = () => ({ atribute: {}, setAttribute(n, v) { this.atribute[n] = String(v); }, getAttribute(n) { return this.atribute[n] ?? null; },
      addEventListener() {}, removeEventListener() {}, remove() {}, textContent: '' });
    const anunt = el();
    Object.defineProperty(anunt, 'textContent', { get: () => text, set: (v) => { scrieri.push({ text: String(v), aceeasi: String(v) === text }); text = String(v); } });
    const parti = { '.roza': el(), '.cadran': el(), '.citire': el(), '.anunt': anunt };
    const etichete = [['0', '-38'], ['38', '0'], ['0', '38'], ['-38', '0']].map(([x, y]) => { const e = el(); e.atribute.x = x; e.atribute.y = y; return e; });
    globalThis.document = { createElement: () => Object.assign(el(), { innerHTML: '', querySelector: (s) => parti[s] ?? null, querySelectorAll: (s) => (s === '.eticheta' ? etichete : []) }) };
    const b = pagina2();
    const bus = M.creeazaBusola({ gazda: { appendChild() {} }, controale: b.controale, colturi: relief.meta.colturi_geo, laClic: () => {} });
    avanseaza(700);
    const primul = text, n0 = scrieri.length;
    for (const tasta of ['ArrowUp', '+', 'ArrowLeft', '-', 'ArrowDown', '+', 'ArrowRight', '-', 'ArrowUp', '+']) { b.apasa(tasta); b.cadre(300); avanseaza(700); }
    const mutari = scrieri.slice(n0), n1 = scrieri.length;
    b.apasa('KeyE'); b.cadre(300); avanseaza(700);
    const rotire = scrieri.slice(n1);
    bus.dispose();
    b.dispose();
    return { primul, mutari, rotire };
  };
  const z = anunta(BUSOLA);
  const BV = await modulDin(textVechi('src/scene/busola.js'));
  const v = BV ? anunta(BV) : null;
  globalThis.setTimeout = ST; globalThis.clearTimeout = CT;
  if (D0 === undefined) delete globalThis.document; else globalThis.document = D0;
  const identice = (x) => x.mutari.filter((s) => s.aceeasi).length;
  proba(/^Privești dinspre /.test(z.primul) && identice(z) === 0 && z.rotire.length === 1 && !z.rotire[0].aceeasi,
    `după „${z.primul}”, 10 mutări și zoomuri fără rotire: ${z.mutari.length} scrieri, ${identice(z)} identice; o rotire de 15°: `
    + `${z.rotire.length} scriere, „${z.rotire[0]?.text}”`);
  proba(v !== null && identice(v) > 0, `control, busola.js de la ${REPER_VECHI}: ${v === null ? 'NECITIT' : `${identice(v)} scrieri identice din ${v.mutari.length}`} — pică`);
}

// ------------------------------------------------------------ 13. Escape

console.log('\nEscape: fișa sanctuarului și cutia „Coordonate” se închid; focusul de pe alt control rămâne pe el');
{
  // Pe telefon fișa e o foaie jos, peste busolă, Satelit și „Coordonate”, iar Shift+Tab ajunge pe
  // ele, sub ea: Escape trebuie s-o închidă fără să mute focusul de pe controlul acoperit. La fel
  // cutia „Coordonate”, care la 320 × 256 coboară peste Satelit și busolă. Eticheta și panoul
  // adevărate, în ordinea din scena.js — întâi panoul, apoi eticheta, fiecare cu ascultătorul lui
  // pe document —, cu un DOM fals: noduri cu părinte, `contains`, `closest` și focus, un document
  // care cheamă ascultătorii în ordinea înscrierii, ca browserul pe același nod.
  const D0 = globalThis.document, A0 = globalThis.addEventListener, R0 = globalThis.removeEventListener;
  class Nod {
    constructor(doc, tag = 'div') {
      Object.assign(this, { doc, tagName: tag.toUpperCase(), copii: [], parinte: null, atribute: {}, hidden: false, textContent: '',
        title: '', id: '', className: '', style: {}, dataset: {}, asc: new Map(), gasite: new Map() });
      this.classList = { toggle() {}, contains: () => false };
    }
    setAttribute(k, v) { this.atribute[k] = String(v); }
    getAttribute(k) { return this.atribute[k] ?? null; }
    removeAttribute(k) { delete this.atribute[k]; }
    hasAttribute(k) { return k in this.atribute; }
    toggleAttribute(k, f) { const da = f ?? !this.hasAttribute(k); if (da) this.atribute[k] = ''; else delete this.atribute[k]; return da; }
    append(...n) { for (const c of n) if (typeof c !== 'string') { c.parinte = this; this.copii.push(c); } }
    appendChild(c) { this.append(c); return c; }
    remove() { if (this.parinte) this.parinte.copii = this.parinte.copii.filter((x) => x !== this); this.parinte = null; }
    contains(x) { for (let n = x; n; n = n.parinte) if (n === this) return true; return false; }
    closest(sel) { return sel === 'dialog[open]' && this.tagName === 'DIALOG' && this.hasAttribute('open') ? this : (this.parinte?.closest(sel) ?? null); }
    focus() { this.doc.activeElement = this; }
    addEventListener(t, f) { this.asc.set(t, f); }
    removeEventListener(t) { this.asc.delete(t); }
    getBoundingClientRect() { return RECT; }
    getClientRects() { return [RECT]; }
    // Panoul își face copiii prin innerHTML: aici fiecare selector primește un nod, în cutie
    // dacă e al ei — butonul minimizat și cutia stau direct în rădăcină.
    querySelector(s) {
      if (!this.gasite.has(s)) {
        const n = new Nod(this.doc, 'span');
        (s === '.cutie' || s === '.activeaza' ? this : this.querySelector('.cutie')).append(n);
        this.gasite.set(s, n);
      }
      return this.gasite.get(s);
    }
    querySelectorAll(s) { return Array.from({ length: { '.sc .axa': 3, '.tm .axa': 2, '.cl, .sol': 4 }[s] ?? 0 }, (_, i) => this.querySelector(`${s} ${i}`)); }
  }
  const CONTINUT = { eticheta: 'Sanctuarul', nume: 'Santuário de Nossa Senhora do Cabo Espichel', despre_model: 'modelul',
    fapte: [{ text: 'un fapt', surse: [{ url: 'https://exemplu.test', nume: 'sursa' }] }] };
  const { camera } = pagina();
  /** Pagina: Satelit și busola, apoi panoul și eticheta, ca în scena.js. `P`, `E`: modulele lor. */
  const pagina4 = ({ P = PUNCT, E = ETICHETA } = {}) => {
    const asc = [];
    const doc = { activeElement: null, querySelector: () => null, createElement: (t) => new Nod(doc, t),
      addEventListener(t, f) { asc.push([t, f]); }, removeEventListener(t, f) { const i = asc.findIndex((x) => x[0] === t && x[1] === f); if (i >= 0) asc.splice(i, 1); } };
    doc.documentElement = new Nod(doc, 'html');
    doc.body = new Nod(doc, 'body');
    doc.documentElement.append(doc.body);
    doc.activeElement = doc.body;
    globalThis.document = doc;
    globalThis.addEventListener = globalThis.removeEventListener = () => {};
    const satelit = new Nod(doc, 'button'), roza = new Nod(doc, 'button'), canvas = new Nod(doc, 'canvas');
    doc.body.append(canvas, satelit, roza);
    const punct = P.creeazaPunct({ gazda: doc.body, canvas, camera, geo: creeazaGeo(relief.meta), inaltimeLa: inaltimeRandata, limitaDatelor,
      limiteMars: imp.limite, inAlpha: alpha.contine, zMin: relief.meta.zMin_m, loveste: TEREN.loveste });
    const eticheta = E.creeazaEticheta({ gazda: doc.body, canvas, camera, inaltimeLa: inaltimeRandata, ancora: [0, 100, 0], continut: CONTINUT,
      laDeschidere: () => {}, laInchidere: () => {}, cereRandare: () => {} });
    const radacinaPunct = doc.body.copii.find((n) => n.id === 'punct');
    const poi = doc.body.copii.find((n) => n.id === 'sanctuar-eticheta').copii.find((n) => n.className === 'poi');
    const fisa = doc.body.copii.find((n) => n.id === 'sanctuar-fisa');
    /** O apăsare de Escape pe elementul cu focus, ca în browser. */
    const escape = (target = doc.activeElement) => {
      const e = { type: 'keydown', key: 'Escape', target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      for (const [t, f] of [...asc]) if (t === 'keydown') f(e);
    };
    const nume = (n) => (n === roza ? 'rozeta' : n === satelit ? 'Satelit' : n === poi ? 'eticheta' : n === doc.body ? '<body>' : n?.closest('dialog[open]') ? 'modală'
      : n === radacinaPunct.querySelector('.activeaza') ? '„Coordonate”' : fisa.contains(n) ? 'în fișă' : 'altundeva');
    return { doc, asc, satelit, roza, punct, eticheta, poi, fisa, radacinaPunct, escape, nume,
      stare: () => `fișa ${fisa.hidden ? 'închisă' : 'DESCHISĂ'}, panoul ${punct.activ ? 'DESCHIS' : 'minimizat'}, focusul pe ${nume(doc.activeElement)}`,
      dispose() { eticheta.dispose(); punct.dispose(); } };
  };
  /** Cazurile, pe module date; fiecare întoarce starea de după, ca text. */
  const cazuri = (o) => {
    const r = {};
    const caz = (nume, f) => { const p = pagina4(o); try { f(p); r[nume] = p.stare(); } catch (e) { r[nume] = `aruncă: ${e.message}`; } p.dispose(); };
    // Fișa deschisă, Shift+Tab până pe rozetă (sau pe Satelit), apoi Escape.
    caz('rozeta', (p) => { p.eticheta.deschide(); p.roza.focus(); p.escape(); });
    caz('Satelit', (p) => { p.eticheta.deschide(); p.satelit.focus(); p.escape(); });
    // Din fișă, sau de pe <body> după un clic pe un rând al ei: înapoi pe etichetă.
    caz('din fișă', (p) => { p.eticheta.deschide(); p.escape(); });
    caz('<body>', (p) => { p.eticheta.deschide(); p.doc.body.focus(); p.escape(); });
    // Fișa și panoul deschise: primul Escape închide fișa, al doilea panoul.
    caz('amândouă, un Escape', (p) => { p.punct.activeaza(); p.eticheta.deschide(); p.roza.focus(); p.escape(); });
    caz('amândouă, două', (p) => { p.punct.activeaza(); p.eticheta.deschide(); p.roza.focus(); p.escape(); p.escape(); });
    // Panoul singur: din cutie, focusul trece pe „Coordonate”; de pe rozetă rămâne.
    caz('panoul, din cutie', (p) => { p.punct.activeaza(); p.radacinaPunct.querySelector('.minimizeaza').focus(); p.escape(); });
    caz('panoul, de pe rozetă', (p) => { p.punct.activeaza(); p.roza.focus(); p.escape(); });
    // Modala surselor deschisă deasupra: Escape-ul e al ei.
    caz('modala', (p) => {
      p.punct.activeaza(); p.eticheta.deschide();
      const d = new Nod(p.doc, 'dialog'); d.setAttribute('open', ''); const b = new Nod(p.doc, 'button'); d.append(b); p.doc.body.append(d); b.focus();
      p.escape();
    });
    return r;
  };
  const ASTEPTAT = {
    'rozeta': 'fișa închisă, panoul minimizat, focusul pe rozeta',
    'Satelit': 'fișa închisă, panoul minimizat, focusul pe Satelit',
    'din fișă': 'fișa închisă, panoul minimizat, focusul pe eticheta',
    '<body>': 'fișa închisă, panoul minimizat, focusul pe eticheta',
    'amândouă, un Escape': 'fișa închisă, panoul DESCHIS, focusul pe rozeta',
    'amândouă, două': 'fișa închisă, panoul minimizat, focusul pe rozeta',
    'panoul, din cutie': 'fișa închisă, panoul minimizat, focusul pe „Coordonate”',
    'panoul, de pe rozetă': 'fișa închisă, panoul minimizat, focusul pe rozeta',
    'modala': 'fișa DESCHISĂ, panoul DESCHIS, focusul pe modală',
  };
  const gresite = (r) => Object.keys(ASTEPTAT).filter((k) => r[k] !== ASTEPTAT[k]);
  const descrie = (r, chei = Object.keys(ASTEPTAT)) => chei.map((k) => `${k}: ${r[k]}`).join('; ');
  const ETICHETA_JS = textSursa('src/scene/eticheta.js'), PUNCT_JS = textSursa('src/scene/punct.js');
  const z = cazuri({});
  proba(gresite(z).length === 0, `${descrie(z)}${gresite(z).length ? ` — greșite: ${gresite(z).join(', ')}` : ''}`);
  // Controale: modulele de la REPER_VECHI; reparația din constatare, fără <body>; panoul fără
  // condiția fișei.
  const EV = await modulDin(textVechi('src/scene/eticheta.js')), PV = await modulDin(textVechi('src/scene/punct.js'));
  const v1 = EV ? cazuri({ E: EV }) : null;
  proba(v1 !== null && v1.rozeta !== ASTEPTAT.rozeta, `control, eticheta.js de la ${REPER_VECHI}: ${v1 === null ? 'NECITIT' : descrie(v1, ['rozeta', 'Satelit'])} — pică`);
  const v2 = PV ? cazuri({ P: PV }) : null;
  proba(v2 !== null && v2['panoul, din cutie'] !== ASTEPTAT['panoul, din cutie'],
    `control, punct.js de la ${REPER_VECHI}: ${v2 === null ? 'NECITIT' : descrie(v2, ['panoul, din cutie', 'panoul, de pe rozetă'])} — pică`);
  const E3 = await modulDin(muta(ETICHETA_JS, ['inchideFisa(fisa.contains(e.target) || e.target === document.body || e.target === document.documentElement);', 'inchideFisa(fisa.contains(e.target));']));
  const v3 = E3 ? cazuri({ E: E3 }) : null;
  proba(v3 !== null && v3['<body>'] !== ASTEPTAT['<body>'], `control, focusul întors numai din fișă: ${v3 === null ? NEAPLICATA : descrie(v3, ['<body>'])} — pică`);
  const P4 = await modulDin(muta(PUNCT_JS, ["    if (document.documentElement.hasAttribute('data-fisa-deschisa')) return;\n", '']));
  const v4 = P4 ? cazuri({ P: P4 }) : null;
  proba(v4 !== null && v4['amândouă, un Escape'] !== ASTEPTAT['amândouă, un Escape'],
    `control, panoul fără condiția fișei: ${v4 === null ? NEAPLICATA : descrie(v4, ['amândouă, un Escape'])} — pică`);
  if (D0 === undefined) delete globalThis.document; else globalThis.document = D0;
  if (A0 === undefined) { delete globalThis.addEventListener; delete globalThis.removeEventListener; } else { globalThis.addEventListener = A0; globalThis.removeEventListener = R0; }
}

console.log(picate ? `\n${picate} probe au picat` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
