// Imaginea de previzualizare a paginii (`og:image`): harta pe Satelit, din vederea de pornire.
//
//   npm run build && npm run captura-og
//
// Scrie public/og-cabo-espichel.jpg, 1200 × 630 (raportul cerut de Open Graph și de rețele), cel
// mult PRAG_KB. Pagina se deschide în Edge fără interfață, cu un profil temporar
// (scripts/comun/edge.mjs), pe build-ul servit local. Panourile de peste hartă — busola, Satelit,
// „Coordonate”, eticheta sanctuarului, versiunea — se ascund; rămâne rândul surselor
// („© DGT · © Copernicus · © OpenStreetMap”), pe care licențele îl cer oriunde se arată harta.
//
// Imaginea stă pe revalidare, ca iconițele (vercel.json, docs/livrarea.md): o captură nouă se
// scrie sub același nume. Textul alternativ și dimensiunile stau în index.html, iar
// `npm run verifica-livrare` le compară cu fișierul.

import { writeFileSync } from 'node:fs';
import { deschideEdge } from './comun/edge.mjs';

const IESIRE = 'public/og-cabo-espichel.jpg';
const W = 1200, H = 630, PRAG_KB = 300;
// Tot ce stă peste hartă, în afară de rândul surselor (#surse) și de canvas.
const ASCUNSE = ['#busola', '#straturi', '#punct', '#sanctuar-eticheta', '#sanctuar-fisa', '#versiune', '#incarcare', '.pivot-rotire'];

const { pagina, inchide } = await deschideEdge({ latime: W, inaltime: H });
try {
  await pagina.du();
  const gl = await pagina.evalueaza(`(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return null; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })()`);
  if (!gl) throw new Error('Edge n-are WebGL2 aici: harta nu se poate desena, deci nici captura');
  console.log(`WebGL2: ${gl}`);
  const gata = await pagina.panaCand(`document.body.dataset.scena === 'activa' && document.querySelector('#straturi button')?.getAttribute('aria-pressed') === 'true'`, 120_000);
  if (!gata) throw new Error(`harta n-a apărut pe Satelit în 120 s (data-scena „${await pagina.evalueaza('document.body.dataset.scena')}”)`);
  // Panourile pleacă printr-o foaie construită (CSSOM, `adoptedStyleSheets`), nu printr-un <style>,
  // pe care CSP-ul l-ar raporta; harta nu se redesenează, fiindcă nu s-a schimbat nimic din ea.
  await pagina.evalueaza(`(() => { const s = new CSSStyleSheet(); s.replaceSync(${JSON.stringify(`${ASCUNSE.join(', ')} { display: none !important; }`)}); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; })()`);
  await pagina.evalueaza('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  const randul = await pagina.evalueaza(`(() => { const r = document.querySelector('#surse .rand'); return r && r.getClientRects().length ? r.textContent.trim() : null; })()`);
  if (!randul) throw new Error('rândul surselor nu se vede');
  const vizibile = await pagina.evalueaza(`${JSON.stringify(ASCUNSE)}.filter((s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length))`);
  if (vizibile.length) throw new Error(`panouri rămase la vedere: ${vizibile.join(', ')}`);
  let calitate = 85, b;
  for (;; calitate -= 5) {
    const shot = await pagina.trimite('Page.captureScreenshot', { format: 'jpeg', quality: calitate, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    b = Buffer.from(shot.data, 'base64');
    if (b.length <= PRAG_KB * 1000 || calitate <= 60) break;
  }
  if (b.length > PRAG_KB * 1000) throw new Error(`${(b.length / 1000).toFixed(0)} KB peste ${PRAG_KB} KB, la calitatea ${calitate}`);
  // O pagină cu erori, avertismente sau încălcări CSP în consolă nu se fotografiază pentru public.
  const probleme = pagina.probleme();
  if (probleme.length) throw new Error(`consola are ${probleme.length} probleme, imaginea nu se scrie: ${probleme.join(' | ')}`);
  writeFileSync(IESIRE, b);
  console.log(`rândul surselor: „${randul}”`);
  console.log(`scris ${IESIRE}: ${W} × ${H}, JPEG calitatea ${calitate}, ${(b.length / 1000).toFixed(1)} KB; consola fără erori, avertismente sau încălcări CSP`);
} finally {
  await inchide();
}
