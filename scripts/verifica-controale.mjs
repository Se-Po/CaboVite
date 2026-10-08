// Verifică, în Node, mânuirea hărții: rotița, apucarea, pivotul și stările gesturilor,
// plus punctul pe care îl culege panoul „Coordonate” — același „ce e sub cursor”.
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
import { ControaleHarta, creeazaCamera, descarcaInertia, STARE, urmaresteMarireaPaginii, VEDERE_START } from '../src/scene/camera.js';
import { creeazaZbor } from '../src/scene/zbor.js';
import { creeazaPunct } from '../src/scene/punct.js';
import { creeazaGeo } from '../src/scene/geo.js';

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
const { pastreaza, subPetic, limitaDatelor } = mascaBazei(relief, reliefPetic);
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
    '_handleTouchMovePan', '_handleMouseDownRotate', '_handleTouchStartDollyRotate', '_handleTouchMoveDolly', '_getSecondPointerPosition',
    '_isTrackingPointer'];
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
  // țin `textContent` și `hidden`, câte unul pe selector, și ascultători care nu fac nimic.
  const fals = () => ({ hidden: false, textContent: '', title: '', classList: { toggle() {} }, setAttribute() {}, toggleAttribute() {},
    removeAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, remove() {} });
  const noduri = new Map();
  const unul = (s) => noduri.get(s) ?? noduri.set(s, fals()).get(s);
  const NR_AXE = { '.sc .axa': 3, '.tm .axa': 2 };
  globalThis.document = { documentElement: fals(), createElement: () => ({ ...fals(), set innerHTML(_) {}, querySelector: unul,
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

console.log(picate ? `\n${picate} probe au picat` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
