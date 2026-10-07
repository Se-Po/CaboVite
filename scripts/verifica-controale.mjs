// Verifică, în Node, mânuirea hărții: rotița, apucarea, pivotul și stările gesturilor.
//
//   npm run verifica-controale
//
// Nu scrie nimic. Construiește alpha și împrejurimile cu CODUL PAGINII, ca
// verifica-imprejurimi, apoi camera și controalele din camera.js, și le dă
// evenimente ca ale browserului. Ecranul e 1600 × 900. Iese cu cod 1 dacă pică vreo
// probă. Fiecare probă de fond are un control negativ: aceeași măsurătoare pe o
// greșeală cunoscută trebuie să pice.

import { existsSync, readFileSync } from 'node:fs';
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
import { ControaleHarta, creeazaCamera, descarcaInertia, STARE, VEDERE_START } from '../src/scene/camera.js';
import { creeazaZbor } from '../src/scene/zbor.js';

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const LN = Math.log(FACTOR_TREAPTA);

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
const { pastreaza, subPetic } = mascaBazei(relief, reliefPetic);
const ndvi = straturiNdvi(relief, reliefPetic);
const teren = creeazaTeren(relief, { pastreaza, paleta, ndvi: ndvi.baza });
const petic = creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta, ndvi: ndvi.petic });
const margineAlpha = buclaNoduri(relief, { x: 0, z: 0 }, ndvi.baza, dreptunghiGrila(relief));
const imp = creeazaImprejurimi({ niveluri: await incarcaImprejurimi(), margineAlpha, paleta });
const inaltimeLa = (x, z) => (subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z));
// Farul și celelalte clădiri, ca în pagină: zoomul și apucarea le văd.
const bb = relief.meta.bbox_tm06;
const cladiri = creeazaSanctuar({ date: await incarcaCladiri(), inaltimeLa, ancora: { x: (bb.xMin + bb.xMax) / 2, y: (bb.yMin + bb.yMax) / 2 }, eticheta: 'clădiri' });
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
    '_handleTouchMovePan', '_handleMouseDownRotate', '_handleTouchStartDollyRotate', '_handleTouchMoveDolly', '_getSecondPointerPosition'];
  const lipsa = priv.filter((m) => typeof OrbitControls.prototype[m] !== 'function');
  const campuri = ['_panOffset', '_controlActive', '_pointers', '_dollyStart'].filter((c) => !(c in k));
  proba(!lipsa.length && !campuri.length, `metodele și câmpurile private folosite există (${priv.length} + 4)${lipsa.length || campuri.length ? ': lipsesc ' + [...lipsa, ...campuri].join(', ') : ''}`);
  k.dispose();
  proba(!('cursor' in stil), 'după dispose(), niciun cursor inline: disconnect() scrie „auto”, iar dispose() îl scoate');
  const { controale } = creeazaCamera(null);
  descarcaInertia(controale);
  proba(controale instanceof ControaleHarta && controale.mouseButtons.LEFT === THREE.MOUSE.PAN && controale.mouseButtons.RIGHT === THREE.MOUSE.ROTATE
    && controale.touches.ONE === THREE.TOUCH.PAN && controale.touches.TWO === THREE.TOUCH.DOLLY_ROTATE && controale.screenSpacePanning === false,
  'creeazaCamera: stânga mută, dreapta rotește, un deget mută, două ciupesc și rotesc, mutarea pe orizontală');
}

console.log(picate ? `\n${picate} probe au picat` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
