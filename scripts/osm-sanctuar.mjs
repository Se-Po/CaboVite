// Instantaneul OpenStreetMap al Santuário de Nossa Senhora do Cabo Espichel.
//
//   npm run osm-sanctuar                     citește starea de azi, scrie instantaneul
//                                            și manifestul versiunilor
//   npm run osm-sanctuar -- --din-manifest   îl reface numai din versiunile din manifest
//                                            și cere să iasă identic
//
// Ce iese:
//   date-sursa/osm/sanctuar-osm-<data>.json   răspunsurile, cu geometria; nu se suprascrie
//   scripts/sanctuar/osm-manifest.json        [tip, id, versiune] + versiunea fiecărui nod
//
// Ce intră: tot ce e construit sau călcat în cutia complexului — clădiri, ziduri,
// garduri, apeductul, drumurile, potecile, parcarea — după etichete, nu după o listă
// scrisă de mână. Lista scrisă de mână e manifestul: el fixează ce s-a ales azi.
//
// Changesetul 120423250 („Update Cabo Espichel", 2022-05-01) a retrasat o bună
// parte din complex. Pe Ermida da Memória a translatat grupul întreg cu (+12,8; −13,8) m
// — greșit: LiDAR-ul și ortofotoul DGT o pun unde era înainte. Pe restul, mutările
// sunt individuale, de la centimetri la zeci de metri, deci nu se pot răsturna
// mecanic. Pentru fiecare cale atinsă de el se păstrează și varianta de dinainte;
// care se folosește se decide pe LiDAR și ortofoto, element cu element, în
// scripts/sanctuar/decizii.json — nu aici.
//
// Licența: ODbL 1.0, © contribuitorii OpenStreetMap. Tot ce se derivă de aici e
// bază de date derivată și poartă aceeași licență.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cereOsm, esteSimplu, inchisa, istoric, laMoment, noduriModificate, noduriVersionate } from './comun/osm.mjs';
import { arie, laTM06 } from './comun/tm06.mjs';

// Complexul, parcarea, esplanada de vest cu Ermida și apeductul până unde iese
// din contur (lon −9,2062). Căile care ies din cutie vin întregi.
const CUTIE = [-9.2180, 38.4180, -9.2060, 38.4225];
const CONTESTAT = 120423250;
const ERMIDA = [999972306, 999972305, 999972304]; // capela, zidul adro-ului, terasa
const MANIFEST = 'scripts/sanctuar/osm-manifest.json';
const DIR = 'date-sursa/osm';
const LICENTA = { licenta: 'ODbL 1.0', url: 'https://opendatacommons.org/licenses/odbl/1-0/', atributie: '© contribuitorii OpenStreetMap' };

/** Ce se păstrează: ce e construit sau călcat. Natura, granițele și marea, nu. */
function sePastreaza(e) {
  const t = e.tags ?? {};
  if (e.type === 'node')
    return t.historic === 'wayside_cross' || t.amenity === 'toilets' || ['gate', 'entrance'].includes(t.barrier);
  if (e.type !== 'way') return false;
  if (t.natural || t.boundary || t.leisure || t.landuse) return false;
  return Boolean(t.building || t.barrier || t.highway || t['area:highway'] || t.amenity === 'parking'
    || t.bridge === 'aqueduct' || t.man_made || t.tourism === 'viewpoint');
}

const tm = (n) => { const p = Array.isArray(n) ? laTM06(n[3], n[2]) : laTM06(n.lon, n.lat); return [p.x, p.y]; };

