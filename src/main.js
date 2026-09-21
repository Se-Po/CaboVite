// Punctul de intrare. Leagă scena de conținut — și atât.
//
// Textul e conținutul, scena îl servește. Dacă WebGL nu pornește, canvasul
// dispare și pagina rămâne o pagină, nu un ecran de eroare.
import { porneste } from './scene/scena.js';

const canvas = document.querySelector('#scena');
const continut = document.querySelector('#continut');

function faraScena(motiv) {
  canvas?.remove();
  document.querySelector('#unelte')?.remove();
  document.body.dataset.scena = 'indisponibila';
  console.info('Pagina rulează fără scenă 3D:', motiv);
}

// ------------------------------------------------------------------ unealta
//
// Tot blocul ăsta e panoul selectorului. Se șterge de aici, din index.html și
// din main.css, iar pagina redevine curat narativă — decupajul hărții nu atârnă
// de el, acela trăiește în datele hărții și în scena.js.

const el = (id) => document.getElementById(id);

function legPanoul(scena) {
  const panou = el('unelte');
  if (!panou) return;
  panou.hidden = false;

  const sel = scena.selectie;
  const cifre = el('sel-cifre');
  const cod = el('sel-cod');
  const jos = el('sel-jos');
  const sus = el('sel-sus-m');
  const comuta = el('sel-comuta');

  const linie = (t, v) => `<dt>${t}</dt><dd>${v}</dd>`;

  function arata(s) {
    comuta.setAttribute('aria-pressed', String(s.activ));
    comuta.textContent = s.activ ? 'Gata' : 'Selectează';

    if (!s.are) {
      cifre.innerHTML = linie('triunghiuri', s.nrTriunghiuri.toLocaleString('ro-RO'))
        + linie('selecție', 'toată harta');
      cod.value = '';
      jos.value = ''; sus.value = '';
      return;
    }

    // Câmpurile nu se rescriu cât timp le tastezi: ar muta cursorul sub degete.
    if (document.activeElement !== jos) jos.value = s.banda_m[0];
    if (document.activeElement !== sus) sus.value = s.banda_m[1];

    cifre.innerHTML =
      linie('mărime', `${s.latime_m} × ${s.adancime_m} m`)
      + linie('arie', `${s.arie_km2} km²`)
      + linie('altitudine', `${s.banda_m[0]} … ${s.banda_m[1]} m`)
      + linie('triunghiuri', s.nrTriunghiuri.toLocaleString('ro-RO'));

    const c = s.colturi.map((p) => `[${p.lon}, ${p.lat}]`).join(', ');
    cod.value =
      `// scripts/build-zona.mjs — conturul, nv → ne → se → sv\n`
      + `const POLIGON_GEO = [\n  ${c.replace(/\], \[/g, '],\n  [')}\n];\n\n`
      + `// banda de altitudine, metri deasupra nivelului mării\n`
      + `const BANDA_ALTITUDINE = { min: ${s.banda_m[0]}, max: ${s.banda_m[1]} };\n\n`
      + `// cutia TM06 (EPSG:3763), pentru verificare\n`
      + `// x ${s.tm06.xMin} … ${s.tm06.xMax}   y ${s.tm06.yMin} … ${s.tm06.yMax}\n`;
  }

  comuta.addEventListener('click', () => sel.comuta());
  el('sel-tot').addEventListener('click', () => sel.tot());
  el('sel-goleste').addEventListener('click', () => sel.goleste());
  el('sel-sus').addEventListener('click', () => sel.vedereDeSus());

  // Banda se aplică la `change`, nu la `input`: fiecare aplicare regenerează
  // plasa, iar pe tastat ar însemna o regenerare la fiecare cifră.
  const banda = () => sel.seteazaBanda(Number(jos.value), Number(sus.value));
  jos.addEventListener('change', banda);
  sus.addEventListener('change', banda);

  el('sel-copiaza').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(cod.value);
      e.target.textContent = 'Copiat';
      setTimeout(() => { e.target.textContent = 'Copiază'; }, 1400);
    } catch {
      cod.select(); // fără permisiune de clipboard, măcar îl selectăm
    }
  });

  return arata;
}

// --------------------------------------------------------------------- start

let arataPanoul = null;

try {
  const scena = await porneste(canvas, (s) => arataPanoul?.(s));
  if (!scena) {
    faraScena('WebGL indisponibil');
  } else {
    document.body.dataset.scena = 'activa';
    arataPanoul = legPanoul(scena);
    arataPanoul?.(scena.selectie.stare());
    // Linia de bază pentru verificările de memorie de mai târziu.
    console.info('scenă pornită —', scena.nrTriunghiuri, 'triunghiuri',
      scena.petic ? `(bază ${scena.teren.nrTriunghiuri} + petic ${scena.petic.nrTriunghiuri})` : '',
      scena.memorie());
    globalThis.__scena = scena; // cârlig pentru verificare din consolă
  }
} catch (e) {
  faraScena(e.message);
}

if (continut && !continut.textContent.trim()) {
  continut.innerHTML =
    '<p class="provizoriu">Textul capitolelor se adaugă la pasul următor.</p>';
}
