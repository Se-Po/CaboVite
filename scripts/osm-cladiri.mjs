// Instantaneul OpenStreetMap al clădirilor din cutia hărții, în afara sanctuarului.
//
//   npm run osm-cladiri                      citește starea de azi, scrie instantaneul
//                                            și manifestul versiunilor
//   npm run osm-cladiri -- --din-manifest    îl reface numai din versiunile din manifest
//                                            și cere să iasă identic
//
// Ce iese:
//   date-sursa/osm/cladiri-osm-<data>.json   geometria, cu versiunile; nu se suprascrie
//   scripts/cladiri/osm-manifest.json        [tip, id, versiune] + versiunea fiecărui nod
//
// Ce intră: căile cu `building` sau `man_made=lighthouse` din cutia lui harta_v4,
// minus cele din manifestul sanctuarului, care e modelat separat. Manifestul
// sanctuarului NU se atinge: osm-sanctuar și-l rescrie la fiecare rulare, deci un
// profil separat, cu fișierele lui.
//
// Changesetul 120423250 („Update Cabo Espichel”, 2022-05-01) a retrasat o parte din
// complex; pentru fiecare cale de aici se notează dacă a atins-o, iar poziția se
// verifică oricum pe LiDAR (build-cladiri: amprenta față de nMDS).
//
// Licența: ODbL 1.0, © contribuitorii OpenStreetMap.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cereOsm, esteSimplu, inchisa, istoric, noduriVersionate } from './comun/osm.mjs';
import { arie, laTM06 } from './comun/tm06.mjs';

const HARTA = 'public/data/harta_v4-dem.json';
const MANIFEST = 'scripts/cladiri/osm-manifest.json';
const MANIFEST_SANCTUAR = 'scripts/sanctuar/osm-manifest.json';
const DIR = 'date-sursa/osm';
const CONTESTAT = 120423250;
const LICENTA = { licenta: 'ODbL 1.0', url: 'https://opendatacommons.org/licenses/odbl/1-0/', atributie: '© contribuitorii OpenStreetMap' };

const meta = JSON.parse(readFileSync(HARTA, 'utf8'));
const g = meta.colturi_geo;
const CUTIE = [Math.min(g.nv.lon, g.sv.lon), Math.min(g.sv.lat, g.se.lat), Math.max(g.ne.lon, g.se.lon), Math.max(g.nv.lat, g.ne.lat)];
const b = meta.bbox_tm06;
const inCutie = ([x, y]) => x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax;
const tm = (lat, lon) => { const p = laTM06(lon, lat); return [p.x, p.y]; };

const sanctuar = new Set(JSON.parse(readFileSync(MANIFEST_SANCTUAR, 'utf8')).elemente.map((e) => `${e.tip}/${e.id}`));
const sePastreaza = (e) => e.type === 'way' && (e.tags?.building || e.tags?.man_made === 'lighthouse') && !sanctuar.has(`way/${e.id}`);

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

async function dinApi() {
  const [w, s, e, n] = CUTIE;
  console.log(`Starea de azi, din /map, pe cutia ${CUTIE.map((v) => v.toFixed(5)).join(', ')} …`);
  const harta = await cereOsm(`/map.json?bbox=${w},${s},${e},${n}`);
  const noduri = new Map(harta.elements.filter((x) => x.type === 'node').map((x) => [x.id, x]));
  const elemente = [];
  for (const x of harta.elements.filter(sePastreaza)) {
    const nd = x.nodes.map((id) => { const d = noduri.get(id); return [id, d.version, d.lat, d.lon]; });
    const c = nd.map(([, , la, lo]) => tm(la, lo));
    const centru = c.reduce((q, p) => [q[0] + p[0] / c.length, q[1] + p[1] / c.length], [0, 0]);
    if (!inCutie(centru)) continue;
    const ist = await istoric('way', x.id);
    elemente.push({ tip: 'way', id: x.id, v: x.version, timestamp: x.timestamp, tags: x.tags, noduri: nd,
      in_changeset_contestat: ist.some((v) => v.changeset === CONTESTAT) });
  }
  return elemente.sort((p, q) => p.id - q.id);
}