async function dinApi() {
  const [w, s, e, n] = CUTIE;
  console.log('Starea de azi, din /map …');
  const harta = await cereOsm(`/map.json?bbox=${w},${s},${e},${n}`);
  const noduri = new Map(harta.elements.filter((x) => x.type === 'node').map((x) => [x.id, x]));
  const alese = harta.elements.filter(sePastreaza);
  console.log(`  ${alese.filter((x) => x.type === 'way').length} căi și ${alese.filter((x) => x.type === 'node').length} noduri păstrate`);

  // Changesetul contestat: ce noduri a mutat și cu ce versiune.
  const cs = (await cereOsm(`/changeset/${CONTESTAT}.json`)).changeset;
  const moment = new Date(Date.parse(cs.created_at) - 1000).toISOString().replace('.000', '');
  const mutate = await noduriModificate(CONTESTAT);

  const elemente = [];
  for (const x of alese) {
    if (x.type === 'node') { elemente.push({ tip: 'node', id: x.id, v: x.version, timestamp: x.timestamp, tags: x.tags, lat: x.lat, lon: x.lon }); continue; }
    elemente.push({
      tip: 'way', id: x.id, v: x.version, timestamp: x.timestamp, tags: x.tags,
      noduri: x.nodes.map((id) => { const d = noduri.get(id); return [id, d.version, d.lat, d.lon]; }),
    });
  }

  // Varianta de dinainte, pentru fiecare cale care are măcar un nod mutat acolo
  // sau care a primit ea însăși o versiune nouă acolo.
  for (const el of elemente.filter((x) => x.tip === 'way')) {
    const atins = el.noduri.some(([id]) => mutate.has(id));
    const ist = await istoric('way', el.id);
    const inChangeset = ist.some((v) => v.changeset === CONTESTAT);
    if (!atins && !inChangeset) continue;
    const inainte = laMoment(ist, moment);
    if (!inainte) { el.inainte = { lipseste: `nu exista înainte de ${moment}` }; continue; }
    const perechi = [];
    for (const id of inainte.nodes) {
      if (mutate.has(id)) { perechi.push([id, mutate.get(id) - 1]); continue; }
      const cur = noduri.get(id);
      if (cur && cur.timestamp <= moment) { perechi.push([id, cur.version]); continue; }
      const v = laMoment(await istoric('node', id), moment);
      if (!v) throw new Error(`nodul ${id} al căii ${el.id} nu exista la ${moment}`);
      perechi.push([id, v.version]);
    }
    const vechi = await noduriVersionate(perechi);
    el.inainte = { v: inainte.version, timestamp: inainte.timestamp, noduri: perechi.map(([id, v]) => [id, v, vechi.get(id).lat, vechi.get(id).lon]) };
  }

  // Ermida: deplasarea fiecărui nod al grupului între versiunea de dinainte și cea
  // primită în changeset — nu față de azi: un nod atins din nou după 2022 n-ar spune
  // nimic despre changeset. Se scrie în instantaneu, ca proba să se poată reface.
  const idsErmida = [...new Set(elemente.filter((x) => ERMIDA.includes(x.id)).flatMap((x) => x.noduri.map(([id]) => id)))];
  const perechi = idsErmida.filter((id) => mutate.has(id)).flatMap((id) => [[id, mutate.get(id) - 1], [id, mutate.get(id)]]);
  const vv = new Map();
  for (let i = 0; i < perechi.length; i += 150) {
    const q = perechi.slice(i, i + 150).map(([id, v]) => `${id}v${v}`).join(',');
    for (const e of (await cereOsm(`/nodes.json?nodes=${q}`)).elements) vv.set(`${e.id}v${e.version}`, e);
  }
  const deplasariErmida = idsErmida.map((id) => {
    if (!mutate.has(id)) return [id, null];
    const a = tm(vv.get(`${id}v${mutate.get(id) - 1}`)), b = tm(vv.get(`${id}v${mutate.get(id)}`));
    return [id, [+(b[0] - a[0]).toFixed(3), +(b[1] - a[1]).toFixed(3)]];
  });

  return { moment, cs, mutate, elemente, deplasariErmida };
}

