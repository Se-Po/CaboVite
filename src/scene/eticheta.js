import * as THREE from 'three';

// Eticheta sanctuarului pe hartă și fișa care se deschide din ea.
//
// E DOM, nu geometrie: un buton adevărat, care se citește, se focalizează de la
// tastatură și se mărește odată cu textul paginii. Se proiectează pe ancoră la
// fiecare cadru desenat — `pas()` se cheamă chiar înainte de `render`, ca eticheta
// și imaginea să fie mereu ale aceluiași cadru.
//
// Trei lucruri pe care nu le face o etichetă simplă:
//   - OCOLEȘTE panourile: busola, panoul punctului, subsolul cu surse, legenda și
//     fișa deschisă. Încearcă sus, dreapta, stânga, jos, și ia prima poziție liberă.
//     Obstacolele se citesc din DOM, nu se presupun: panoul punctului crește după
//     un clic, iar pe telefon subsolul curge odată cu pagina.
//   - Când ancora iese din cadru sau e în spatele camerei, eticheta stă lipită de
//     marginea ecranului, cu o săgeată spre sanctuar: rămâne un drum într-acolo.
//   - Când relieful acoperă sanctuarul, eticheta rămâne, dar punctată: altfel ai
//     căuta clădirile unde nu se văd.
//
// Clicul — sau Enter/Space pe buton — cere zborul și deschide fișa. Fișa e un
// dialog nemodal: harta rămâne vie în spatele ei, Escape o închide și readuce
// focusul pe etichetă.

const OBSTACOLE = ['#busola .roza', '#busola .citire', '#punct .cutie', '#surse', '#legenda'];
const DIST_ETICHETA = 12; // px între ancoră și etichetă
const MARGINE = 8;        // px de la marginea ecranului

const intersectie = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * Alege unde se așază eticheta, dintre patru poziții în jurul ancorei: prima care nu
 * atinge niciun obstacol; dacă toate ating, cea care acoperă cel mai puțin.
 * Fiecare poziție se aduce întâi în ecran.
 */
export function alegePozitie(ancora, marime, obstacole, ecran) {
  const { x, y } = ancora, { w, h } = marime;
  const candidati = [
    { nume: 'sus', left: x - w / 2, top: y - h - DIST_ETICHETA },
    { nume: 'dreapta', left: x + DIST_ETICHETA, top: y - h / 2 },
    { nume: 'stanga', left: x - w - DIST_ETICHETA, top: y - h / 2 },
    { nume: 'jos', left: x - w / 2, top: y + DIST_ETICHETA },
  ].map((c) => {
    const left = Math.min(ecran.w - w - MARGINE, Math.max(MARGINE, c.left));
    const top = Math.min(ecran.h - h - MARGINE, Math.max(MARGINE, c.top));
    const r = { left, top, right: left + w, bottom: top + h };
    return { ...c, ...r, acoperit: obstacole.reduce((s, o) => s + intersectie(r, o), 0) };
  });
  return candidati.find((c) => c.acoperit === 0) ?? candidati.reduce((a, b) => (b.acoperit < a.acoperit ? b : a));
}

/**
 * @param {{gazda: HTMLElement, canvas: HTMLCanvasElement, camera: THREE.Camera,
 *          inaltimeLa: (x: number, z: number) => number, ancora: number[],
 *          continut: object, laDeschidere: (fisa: DOMRect) => void, laInchidere?: () => void,
 *          cereRandare: () => void}} o
 *   `laDeschidere` primește cutia fișei deja deschise: cine zboară știe așa ce parte a
 *   ecranului rămâne liberă.
 */