async function dinManifest(man) {
  const perechi = man.elemente.flatMap((el) => el.noduri.map(([id, v]) => [id, v]));
  const noduriV = await noduriVersionate([...new Map(perechi.map((p) => [`${p[0]}v${p[1]}`, p])).values()]);
  const out = [];
  for (const el of man.elemente) {
    const w = (await cereOsm(`/way/${el.id}/${el.v}.json`)).elements[0];
    if (w.nodes.join() !== el.noduri.map(([id]) => id).join()) throw new Error(`calea ${el.id} v${el.v}: lista de noduri diferă de manifest`);
    out.push({ tip: 'way', id: w.id, v: w.version, timestamp: w.timestamp, tags: w.tags,
      noduri: el.noduri.map(([id, v]) => { const d = noduriV.get(id); return [id, v, d.lat, d.lon]; }), in_changeset_contestat: el.in_changeset_contestat });
  }
  return out;
}

const geometrie = (els) => JSON.stringify(els.map(({ tip, id, v, tags, noduri }) => ({ tip, id, v, tags, noduri })));

function probe(els) {
  console.log('\nProbe');
  const nes = els.filter((el) => inchisa({ nodes: el.noduri.map(([id]) => id) }) && !esteSimplu(el.noduri.map(([, , la, lo]) => tm(la, lo))));
  proba(nes.length === 0, `poligoanele sunt simple${nes.length ? ': ' + nes.map((x) => x.id).join(', ') : ''}`);
  const deschise = els.filter((el) => !inchisa({ nodes: el.noduri.map(([id]) => id) }));
  proba(deschise.length === 0, `toate căile sunt închise${deschise.length ? ': ' + deschise.map((x) => x.id).join(', ') : ''}`);
  console.log(`\n${els.length} clădiri în cutie, în afara sanctuarului:`);
  for (const el of els) {
    const c = el.noduri.map(([, , la, lo]) => tm(la, lo)), A = arie(c.map(([x, y]) => ({ x, y })));
    const cx = c.reduce((q, p) => q + p[0] / c.length, 0), cy = c.reduce((q, p) => q + p[1] / c.length, 0);
    const et = Object.entries(el.tags ?? {}).filter(([k]) => ['building', 'man_made', 'name', 'height', 'ruins', 'historic'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`  ${String(el.id).padStart(10)} v${el.v}  ${A.toFixed(0).padStart(5)} m²  (${cx.toFixed(0)}; ${cy.toFixed(0)})  ${et}${el.in_changeset_contestat ? '  [atinsă în 120423250]' : ''}`);
  }
}

if (process.argv.includes('--din-manifest')) {
  const man = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const cale = `${DIR}/${man.fisier}`;
  if (!existsSync(cale)) throw new Error(`lipsește ${cale}; rulează întâi fără --din-manifest`);
  const salvat = JSON.parse(readFileSync(cale, 'utf8'));
  const refacut = await dinManifest(man);
  proba(geometrie(refacut) === geometrie(salvat.elemente), `instantaneul refăcut din manifest e identic cu ${man.fisier} (${refacut.length} elemente)`);
  probe(salvat.elemente);
} else {
  const elemente = await dinApi();
  const data = new Date().toISOString().slice(0, 10);
  const fisier = `cladiri-osm-${data}.json`;
  mkdirSync(DIR, { recursive: true });
  if (existsSync(`${DIR}/${fisier}`)) throw new Error(`${DIR}/${fisier} există; un instantaneu nu se suprascrie`);
  writeFileSync(`${DIR}/${fisier}`, JSON.stringify({ generat: new Date().toISOString(), cutie_lonlat: CUTIE, harta: meta.nume, ...LICENTA, elemente }, null, 1));
  mkdirSync('scripts/cladiri', { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    nota: 'Versiunile OSM ale clădirilor din afara sanctuarului, în cutia lui harta_v4. ODbL 1.0, © contribuitorii OpenStreetMap.',
    fisier, ...LICENTA,
    elemente: elemente.map(({ tip, id, v, noduri, in_changeset_contestat }) => ({ tip, id, v, noduri: noduri.map(([i, vv]) => [i, vv]), in_changeset_contestat })),
  }, null, 1));
  console.log(`scris ${DIR}/${fisier} și ${MANIFEST}`);
  probe(elemente);
}
console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
