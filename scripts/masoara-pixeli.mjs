// Două măsurători pe pixelii paginii construite, în Edge fără interfață (scripts/comun/edge.mjs):
//
//   npm run build && npm run masoara-pixeli
//
// 1. Haloul focusului. Butoanele de peste hartă — busola, Satelit, „Coordonate”, eticheta
//    sanctuarului — și rândul surselor au, la `:focus-visible`, un inel de 3 px la 2 px de
//    margine, pe un halou `0 0 0 7px var(--bg)` (main.css). Cu focusul adus de la tastatură (Tab),
//    se citesc din captură, la mijlocul FIECĂREI laturi: haloul dintre buton și inel, inelul,
//    haloul de dincolo de inel și harta de dincolo de halou. Contrastul WCAG al inelului față de
//    halou, de ambele părți, trebuie să fie cel puțin 3:1 (WCAG 1.4.11) pe toate cele patru laturi;
//    cel față de hartă arată de ce e nevoie de halou. Două controale pică: busola fără halou și
//    rândul surselor fără `z-index`, unde separatorul „·” taie inelul pe dreapta.
// 2. Golul dintre axe în panoul „Coordonate”, la 14 px (0,875rem), pe ecranul îngust: 195 × 422 CSS
//    la DPR 2 — un telefon de 390 px cu pagina mărită de două ori —, cu bara de defilare clasică pe
//    care o are Edge pe Windows. Pe rândurile scenă și TM06, cu valorile unui clic adevărat și cu
//    cele mai lungi: golul dintre axele de pe aceeași linie, câte linii, nicio axă ruptă, nicio
//    depășire. Pragul golului, 4 px, e o alegere; lățimea unui spațiu se tipărește alături.
//
// Nu scrie nimic în depozit: cifrele se tipăresc, iar docs/ le citează.

import { deschideEdge } from './comun/edge.mjs';

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = (c) => c ? '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') : '—';
const zec = (v) => v === null ? '—' : v.toFixed(1).replace('.', ',');
const unice = (v) => [...new Set(v.filter(Boolean).map(hex))].join(', ');
const gata = `document.body.dataset.scena === 'activa' && document.querySelector('#straturi button')?.getAttribute('aria-pressed') === 'true'`;
const DOUA_CADRE = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

// Benzile, în px CSS de la marginea țintei: haloul dinăuntru (1), mijlocul inelului (offset 2 +
// grosimea 3 / 2), haloul de dincolo (6, sub cei 7 ai haloului) și harta (10).
const BENZI = { h1: 1, inel: 3.5, h2: 6, harta: 10 };
const LATURI = ['stânga', 'dreapta', 'sus', 'jos'];

/** Benzile la mijlocul fiecărei laturi, în pixeli de dispozitiv; un eșantion în afara capturii e null. */
function laturi(img, { l, t, w, h }, d) {
  const loc = (i, off) => [[l - off, t + h / 2], [l + w + off, t + h / 2], [l + w / 2, t - off], [l + w / 2, t + h + off]][i];
  return LATURI.map((nume, i) => {
    const e = Object.fromEntries(Object.entries(BENZI).map(([k, off]) => [k, img.px(...loc(i, off).map((v) => Math.floor(v * d)))]));
    const c = e.inel && e.h1 && e.h2 ? Math.min(contrast(e.inel, e.h1), contrast(e.inel, e.h2)) : null;
    return { nume, ...e, c, cHarta: e.inel && e.harta ? contrast(e.inel, e.harta) : null };
  });
}
const bunHalou = (L) => L.every((x) => x.c !== null && x.c >= 3);
function descrieHalou(L) {
  const slab = L.reduce((a, b) => ((b.c ?? -1) < (a.c ?? -1) ? b : a));
  return `inelul ${unice(L.map((x) => x.inel))}, haloul ${unice(L.flatMap((x) => [x.h1, x.h2]))}; pe laturi (${LATURI.join(' · ')}) `
    + `${L.map((x) => zec(x.c)).join(' · ')}:1; cea mai slabă: ${slab.nume} (${hex(slab.h1)} | ${hex(slab.inel)} | ${hex(slab.h2)})`;
}
const descrieHarta = (L) => `fără halou, inelul pe harta de dincolo: ${L.map((x) => zec(x.cHarta)).join(' · ')}:1`
  + `${L.some((x) => !x.harta) ? ` (— : în afara ecranului, pe ${L.filter((x) => !x.harta).map((x) => x.nume).join(', ')})` : ''}`;

