// Previzualizarea datelor din care se face culoarea terenului.
//
//   ?previzualizare=ndvi
//
// Pictează NDVI-ul fiecărei fațete în locul culorii. E proba vizuală că stratul
// stă unde trebuie: vegetația pe platou și pe versanții blânzi, nu urcată pe
// peretele falezei și nici deplasată față de relief. Ce se vede aici nu e
// terenul, deci scara e VĂDIT nenaturală — nimeni nu trebuie s-o ia drept culori.
//
// Fără parametrul din adresă modulul nu face nimic, iar plasa iese cu regula
// adevărată. Se șterge fișierul împreună cu cele trei rânduri din scena.js, iar
// pagina rămâne întreagă.

/** Modul cerut în adresă, sau null. */
export function modPrevizualizare() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('previzualizare');
  } catch {
    return null;
  }
}

// Opririle scării: viridis, eșantionat în cinci puncte. Pragurile regulii de
// culoare cad între ele: 0,017 (roca), 0,261 (vegetația uscată), 0,410 (tufărișul).
const OPRIRI = [
  [-0.10, 0x440154],
  [0.10, 0x3b528b],
  [0.20, 0x21918c],
  [0.35, 0x5ec962],
  [0.50, 0xfde725],
];
// Fațetele fără NDVI: apă, strat lipsă. Magenta nu apare nicăieri în viridis.
const FARA = 0xff00ff;

function scara(v) {
  if (v <= OPRIRI[0][0]) return OPRIRI[0][1];
  for (let i = 1; i < OPRIRI.length; i++) {
    const [v1, c1] = OPRIRI[i];
    if (v > v1) continue;
    const [v0, c0] = OPRIRI[i - 1];
    const t = (v - v0) / (v1 - v0);
    const canal = (d) => Math.round(((c0 >> d) & 255) + (((c1 >> d) & 255) - ((c0 >> d) & 255)) * t) << d;
    return canal(16) | canal(8) | canal(0);
  }
  return OPRIRI[OPRIRI.length - 1][1];
}

/** Funcția de culoare pentru modul dat, sau undefined dacă nu e cerut niciunul. */
export function culoarePrevizualizare(mod) {
  if (!mod) return undefined;
  if (mod === 'ndvi') return (panta, altitudine, p, ndvi) => (Number.isFinite(ndvi) ? scara(ndvi) : FARA);
  console.warn(`previzualizare necunoscută: „${mod}". Există: ndvi.`);
  return undefined;
}

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/** Legenda, în colț. Întoarce un obiect cu dispose(). */
export function creeazaLegenda(gazda, mod) {
  const el = document.createElement('aside');
  el.id = 'legenda';
  el.setAttribute('aria-label', 'Legenda previzualizării');
  const gradient = OPRIRI.map(([v, c]) => `${hex(c)} ${((v - OPRIRI[0][0]) / (OPRIRI.at(-1)[0] - OPRIRI[0][0]) * 100).toFixed(0)}%`).join(', ');
  el.innerHTML = `
    <p class="titlu">Previzualizare: ${mod === 'ndvi' ? 'NDVI din ortofoto' : mod}</p>
    <div class="bara" style="background: linear-gradient(to right, ${gradient})"></div>
    <div class="capete"><span>≤ −0,10 rocă</span><span>≥ 0,50 verde</span></div>
    <p class="fara"><span class="mostra" style="background: ${hex(FARA)}"></span>fără NDVI (apă sau strat lipsă)</p>`;
  gazda.appendChild(el);
  return { dispose() { el.remove(); } };
}