/** Același instantaneu, numai din versiunile scrise în manifest. */
async function dinManifest(man) {
  const perechi = new Map();
  for (const el of man.elemente) {
    if (el.tip === 'node') perechi.set(el.id, el.v);
    for (const [id, v] of el.noduri ?? []) perechi.set(`${id}v${v}`, [id, v]);
    for (const [id, v] of el.inainte?.noduri ?? []) perechi.set(`${id}v${v}`, [id, v]);
  }
  const lista = [...perechi.values()].filter(Array.isArray);
  const noduriV = new Map();
  for (let i = 0; i < lista.length; i += 150) {
    const q = lista.slice(i, i + 150).map(([id, v]) => `${id}v${v}`).join(',');
    for (const e of (await cereOsm(`/nodes.json?nodes=${q}`)).elements) noduriV.set(`${e.id}v${e.version}`, e);
  }
  const elemente = [];
  for (const el of man.elemente) {
    if (el.tip === 'node') {
      const e = (await cereOsm(`/node/${el.id}/${el.v}.json`)).elements[0];
      elemente.push({ tip: 'node', id: e.id, v: e.version, timestamp: e.timestamp, tags: e.tags, lat: e.lat, lon: e.lon });
      continue;
    }
    const w = (await cereOsm(`/way/${el.id}/${el.v}.json`)).elements[0];
    const cu = (lista2) => lista2.map(([id, v]) => { const d = noduriV.get(`${id}v${v}`); return [id, v, d.lat, d.lon]; });
    const out = { tip: 'way', id: w.id, v: w.version, timestamp: w.timestamp, tags: w.tags, noduri: cu(el.noduri) };
    if (w.nodes.join() !== el.noduri.map(([id]) => id).join()) throw new Error(`calea ${el.id} v${el.v}: lista de noduri diferă de manifest`);
    if (el.inainte) {
      if (el.inainte.lipseste) out.inainte = el.inainte;
      else {
        const wi = (await cereOsm(`/way/${el.id}/${el.inainte.v}.json`)).elements[0];
        out.inainte = { v: wi.version, timestamp: wi.timestamp, noduri: cu(el.inainte.noduri) };
      }
    }
    elemente.push(out);
  }
  return elemente;
}

// ------------------------------------------------------------ probele

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const geometrie = (els) => JSON.stringify(els.map(({ tip, id, v, tags, lat, lon, noduri, inainte }) => ({ tip, id, v, tags, lat, lon, noduri, inainte })));
const esteInchisa = (el) => el.tip === 'way' && inchisa({ nodes: el.noduri.map(([id]) => id) });

/** Probele pe un instantaneu citit sau abia scris. Nu cer rețea. */
function probe(inst) {
  console.log('\nProbe');
  const nesimple = [];
  for (const el of inst.elemente.filter(esteInchisa)) {
    if (!esteSimplu(el.noduri.map(tm))) nesimple.push(`${el.id} (azi)`);
    if (el.inainte?.noduri && !esteSimplu(el.inainte.noduri.map(tm))) nesimple.push(`${el.id} (înainte)`);
  }
  proba(nesimple.length === 0, `poligoanele închise sunt simple, fără autointersecții${nesimple.length ? ': ' + nesimple.join(', ') : ''}`);

  // Ermida: grupul întreg, translatat la fel. Changesetul a mișcat multe alte
  // noduri, dar fiecare altfel; numai aici e o translație comună, adică o mutare
  // a unui obiect întreg, nu o retrasare.
  const d = inst.contestat.deplasari_ermida ?? [];
  const mutate = d.filter(([, v]) => v).map(([, v]) => v);
  const medie = mutate.reduce((s, [x, y]) => [s[0] + x / mutate.length, s[1] + y / mutate.length], [0, 0]);
  const abatere = Math.max(...mutate.map(([x, y]) => Math.hypot(x - medie[0], y - medie[1])));
  proba(d.length > 0 && mutate.length === d.length && Math.abs(medie[0] - 12.84) < 0.05 && Math.abs(medie[1] + 13.80) < 0.05 && abatere < 0.05,
    `Ermida: ${mutate.length}/${d.length} noduri mutate în ${CONTESTAT} cu (${medie[0].toFixed(2)}; ${medie[1].toFixed(2)}) m, abatere max ${abatere.toFixed(3)} m — cerut toate, (12,84; −13,80) ± 0,05`);

  // Cât s-au schimbat căile atinse: tipărit, ca decizia de mai târziu să aibă cifrele.
  console.log(`\nCăile atinse de changesetul ${CONTESTAT} (varianta de dinainte e păstrată):`);
  const cx = (p) => p.reduce((s, q) => [s[0] + q[0] / p.length, s[1] + q[1] / p.length], [0, 0]);
  const xy = (p) => p.map(([x, y]) => ({ x, y }));
  for (const el of inst.elemente.filter((x) => x.inainte)) {
    const nume = el.tags?.name ?? Object.entries(el.tags ?? {}).find(([k]) => ['building', 'barrier', 'highway', 'amenity', 'tourism'].includes(k))?.join('=');
    if (el.inainte.lipseste) { console.log(`  ${el.id}  ${nume}: ${el.inainte.lipseste}`); continue; }
    const azi = el.noduri.map(tm), inainte = el.inainte.noduri.map(tm);
    const [a, b] = [cx(azi), cx(inainte)];
    const arii = esteInchisa(el) ? `, arie ${arie(xy(inainte)).toFixed(0)} → ${arie(xy(azi)).toFixed(0)} m²` : '';
    console.log(`  ${el.id} v${el.inainte.v}→v${el.v}  ${nume}: centrul mutat cu ${Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(2)} m${arii}`);
  }
}