export function creeazaEticheta({ gazda, canvas, camera, inaltimeLa, ancora, continut, laDeschidere, laInchidere, cereRandare }) {
  if (!continut || !Array.isArray(ancora) || ancora.length !== 3 || !ancora.every(Number.isFinite)) {
    console.warn('eticheta sanctuarului: lipsesc ancora sau textul — nu o arăt');
    return null;
  }
  const el = (tag, props = {}, text) => { const e = document.createElement(tag); Object.assign(e, props); if (text) e.textContent = text; return e; };

  // ------------------------------------------------------------ eticheta
  const radacina = el('div', { id: 'sanctuar-eticheta' });
  const pin = el('span', { className: 'pin' });
  pin.setAttribute('aria-hidden', 'true');
  const buton = el('button', { type: 'button', className: 'poi' });
  const sageata = el('span', { className: 'sageata' });
  sageata.setAttribute('aria-hidden', 'true');
  buton.append(sageata, el('span', { className: 'nume' }, continut.eticheta));
  buton.setAttribute('aria-haspopup', 'dialog');
  buton.setAttribute('aria-expanded', 'false');
  buton.setAttribute('aria-controls', 'sanctuar-fisa');
  buton.title = 'Du camera la sanctuar și deschide fișa lui';
  radacina.append(pin, buton);

  // ------------------------------------------------------------ fișa
  const fisa = el('section', { id: 'sanctuar-fisa', hidden: true });
  fisa.setAttribute('role', 'dialog');
  fisa.setAttribute('aria-modal', 'false');
  fisa.setAttribute('aria-labelledby', 'sanctuar-fisa-titlu');
  const titlu = el('h2', { id: 'sanctuar-fisa-titlu', tabIndex: -1 }, continut.nume);
  const inchide = el('button', { type: 'button', className: 'inchide' }, 'Închide');
  const lista = el('ul');
  const cuSursa = (text, surse) => {
    const li = el('li', {}, text + ' ');
    const s = el('span', { className: 'sursa' });
    surse.forEach((q, k) => {
      if (k) s.append('; ');
      const a = el('a', { href: q.url, rel: 'noopener', target: '_blank' }, q.nume);
      s.append(a);
    });
    li.append(s);
    return li;
  };
  for (const f of continut.fapte) lista.append(cuSursa(f.text, f.surse ?? [f.sursa]));
  for (const c of continut.conflicte ?? []) lista.append(cuSursa(c.text, c.surse));
  fisa.append(inchide, titlu, lista, el('p', { className: 'model' }, continut.despre_model));
  gazda.append(radacina, fisa);

  const deschide = () => {
    fisa.hidden = false;
    buton.setAttribute('aria-expanded', 'true');
    titlu.focus();
    murdar = true;
    cereRandare();
  };
  const inchideFisa = (readuFocus = true) => {
    if (fisa.hidden) return;
    fisa.hidden = true;
    buton.setAttribute('aria-expanded', 'false');
    if (readuFocus) buton.focus();
    murdar = true;
    laInchidere?.();
    cereRandare();
  };
  // Întâi fișa, apoi zborul: zborul are nevoie de locul pe care îl ocupă ea.
  const laClic = () => { deschide(); laDeschidere?.(fisa.getBoundingClientRect()); };
  const laTasta = (e) => { if (e.key === 'Escape' && !fisa.hidden) { e.preventDefault(); inchideFisa(); } };
  buton.addEventListener('click', laClic);
  inchide.addEventListener('click', () => inchideFisa());
  document.addEventListener('keydown', laTasta);

  // Obstacolele se pot mișca fără ca harta să se redeseneze: panoul punctului
  // crește după un clic, subsolul curge cu pagina. Atunci se cere un cadru.
  let murdar = true;
  const marcheaza = () => { murdar = true; cereRandare(); };
  const observator = typeof ResizeObserver === 'function' ? new ResizeObserver(marcheaza) : null;
  const observa = () => { for (const s of OBSTACOLE) { const o = document.querySelector(s); if (o) observator?.observe(o); } };
  observa();
  globalThis.addEventListener('scroll', marcheaza, { passive: true });
  globalThis.addEventListener('resize', marcheaza);

  const v = new THREE.Vector3();
  const pasRaza = new THREE.Vector3();
  let ultim = { x: NaN, y: NaN, mod: '' };

  /** Relieful acoperă ancora? Mers pe rază de la cameră, cu pasul de 8 m, pe `inaltimeLa`. */
  const ocluzata = () => {
    const a = new THREE.Vector3(...ancora);
    pasRaza.copy(a).sub(camera.position);
    const L = pasRaza.length();
    pasRaza.divideScalar(L);
    for (let d = 8; d < L - 8; d += 8) {
      const x = camera.position.x + pasRaza.x * d, y = camera.position.y + pasRaza.y * d, z = camera.position.z + pasRaza.z * d;
      if (inaltimeLa(x, z) > y) return true;
    }
    return false;
  };

  function pas() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    v.set(...ancora).project(camera);
    const inSpate = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * cw, y = (-v.y * 0.5 + 0.5) * ch;
    const inCadru = !inSpate && x >= 0 && x <= cw && y >= 0 && y <= ch;
    // Vizibil = are cutii de layout. NU `offsetParent !== null`: acela e null și pentru
    // un element `position: fixed` — chiar fișa, care pe telefon e foaie fixă jos —,
    // iar eticheta ajungea sub ea fără să știe.
    const obst = [...OBSTACOLE, ...(fisa.hidden ? [] : ['#sanctuar-fisa'])]
      .map((s) => document.querySelector(s)).filter((o) => o && !o.hidden && o.getClientRects().length > 0)
      .map((o) => o.getBoundingClientRect());
    const cutieCanvas = canvas.getBoundingClientRect();
    const rel = obst.map((r) => ({ left: r.left - cutieCanvas.left, right: r.right - cutieCanvas.left, top: r.top - cutieCanvas.top, bottom: r.bottom - cutieCanvas.top }));
    let mod = 'ancora';
    if (!inCadru) {
      // Spre marginea ecranului, pe direcția de la centru la ancoră. În spatele
      // camerei proiecția se oglindește, deci direcția se întoarce.
      let dx = x - cw / 2, dy = y - ch / 2;
      if (inSpate) { dx = -dx; dy = -dy; }
      const k = Math.min((cw / 2 - 24) / Math.max(Math.abs(dx), 1e-6), (ch / 2 - 24) / Math.max(Math.abs(dy), 1e-6));
      x = cw / 2 + dx * k; y = ch / 2 + dy * k;
      mod = 'margine';
      const unghi = Math.atan2(dy, dx) * 180 / Math.PI;
      sageata.textContent = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((Math.round(unghi / 45) % 8) + 8) % 8];
    } else sageata.textContent = '';
    const ocl = inCadru && ocluzata();
    if (!murdar && Math.abs(x - ultim.x) < 0.5 && Math.abs(y - ultim.y) < 0.5 && mod === ultim.mod && ocl === ultim.ocl) return;
    murdar = false;
    ultim = { x, y, mod, ocl };
    const r = buton.getBoundingClientRect();
    const loc = alegePozitie({ x, y }, { w: r.width, h: r.height }, rel, { w: cw, h: ch });
    buton.style.transform = `translate(${loc.left.toFixed(1)}px, ${loc.top.toFixed(1)}px)`;
    pin.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    radacina.dataset.mod = mod;
    radacina.dataset.pozitie = loc.nume;
    radacina.classList.toggle('ocluzat', ocl);
  }

  let viu = true;
  return {
    pas,
    deschide, inchide: () => inchideFisa(false),
    get stare() { return { deschisa: !fisa.hidden, mod: radacina.dataset.mod, pozitie: radacina.dataset.pozitie, ocluzat: radacina.classList.contains('ocluzat') }; },
    dispose() {
      if (!viu) return;
      viu = false;
      buton.removeEventListener('click', laClic);
      document.removeEventListener('keydown', laTasta);
      globalThis.removeEventListener('scroll', marcheaza);
      globalThis.removeEventListener('resize', marcheaza);
      observator?.disconnect();
      radacina.remove();
      fisa.remove();
    },
  };
}
