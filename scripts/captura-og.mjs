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
// Atribuirea întreagă merge și în fișier, ca metadate XMP: imaginea salvată și repostată singură
// o poartă cu ea. Textele vin din modala surselor a paginii fotografiate — cele scrise de
// `scrieSurse()` (main.js) din sidecaruri: textul SNIG, atribuirile, clauza Copernicus, ce s-a
// prelucrat, licențele cu adresele lor —, nu se scriu a doua oară aici. Câmpurile:
// - `dc:rights` (IPTC „Copyright Notice”): rândurile modalei, apoi nota prelucrărilor;
// - `xmpRights:UsageTerms`: licențele și portalurile datelor, cu adresele lor;
// - `xmpRights:WebStatement`: pagina (`og:url`), unde stă modala;
// - `photoshop:Credit` (IPTC „Credit Line”): rândul vizibil;
// - `dc:title` și `dc:description`: `og:title` și `og:image:alt`.
// Segmentul (APP1, „http://ns.adobe.com/xap/1.0/”) stă după JFIF; nicio dată calendaristică, deci
// aceeași pagină dă aceiași octeți.
//
// Imaginea stă pe revalidare, ca iconițele (vercel.json, docs/livrarea.md): o captură nouă se
// scrie sub același nume. Textul alternativ și dimensiunile stau în index.html, iar
// `npm run verifica-livrare` le compară cu fișierul, cu tot cu XMP-ul.

import { writeFileSync } from 'node:fs';
import { deschideEdge } from './comun/edge.mjs';

const IESIRE = 'public/og-cabo-espichel.jpg';
const W = 1200, H = 630, PRAG_KB = 300;
// Tot ce stă peste hartă, în afară de rândul surselor (#surse) și de canvas.
const ASCUNSE = ['#busola', '#straturi', '#punct', '#sanctuar-eticheta', '#sanctuar-fisa', '#versiune', '#incarcare', '.pivot-rotire'];
const NS_XMP = 'http://ns.adobe.com/xap/1.0/\0';

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const alt = (s) => `<rdf:Alt><rdf:li xml:lang="x-default">${xml(s)}</rdf:li></rdf:Alt>`;

/** Pachetul XMP, din textele paginii (`surse`, mai jos). */
function pachetXmp(s) {
  const licente = s.legaturi.filter((l) => !l.portal), portaluri = s.legaturi.filter((l) => l.portal);
  const termeni = `Licențele: ${licente.map((l) => `${l.text} (${l.href})`).join('; ')}. Datele: ${portaluri.map((l) => l.href).join('; ')}.`;
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '  <rdf:Description rdf:about=""',
    '    xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"',
    '    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">',
    `   <dc:title>${alt(s.titlu)}</dc:title>`,
    `   <dc:description>${alt(s.alt)}</dc:description>`,
    `   <dc:rights>${alt([...s.linii, s.nota].join('\n'))}</dc:rights>`,
    `   <xmpRights:UsageTerms>${alt(termeni)}</xmpRights:UsageTerms>`,
    `   <xmpRights:WebStatement>${xml(s.url)}</xmpRights:WebStatement>`,
    `   <photoshop:Credit>${xml(s.rand)}</photoshop:Credit>`,
    '  </rdf:Description>',
    ' </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="r"?>',
  ].join('\n');
}

/** JPEG-ul cu segmentul XMP pus după JFIF (APP0), sau după SOI dacă nu are JFIF. */
function cuXmp(jpeg, pachet) {
  const date = Buffer.concat([Buffer.from(NS_XMP, 'latin1'), Buffer.from(pachet, 'utf8')]);
  if (date.length + 2 > 0xffff) throw new Error(`XMP-ul are ${date.length} octeți, peste un segment`);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('captura nu e JPEG');
  const dupa = jpeg[2] === 0xff && jpeg[3] === 0xe0 ? 4 + jpeg.readUInt16BE(4) : 2;
  const antet = Buffer.from([0xff, 0xe1, 0, 0]);
  antet.writeUInt16BE(date.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, dupa), antet, date, jpeg.subarray(dupa)]);
}

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
  // Textele atribuirii, din pagina fotografiată: modala surselor și meta-urile.
  const surse = await pagina.evalueaza(`(() => {
    const corp = document.querySelector('#surse .surse-modala .corp'), nota = corp?.querySelector('p');
    const meta = (k) => document.querySelector('meta[property="' + k + '"]')?.content ?? null;
    if (!corp || !nota) return null;
    return {
      titlu: meta('og:title'), alt: meta('og:image:alt'), url: meta('og:url'),
      rand: document.querySelector('#surse .rand').textContent.trim(),
      linii: [...corp.querySelectorAll('li')].map((l) => l.textContent.trim()),
      nota: nota.textContent.trim(),
      // o legătură de după „Datele: ” e un portal; celelalte, licențele
      legaturi: [...nota.querySelectorAll('a')].map((a) => ({ text: a.textContent, href: a.href, portal: /Datele:\\s*$/.test(a.previousSibling?.textContent ?? '') })),
    };
  })()`);
  const lipsa = !surse ? ['modala surselor'] : ['titlu', 'alt', 'url'].filter((k) => !surse[k]);
  if (lipsa.length) throw new Error(`lipsesc din pagină: ${lipsa.join(', ')}`);
  if (!surse.linii.includes('Informação geográfica cedida pela Direção-Geral do Território')) throw new Error('modala n-are textul SNIG');
  const pachet = pachetXmp(surse);
  let calitate = 85, b;
  for (;; calitate -= 5) {
    const shot = await pagina.trimite('Page.captureScreenshot', { format: 'jpeg', quality: calitate, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    b = cuXmp(Buffer.from(shot.data, 'base64'), pachet);
    if (b.length <= PRAG_KB * 1000 || calitate <= 60) break;
  }
  if (b.length > PRAG_KB * 1000) throw new Error(`${(b.length / 1000).toFixed(0)} KB peste ${PRAG_KB} KB, la calitatea ${calitate}`);
  // O pagină cu erori, avertismente sau încălcări CSP în consolă nu se fotografiază pentru public.
  const probleme = pagina.probleme();
  if (probleme.length) throw new Error(`consola are ${probleme.length} probleme, imaginea nu se scrie: ${probleme.join(' | ')}`);
  writeFileSync(IESIRE, b);
  console.log(`rândul surselor: „${randul}”`);
  console.log(`XMP: ${Buffer.byteLength(pachet)} octeți — ${surse.linii.length} rânduri de atribuire, ${surse.legaturi.filter((l) => !l.portal).length} licențe, ${surse.legaturi.filter((l) => l.portal).length} portaluri`);
  console.log(`scris ${IESIRE}: ${W} × ${H}, JPEG calitatea ${calitate}, ${(b.length / 1000).toFixed(1)} KB; consola fără erori, avertismente sau încălcări CSP`);
} finally {
  await inchide();
}