// ------------------------------------------------------------ rularea

if (process.argv.includes('--din-manifest')) {
  const man = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const cale = `${DIR}/${man.fisier}`;
  if (!existsSync(cale)) throw new Error(`lipsește ${cale}; rulează întâi fără --din-manifest`);
  const salvat = JSON.parse(readFileSync(cale, 'utf8'));
  console.log(`Refac ${man.elemente.length} elemente din versiunile manifestului …`);
  const refacut = await dinManifest(man);
  proba(geometrie(refacut) === geometrie(salvat.elemente), `instantaneul refăcut din manifest e identic cu ${man.fisier}`);
  probe(salvat);
} else {
  const azi = new Date().toISOString().slice(0, 10);
  const fisier = `sanctuar-osm-${azi}.json`;
  if (existsSync(`${DIR}/${fisier}`)) throw new Error(`${DIR}/${fisier} există; un instantaneu nu se suprascrie`);
  const { moment, cs, mutate, elemente, deplasariErmida } = await dinApi();

  const acum = new Date().toISOString();
  const inst = {
    nume: 'sanctuar-osm', generat: acum, ...LICENTA, sursa: 'https://api.openstreetmap.org/api/0.6', cutie: CUTIE,
    contestat: {
      changeset: CONTESTAT, comentariu: cs.tags?.comment, creat: cs.created_at, moment_inainte: moment,
      noduri_mutate: mutate.size, deplasari_ermida: deplasariErmida,
    },
    elemente,
  };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(`${DIR}/${fisier}`, JSON.stringify(inst, null, 1));
  mkdirSync('scripts/sanctuar', { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    ...LICENTA, nota: 'Versiunile OSM ale instantaneului sanctuarului. Bază de date derivată din OpenStreetMap, ODbL 1.0.',
    fisier, generat: acum, contestat: CONTESTAT,
    elemente: elemente.map((el) => (el.tip === 'node' ? { tip: 'node', id: el.id, v: el.v } : {
      tip: 'way', id: el.id, v: el.v, noduri: el.noduri.map(([id, v]) => [id, v]),
      ...(el.inainte ? { inainte: el.inainte.lipseste ? el.inainte : { v: el.inainte.v, noduri: el.inainte.noduri.map(([id, v]) => [id, v]) } } : {}),
    })),
  }, null, 1) + '\n');
  console.log(`scris: ${DIR}/${fisier}, ${MANIFEST}`);
  probe(inst);
}

console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
process.exitCode = picate ? 1 : 0;
