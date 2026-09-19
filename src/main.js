// Punctul de intrare. Leagă scena de conținut și de panoul de unelte — și atât.
//
// Textul e conținutul, scena îl servește. Dacă WebGL nu pornește, canvasul
// dispare și pagina rămâne o pagină, nu un ecran de eroare.
import { porneste } from './scene/scena.js';

const canvas = document.querySelector('#scena');
const continut = document.querySelector('#continut');
const unelte = document.querySelector('#unelte');

function faraScena(motiv) {
  canvas?.remove();
  unelte?.remove(); // fără scenă nu există hartă pe care să selectezi ceva
  document.body.dataset.scena = 'indisponibila';
  console.info('Pagina rulează fără scenă 3D:', motiv);
}

// ------------------------------------------------------------------ panoul

const el = {
  stare: document.querySelector('#sel-stare'),
  deseneaza: document.querySelector('#sel-deseneaza'),
  inchide: document.querySelector('#sel-inchide'),
  sus: document.querySelector('#sel-sus'),
  sterge: document.querySelector('#sel-sterge'),
  text: document.querySelector('#sel-text'),
  copiaza: document.querySelector('#sel-copiaza'),
  restrange: document.querySelector('#sel-restrange'),
};

const numar = (n) => n.toLocaleString('ro-RO');

/**
 * Textul coordonatelor — gata de lipit într-un script de extragere.
 *
 * Poligonul iese în forma exactă a constantei `POLIGON_GEO` din
 * `scripts/build-zona.mjs`, ca zona aleasă aici să se poată extrage la altă
 * rezoluție prin copiere, nu prin transcriere de mână. Cutia dreptunghiulară o
 * dă separat, pentru `scripts/fetch-dem.mjs`, care lucrează pe ferestre, nu pe
 * contururi — și care are nevoie de ea tocmai pentru că e mai largă.
 */
function textCoordonate(s) {
  if (!s.cutie) return 'Relieful încărcat nu are colțuri geografice în metadate.';
  const z = (v) => v.toFixed(4);
  const linii = [
    '// scripts/build-zona.mjs — extragere din LiDAR pe conturul exact',
    'const POLIGON_GEO = [',
    ...s.varfuri.map((v) => `  [${z(v.lon)}, ${z(v.lat)}],`),
    '];',
    '',
    '// scripts/fetch-dem.mjs — fereastra dreptunghiulară care îl cuprinde',
    `const NORD = ${z(s.cutie.nord)}, SUD = ${z(s.cutie.sud)}, ` +
      `VEST = ${z(s.cutie.vest)}, EST = ${z(s.cutie.est)};`,
  ];
  return linii.join('\n');
}

function descrie(s) {
  if (s.activ && !s.nrPuncte) return 'Pune primul punct pe hartă.';
  if (s.activ) return `${s.nrPuncte} ${s.nrPuncte === 1 ? 'punct' : 'puncte'} — încă ${Math.max(0, 3 - s.nrPuncte)} până se poate închide.`;
  if (s.inchis) return `Zonă de ${s.arie_km2} km², ${numar(s.nrTriunghiuri)} triunghiuri randate.`;
  // „Întreaga hartă" înseamnă altceva când datele au fost extrase deja pentru un
  // contur: atunci întregul e conturul acela, nu dreptunghiul din jurul lui.
  return s.areLimitaProprie
    ? `Zona extrasă, ${numar(s.nrTriunghiuri)} triunghiuri.`
    : `Harta întreagă, ${numar(s.nrTriunghiuri)} triunghiuri.`;
}

function arataStare(s) {
  el.stare.textContent = descrie(s);
  el.deseneaza.setAttribute('aria-pressed', String(s.activ));
  el.deseneaza.textContent = s.activ ? 'Renunță la desen' : 'Desenează zona';
  el.inchide.disabled = !(s.activ && s.nrPuncte >= 3);
  el.sterge.disabled = !s.nrPuncte;
  el.text.textContent = s.nrPuncte ? textCoordonate(s) : '—';
  el.copiaza.disabled = !s.nrPuncte;
}

// ------------------------------------------------------------------ pornire

try {
  const scena = await porneste(canvas, { laSelectie: arataStare });
  if (!scena) {
    faraScena('WebGL indisponibil');
  } else {
    document.body.dataset.scena = 'activa';
    unelte.hidden = false;
    el.restrange.addEventListener('click', () => {
      const restrans = unelte.dataset.restrans === 'da';
      unelte.dataset.restrans = restrans ? 'nu' : 'da';
      el.restrange.setAttribute('aria-expanded', String(restrans));
      el.restrange.textContent = restrans ? 'Restrânge' : 'Desfă';
    });
    el.deseneaza.addEventListener('click', () => scena.selectie.comuta());
    el.inchide.addEventListener('click', () => scena.selectie.inchide());
    el.sus.addEventListener('click', () => scena.selectie.vedereDeSus());
    el.sterge.addEventListener('click', () => scena.selectie.goleste());
    el.copiaza.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(el.text.textContent);
        el.copiaza.textContent = 'Copiat';
      } catch {
        // Fără permisiune pentru clipboard, selectăm textul ca să-l poată copia
        // singur — mai bine decât un buton care nu face nimic.
        getSelection()?.selectAllChildren(el.text);
        el.copiaza.textContent = 'Selectat — Ctrl+C';
      }
      setTimeout(() => { el.copiaza.textContent = 'Copiază'; }, 2000);
    });
    // Linia de bază pentru verificările de memorie de mai târziu.
    console.info('scenă pornită —', scena.teren.nrTriunghiuri, 'triunghiuri,', scena.memorie());
    globalThis.__scena = scena; // cârlig pentru verificare din consolă
  }
} catch (e) {
  faraScena(e.message);
}

if (continut && !continut.textContent.trim()) {
  continut.innerHTML =
    '<p class="provizoriu">Textul capitolelor se adaugă la pasul următor.</p>';
}
