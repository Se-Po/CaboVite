// Citirea din API-ul OpenStreetMap 0.6, cu versiuni fixate.
//
// Datele OSM se schimbă oricând, deci o geometrie citită „acum" nu se poate reface
// mâine. Versiunile, însă, sunt imuabile: /way/{id}/{v} și nodes.json?nodes=IDvV
// întorc exact aceleași coordonate peste un an. De aceea instantaneul sanctuarului
// ține, pentru fiecare cale și fiecare nod, versiunea, iar o a doua rulare din acel
// manifest trebuie să dea aceeași geometrie, la octet.
//
// Fără Overpass: la cercetare a căzut de două ori cu 504, pe două servere. API-ul
// principal e pentru editare, nu pentru descărcări în masă, deci cererile de aici
// stau sub una pe secundă, cu User-Agent propriu și cu așteptare la 429 și 5xx.
// Totul e ODbL 1.0; cine scrie ce iese de aici poartă licența mai departe.

const API = 'https://api.openstreetmap.org/api/0.6';
const UA = 'CaboVite-v2/0.0.9 (pagina despre Cabo Espichel; citire)';
const PAUZA_MS = 1100;
let ultima = 0;

/** Un GET pe API, cu pauza minimă între cereri și reîncercări la 429 / 5xx. */
export async function cereOsm(cale, { text = false } = {}) {
  for (let incercare = 0; ; incercare++) {
    const asteapta = ultima + PAUZA_MS - Date.now();
    if (asteapta > 0) await new Promise((r) => setTimeout(r, asteapta));
    ultima = Date.now();
    const r = await fetch(API + cale, { headers: { 'User-Agent': UA } });
    if (r.ok) return text ? r.text() : r.json();
    if ((r.status === 429 || r.status >= 500) && incercare < 5) {
      const sec = Number(r.headers.get('retry-after')) || 2 ** incercare * 5;
      console.warn(`  OSM ${r.status} la ${cale}; reîncerc peste ${sec} s`);
      await new Promise((res) => setTimeout(res, sec * 1000));
      continue;
    }
    throw new Error(`OSM ${r.status} la ${cale}`);
  }
}

/** Nodurile cerute ca [id, versiune], cu multi-fetch în bucăți de câte 150. */
export async function noduriVersionate(perechi) {
  const out = new Map();
  for (let i = 0; i < perechi.length; i += 150) {
    const q = perechi.slice(i, i + 150).map(([id, v]) => `${id}v${v}`).join(',');
    const j = await cereOsm(`/nodes.json?nodes=${q}`);
    for (const e of j.elements) out.set(e.id, e);
  }
  for (const [id, v] of perechi) {
    const n = out.get(id);
    if (!n || n.version !== v) throw new Error(`nodul ${id} v${v} n-a venit din API`);
  }
  return out;
}

/** Versiunea valabilă la un moment dat, dintr-un istoric; `null` dacă nu exista încă. */
export function laMoment(istoric, iso) {
  let ales = null;
  for (const e of istoric) if (e.timestamp <= iso) ales = e;
  return ales && ales.visible !== false ? ales : null;
}

/** Istoricul unui element (toate versiunile). */
export async function istoric(tip, id) {
  return (await cereOsm(`/${tip}/${id}/history.json`)).elements;
}

/**
 * Nodurile modificate de un changeset, cu versiunea pe care au primit-o acolo.
 * Din osmChange (XML), fiindcă API-ul nu dă descărcarea în JSON.
 */
export async function noduriModificate(changeset) {
  const x = await cereOsm(`/changeset/${changeset}/download`, { text: true });
  const out = new Map();
  for (const [, corp] of x.matchAll(/<modify>([\s\S]*?)<\/modify>/g))
    for (const m of corp.matchAll(/<node id="(\d+)"[^>]*?version="(\d+)"/g)) out.set(Number(m[1]), Number(m[2]));
  return out;
}

/** Suprafața închisă de o cale: primul nod e și ultimul. */
export const inchisa = (w) => w.nodes.length > 3 && w.nodes[0] === w.nodes[w.nodes.length - 1];

/**
 * Poligon simplu: nicio pereche de laturi neînvecinate nu se atinge.
 * Pe coordonate plane (TM06), O(n²) — poligoanele de aici au sub 60 de vârfuri.
 */
export function esteSimplu(p) {
  const n = p.length - 1; // ultimul repetă primul
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const seTaie = (a, b, c, d) => {
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 && d2 && d3 && d4;
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (seTaie(p[i], p[i + 1], p[j], p[j + 1])) return false;
    }
  // Vârfuri repetate (altele decât închiderea) fac poligonul să se atingă singur.
  const chei = new Set(p.slice(0, n).map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`));
  return chei.size === n;
}