const { pagina, inchide } = await deschideEdge({ latime: 1280, inaltime: 800, dpr: 2 });
try {
  // ---------------------------------------------------------------------- 1. haloul
  console.log('\nHaloul focusului, pe pixeli (1280 × 800 CSS, DPR 2)');
  await pagina.du();
  if (!await pagina.panaCand(gata, 120_000)) throw new Error('harta n-a apărut pe Satelit');
  const TINTE = { busola: '#busola .roza', Satelit: '#straturi button', 'Coordonate': '#punct .activeaza', eticheta: '#sanctuar-eticheta .poi', surse: '#surse .atribuire' };
  const cuFocus = `(() => { const a = document.activeElement; for (const [k, s] of Object.entries(${JSON.stringify(TINTE)})) if (a && a.matches(s) && a.matches(':focus-visible')) { const r = a.getBoundingClientRect(); return { k, r: { l: r.left, t: r.top, w: r.width, h: r.height } }; } return null; })()`;
  const masoara = async (r) => { await pagina.evalueaza(DOUA_CADRE); return laturi(await pagina.captura(), r, 2); };
  // focusul pe o țintă, adus numai cu Tab
  const aduFocusul = async (k) => {
    for (let t = 0; t < 40; t++) {
      const x = await pagina.evalueaza(cuFocus);
      if (x?.k === k) return x;
      await pagina.tasta('Tab', 'Tab', 9);
    }
    throw new Error(`${k} nu primește focusul de la Tab`);
  };
  const masurate = new Map();
  for (let t = 0; t < 40 && masurate.size < Object.keys(TINTE).length; t++) {
    await pagina.tasta('Tab', 'Tab', 9);
    const x = await pagina.evalueaza(cuFocus);
    if (!x || masurate.has(x.k)) continue;
    const L = await masoara(x.r);
    masurate.set(x.k, L);
    proba(bunHalou(L), `${x.k}: ${descrieHalou(L)}`);
    console.log(`        ${descrieHarta(L)}`);
  }
  const lipsa = Object.keys(TINTE).filter((k) => !masurate.has(k));
  proba(lipsa.length === 0, `toate cele ${Object.keys(TINTE).length} ținte primesc focusul de la Tab${lipsa.length ? `; fără: ${lipsa.join(', ')}` : ''}`);

  // Controalele: aceeași măsurătoare pe o greșeală cunoscută, pusă printr-o foaie construită.
  for (const [ce, k, regula] of [
    ['busola fără halou', 'busola', '#busola .roza:focus-visible { box-shadow: none !important; }'],
    ['rândul surselor fără z-index, cum era', 'surse', '#surse .atribuire:focus-visible { position: static !important; z-index: auto !important; }'],
  ]) {
    await pagina.evalueaza(`(() => { const s = new CSSStyleSheet(); s.replaceSync(${JSON.stringify(regula)}); window.__control = s; document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; })()`);
    const L = await masoara((await aduFocusul(k)).r);
    await pagina.evalueaza('document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== window.__control)');
    proba(!bunHalou(L), `control, ${ce}: ${descrieHalou(L)} — pică`);
  }

  // ---------------------------------------------------------------------- 2. golul dintre axe
  console.log('\nGolul dintre axe în panoul „Coordonate” (195 × 422 CSS, DPR 2)');
  await pagina.ecran(195, 422, 2);
  await pagina.du();
  if (!await pagina.panaCand(gata, 120_000)) throw new Error('harta n-a apărut pe Satelit');
  const centru = (s) => pagina.evalueaza(`(() => { const e = document.querySelector(${JSON.stringify(s)}); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  const buton = await centru('#punct .activeaza');
  if (!buton) throw new Error('butonul „Coordonate” nu se vede');
  await pagina.clic(...buton);
  const deschis = `!document.querySelector('#punct .cutie')?.hidden && !!document.querySelector('#punct .mici')?.getClientRects().length`;
  if (!await pagina.panaCand(deschis, 5000)) throw new Error('panoul „Coordonate” nu s-a deschis');
  // un clic pe hartă: primul punct sub care stă chiar canvasul — nu rândul surselor, care pe ecranul
  // îngust are trei linii, nici panoul deschis, care acoperă aproape tot ecranul
  const tinta = await pagina.evalueaza(`(() => { const c = document.querySelector('#scena'); for (let y = innerHeight - 4; y > 120; y -= 6) for (let x = 10; x < innerWidth - 10; x += 10) if (document.elementFromPoint(x, y) === c) return [x, y]; return null; })()`);
  if (!tinta) throw new Error('niciun punct liber de hartă pe ecranul îngust');
  await pagina.clic(...tinta);
  if (!await pagina.panaCand(`document.querySelector('#punct .cutie')?.dataset.stare === 'punct'`, 5000)) throw new Error('clicul pe hartă n-a cules niciun punct');
  await pagina.evalueaza(DOUA_CADRE);
  const MASOARA = `(() => {
    const p = document.querySelector('#punct'), box = p.querySelector('.cutie');
    const st = getComputedStyle(box);
    const randuri = [...p.querySelectorAll('.mici dd')].map((dd) => {
      const ax = [...dd.querySelectorAll('.axa')];
      const rr = ax.map((a) => { const r = a.getBoundingClientRect(); return { t: Math.round(r.top), l: r.left, r: r.right, rupta: a.getClientRects().length > 1, text: a.textContent }; });
      const goluri = []; for (let k = 1; k < rr.length; k++) if (rr[k].t === rr[k - 1].t) goluri.push(rr[k].l - rr[k - 1].r);
      return { linii: new Set(rr.map((x) => x.t)).size, goluri, rupte: rr.filter((x) => x.rupta).length, depaseste: dd.scrollWidth > dd.clientWidth, text: rr.map((x) => x.text).join(' | '), font: getComputedStyle(dd).fontSize };
    });
    const dd = p.querySelector('.mici dd'), f = getComputedStyle(dd), ctx = document.createElement('canvas').getContext('2d');
    ctx.font = f.fontStyle + ' ' + f.fontWeight + ' ' + f.fontSize + ' ' + f.fontFamily;
    return { bara: box.offsetWidth - box.clientWidth - parseFloat(st.borderLeftWidth) - parseFloat(st.borderRightWidth), defilare: document.documentElement.scrollWidth > document.documentElement.clientWidth, spatiu: ctx.measureText(' ').width, randuri };
  })()`;
  const descrie = (m) => m.randuri.map((x) => `„${x.text}” ${x.linii} ${x.linii === 1 ? 'linie' : 'linii'}, goluri ${x.goluri.map(zec).join(' / ') || '— (câte o axă pe linie)'} px`).join('; ');
  const bun = (m) => m.randuri.length >= 2 && m.randuri.some((x) => x.goluri.length > 0)
    && m.randuri.every((x) => x.rupte === 0 && !x.depaseste && x.font === '14px' && x.goluri.every((g) => g >= 4)) && !m.defilare;
  const real = await pagina.evalueaza(MASOARA);
  console.log(`        clic pe hartă în (${tinta.join(', ')}); un spațiu are ${zec(real.spatiu)} px la 14 px`);
  proba(real.bara >= 10, `bara de defilare clasică a panoului: ${real.bara} px (măsurătoarea e cu ea)`);
  proba(bun(real), `valorile clicului: ${descrie(real)}; nicio axă ruptă, nimic peste margine, pagina fără defilare orizontală`);
  await pagina.evalueaza(`(() => { const L = { sc: ['X −1163,00', 'Y 168,28', 'Z −1492,00'], tm: ['X −95790,00', 'Y −138900,00'] }; for (const [k, v] of Object.entries(L)) document.querySelectorAll('#punct .' + k + ' .axa').forEach((a, i) => { a.textContent = v[i]; }); })()`);
  await pagina.evalueaza(DOUA_CADRE);
  const lungi = await pagina.evalueaza(MASOARA);
  proba(bun(lungi), `valorile cele mai lungi: ${descrie(lungi)}`);
  const probleme = pagina.probleme();
  proba(probleme.length === 0, `consola fără erori, avertismente sau încălcări CSP${probleme.length ? `: ${probleme.join(' | ')}` : ''}`);
} finally {
  await inchide();
}
console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exitCode = picate ? 1 : 0;
