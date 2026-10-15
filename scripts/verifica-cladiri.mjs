// Verifică, în Node, clădirile din afara sanctuarului: ce încarcă pagina, ce
// construiește și cât de aproape stă de LiDAR.
//
//   npm run verifica-cladiri
//
// Nu scrie nimic. Construiește terenul și clădirile cu CODUL PAGINII —
// incarcaRelief, rețeta lui alpha (alpha.js), incarcaCladiri, creeazaSanctuar —, cu
// `fetch` înlocuit de o citire din public/. Iese cu cod 1 dacă a picat vreo probă.
//
// Probele de fond au control negativ: acoperișurile (ridicate cu 1 m), amprentele
// (mutate 2 m) și sha256-ul plasei (vârful farului coborât 1 mm). Cele de LiDAR cer
// dalele MDS/MDT de 50 cm din date-sursa/; fără ele se sar și se spune. Vârful farului e o probă de CONSISTENȚĂ: e chiar maximul MDS, deci prinde
// numai o greșeală de transport până în pagină.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { incarcaCladiri, incarcaRelief, incarcaSanctuar } from '../src/scene/loaders.js';
import { construiesteAlpha, pregatesteAlpha } from '../src/scene/alpha.js';
import { creeazaCamera } from '../src/scene/camera.js';
import { creeazaLumini } from '../src/scene/lights.js';
import { incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';
import { creeazaSanctuar } from '../src/scene/sanctuar.js';
import { soareZborDin } from '../src/scene/satelit.js';
import * as umbreAzi from '../src/scene/umbre.js';
import { fereastraLidar, fisierDala, daleFereastra } from './comun/lidar.mjs';
import { modulDin, muta, NEAPLICATA, textSursa } from './comun/mutatii.mjs';
import { cuAvertismente, cuantila, cuFetch, dinDisc, INDEX, opreste, proba, rezumat, sari } from './comun/proba.mjs';

const BUGET = { triunghiuri: 6000, json_kib: 20 };
const FISIER = 'public/data/cladiri_v1.json';
const MDS_FAR = 168.28;
// Amprenta plasei, sha256 pe atributele ei, pe `cladiri_v1` așezat pe `harta_v5` +
// `harta_v4`. O refactorizare a formelor trebuie s-o lase la bit; o schimbare voită a
// datelor, a reliefului sau a formelor o rescrie aici, cu motivul în commit. Citită pe
// 2026-10-08, înainte de turn() pe orice număr de colțuri.
const AMPRENTA = {
  position: '9e6d5e3fa9818c798511aebfe04e38d431312b13671c1348a27543ef9428e000',
  color: '0d40b30a2926c6e41b24bfca362fdfe848ae14406043cb1b336e0789de091944',
  ocluzie: '8fde375fe2512c2d8febc45c1d50a736937aefb9576f485a54b341604cf950ed',
};

globalThis.fetch = dinDisc;

// ------------------------------------------------------------ 1. încărcătorul

console.log('\nÎncărcătorul: fiecare cale de eșec întoarce null, cu un avertisment, fără să arunce');
const original = JSON.parse(readFileSync(FISIER, 'utf8'));
const cuRaspuns = (raspuns) => cuFetch(async () => raspuns(), () => incarcaCladiri());
const json = (o) => new Response(JSON.stringify(o), { status: 200 });
const cai = [
  ['fișier lipsă (serverul dă index.html cu 200)', () => new Response(INDEX, { status: 200 })],
  ['HTTP 404', () => new Response('', { status: 404 })],
  ['JSON trunchiat', () => new Response(JSON.stringify(original).slice(0, 2000), { status: 200 })],
  // datele sanctuarului au aceeași schemă: un încărcător care le-ar primi ar construi sanctuarul de două ori
  ['sanctuarul în locul clădirilor', () => new Response(readFileSync('public/data/sanctuar_v3.json'), { status: 200 })],
  ['schemă necunoscută', () => json({ ...original, versiune_schema: 2 })],
  ['material fără rgb', () => json({ ...original, materiale: { ...original.materiale, var: { rgb: [300, 0, 0] } } })],
  ['listă lipsă', () => { const o = { ...original }; delete o.cupole; return json(o); }],
];
for (const [nume, r] of cai) {
  const { r: d, e, avert } = await cuRaspuns(r);
  proba(d === null && !e && avert.length === 1, `${nume}: ${e ? `ARUNCĂ ${e.message}` : d === null ? `null, „${avert[0]?.slice(0, 70)}"` : 'a trecut'}`);
}
{
  const { r: d, avert } = await cuRaspuns(() => json(original));
  proba(d?.nume === original.nume && avert.length === 0, 'fișierul adevărat se încarcă, fără avertismente');
}

// ------------------------------------------------------------ 2. construcția

console.log('\nConstrucția, cu codul paginii');
await incarcaPaleta();
const pregatit = pregatesteAlpha(await incarcaRelief());
const { relief } = pregatit;
const paleta = paletaCurenta();
const { teren, petic, inaltimeLa } = construiesteAlpha(pregatit, { paleta });
const b = relief.meta.bbox_tm06;
const ancora = { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
const date = await incarcaCladiri();
const { r: cladiri, avert: avertConstructie } = await cuAvertismente(() => creeazaSanctuar({ date, inaltimeLa, ancora, eticheta: 'clădiri' }));
proba(cladiri !== null, 'clădirile se construiesc');
if (!cladiri) await opreste('fără clădiri, restul probelor n-are pe ce rula');
proba(avertConstructie.length === 0, `niciun element sărit (${avertConstructie.length} avertismente${avertConstructie.length ? `: ${avertConstructie.slice(0, 3).join(' | ')}` : ''})`);
proba(cladiri.nrTriunghiuri.cladiri <= BUGET.triunghiuri, `${cladiri.nrTriunghiuri.cladiri} triunghiuri, buget ${BUGET.triunghiuri}`);
const kib = readFileSync(FISIER).length / 1024;
proba(kib <= BUGET.json_kib, `${FISIER}: ${kib.toFixed(1)} KiB, buget ${BUGET.json_kib} KiB`);
proba(cladiri.poi === null && cladiri.obiecte.length === 1, 'fără etichetă și fără suprafețe pe teren: un singur obiect');
const grupuri = [...cladiri.cutiiGrupuri.keys()].sort();
proba(grupuri.join() === 'casa_da_ronca,far', `grupurile pentru umbre: ${grupuri.join(', ')}`);
{
  // Materialele clădirilor sunt copiate din sanctuar (build-cladiri, „prin asemănare”): culoarea lor
  // trebuie să fie a sanctuarului pe care îl încarcă pagina. Așa cladiri_v1 rămâne valabil lângă
  // sanctuar_v3, care a schimbat numai acoperișurile aduse la plat; la cupolă s-a schimbat doar nota
  // (pixelii arși din ortofotoul respins: 98,8% → 99,4%, jumătatea însorită aleasă după alt soare).
  // Control: același sanctuar, cu varul schimbat cu o unitate.
  const S = await incarcaSanctuar();
  const fara = ({ rgb, culoare, oklab }) => ({ rgb, culoare, oklab });
  const diferite = (s) => Object.keys(date.materiale).filter((k) => JSON.stringify(fara(date.materiale[k])) !== JSON.stringify(fara(s.materiale[k] ?? {})));
  const d = diferite(S);
  proba(S !== null && d.length === 0, `materialele clădirilor (${Object.keys(date.materiale).join(', ')}) sunt cele din ${S?.nume}, încărcat de pagină${d.length ? `; diferă ${d.join(', ')}` : ''}`);
  const stricat = structuredClone(S);
  stricat.materiale.var.rgb[0] += 1;
  proba(diferite(stricat).includes('var'), `control, varul sanctuarului schimbat cu o unitate: diferă ${diferite(stricat).join(', ')} — pică`);
}
{
  const { r, avert } = await cuAvertismente(() => creeazaSanctuar({ date, inaltimeLa, ancora: { x: ancora.x + 1, y: ancora.y }, eticheta: 'clădiri' }));
  proba(r === null && avert.length === 1 && avert[0].startsWith('clădiri:'), `ancoră greșită: null, „${avert[0]?.slice(0, 60)}"`);
  // o cheie de material inexistentă în profilul farului: altfel cupola ieșea neagră, tăcut
  const stricat = structuredClone(date);
  stricat.cupole[0].materiale_profil[0] = 'inexistent';
  const { r: r2, avert: a2 } = await cuAvertismente(() => creeazaSanctuar({ date: stricat, inaltimeLa, ancora, eticheta: 'clădiri' }));
  proba(r2 !== null && a2.some((w) => w.includes('far.turn') && w.includes('materiale_profil')) && r2.nrTriunghiuri.cladiri < cladiri.nrTriunghiuri.cladiri,
    `material inexistent în profilul farului: farul sărit, cu avertisment, restul construit (${r2?.nrTriunghiuri.cladiri} triunghiuri)`);
  r2?.dispose();
}

// ------------------------------------------------------------ 3. geometria

console.log('\nGeometria');
const poz = cladiri.obiect.geometry.attributes.position.array;
proba(poz.every(Number.isFinite), `toate cele ${poz.length / 3} vârfuri sunt finite`);
{
  const convex = (c) => { let semn = 0; for (let k = 0; k < c.length; k++) { const p = c[k], q = c[(k + 1) % c.length], r = c[(k + 2) % c.length]; const x = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); if (Math.abs(x) < 1e-9) continue; if (semn && Math.sign(x) !== semn) return false; semn = Math.sign(x); } return true; };
  const neconvexe = date.corpuri.filter((c) => !convex(c.contur)).map((c) => c.cheie);
  proba(neconvexe.length === 0, `toate cele ${date.corpuri.length} corpuri au contur convex${neconvexe.length ? `: ${neconvexe.join(', ')}` : ''}`);
  let yMax = -Infinity;
  for (let i = 1; i < poz.length; i += 3) yMax = Math.max(yMax, poz[i]);
  proba(Math.abs(yMax - MDS_FAR) < 0.01, `cel mai înalt vârf e la ${yMax.toFixed(2)} m, cât vârful MDS al farului (${MDS_FAR})`);
  const [xf, zf] = date.cupole[0].centru;
  const lov = cladiri.loveste(new THREE.Ray(new THREE.Vector3(xf, 400, zf), new THREE.Vector3(0, -1, 0)));
  proba(lov?.cheie === 'far.turn' && Math.abs(lov.y - MDS_FAR) < 0.01, `raza verticală pe axul farului lovește ${lov?.cheie} la ${lov?.y.toFixed(3)} m`);
}
{
  // amprenta plasei: o refactorizare a formelor o lasă la bit
  const at = cladiri.obiect.geometry.attributes;
  const sha = (a) => createHash('sha256').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
  const citit = Object.fromEntries(Object.keys(AMPRENTA).map((k) => [k, sha(at[k].array)]));
  const diferite = Object.keys(AMPRENTA).filter((k) => citit[k] !== AMPRENTA[k]);
  proba(diferite.length === 0, `sha256 pe position, color și ocluzie, cât în AMPRENTA${diferite.length ? `; diferă ${diferite.map((k) => `${k} (${citit[k]})`).join(', ')}` : ''}`);
  // control: vârful farului coborât cu 1 mm schimbă amprenta
  const mutat = structuredClone(date);
  mutat.cupole[0].profil.at(-1)[1] -= 0.001;
  const r = creeazaSanctuar({ date: mutat, inaltimeLa, ancora, eticheta: 'clădiri' });
  proba(r && sha(r.obiect.geometry.attributes.position.array) !== AMPRENTA.position, `control negativ: ${mutat.cupole[0].cheie} cu vârful coborât 1 mm dă altă amprentă position`);
  r?.dispose();
}

// ------------------------------------------------------------ 4. față de LiDAR

console.log('\nFață de LiDAR (cere dalele MDS/MDT de 50 cm din date-sursa/)');
const laTM = (x, z) => [x + ancora.x, ancora.y - z];
const inPoli = (x, z, c) => { let in_ = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) { const [xi, zi] = c[i], [xj, zj] = c[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) in_ = !in_; } return in_; };
const cutie = (c) => [Math.min(...c.map((p) => p[0])), Math.max(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[1]))];
// Clădirea întreagă: părțile ei au cheia „tip.osm[.k]”; farul e cupola.
const cladire = (c) => c.cheie.split('.').slice(0, 2).join('.');
const familii = new Map();
for (const c of [...date.corpuri, ...date.cupole]) (familii.get(cladire(c)) ?? familii.set(cladire(c), []).get(cladire(c))).push(c.contur);
const toateC = [...familii.values()].flat();
const [X0, X1, Z0, Z1] = cutie(toateC.flat());
// Fereastra LiDAR peste toate clădirile, pe grupuri (sunt la ~400 m una de alta).
const lipsa = [...familii.values()].flatMap((f) => {
  const [a0, a1, b0, b1] = cutie(f.flat()); const [x0, y1] = laTM(a0 - 4, b0 - 4), [x1, y0] = laTM(a1 + 4, b1 + 4);
  return ['MDS', 'MDT'].flatMap((tip) => daleFereastra({ x0: Math.floor(x0), x1: Math.ceil(x1), y0: Math.floor(y0), y1: Math.ceil(y1) }).filter((d) => !fisierDala(tip, d)).map((d) => `${tip}-${d}`));
});
if (lipsa.length) sari(`lipsesc dalele ${[...new Set(lipsa)].join(', ')}`);
else {
  void X0; void X1; void Z0; void Z1;
  // Câte o fereastră pe clădire, cu 4 m de margine; pixelul (x, z) al scenei → MDS, MDT.
  const lidar = new Map();
  for (const [k, f] of familii) {
    const [a0, a1, b0, b1] = cutie(f.flat());
    const [x0, y1] = laTM(a0 - 4, b0 - 4), [x1, y0] = laTM(a1 + 4, b1 + 4);
    const F = { x0: Math.floor(x0), x1: Math.ceil(x1), y0: Math.floor(y0), y1: Math.ceil(y1) };
    const s = fereastraLidar('MDS', F), t = fereastraLidar('MDT', F);
    const la = (r, X, Y) => { const c = Math.floor((X - F.x0) / 0.5), rr = Math.floor((F.y1 - Y) / 0.5); if (c < 0 || c >= r.W || rr < 0 || rr >= r.H) return NaN; const v = r.v[rr * r.W + c]; return v === -999 ? NaN : v; };
    lidar.set(k, { mds: (x, z) => la(s, ...laTM(x, z)), mdt: (x, z) => la(t, ...laTM(x, z)) });
  }
  // pixelii LiDAR (centre la x.25 / x.75 în TM06, deci și în scenă) dintr-un contur
  const pixeli = function* (c, dx = 0, dz = 0) {
    const [x0, x1, z0, z1] = cutie(c);
    for (let x = Math.floor((x0 + dx) * 2) / 2 + 0.25; x < x1 + dx; x += 0.5) for (let z = Math.floor((z0 + dz) * 2) / 2 + 0.25; z < z1 + dz; z += 0.5) if (inPoli(x - dx, z - dz, c)) yield [x, z];
  };
  const jos = new THREE.Vector3(0, -1, 0);
  const cotaModel = (x, z) => cladiri.loveste(new THREE.Ray(new THREE.Vector3(x, 400, z), jos))?.y ?? NaN;
  const OPT = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [0.71, -0.71], [-0.71, 0.71], [-0.71, -0.71]].map(([a, bb]) => [a * 0.75, bb * 0.75]);

  // a. acoperișurile, pe pixelii de la cel puțin 0,75 m de marginea clădirii
  const abateri = [], peCladire = new Map();
  for (const [k, f] of familii) {
    if (k.startsWith('far.')) continue;
    const L = lidar.get(k), inF = (x, z) => f.some((c) => inPoli(x, z, c));
    for (const c of f) for (const [x, z] of pixeli(c)) {
      if (!OPT.every(([dx, dz]) => inF(x + dx, z + dz))) continue;
      // nu pe far: casa lipită de el își are acoperișul fără pixelii lui
      if (familii.get('far.turn').some((cf) => inPoli(x, z, cf) || OPT.some(([dx, dz]) => inPoli(x + dx, z + dz, cf)))) continue;
      const m = L.mds(x, z), t = L.mdt(x, z), y = cotaModel(x, z);
      if (!Number.isFinite(m) || !Number.isFinite(t) || !Number.isFinite(y) || m - t < 1) continue;
      abateri.push(y - m);
      (peCladire.get(k) ?? peCladire.set(k, []).get(k)).push(Math.abs(y - m));
    }
  }
  const med = cuantila(abateri, 0.5), p90 = cuantila(abateri.map(Math.abs), 0.9);
  proba(Math.abs(med) <= 0.25 && p90 <= 0.8, `acoperișurile față de MDS pe ${abateri.length} pixeli: mediana ${med.toFixed(3)} m, p90 |Δ| ${p90.toFixed(3)} m (prag 0,25 / 0,8)`);
  const rai = [...peCladire].map(([k, v]) => [k, cuantila(v, 0.9), v.length]).filter(([, p]) => p > 0.8);
  if (rai.length) console.log(`       peste 0,8 m la p90: ${rai.map(([k, p, n]) => `${k} ${p.toFixed(2)} (${n} px)`).join(', ')}`);
  const med1 = cuantila(abateri.map((d) => d + 1), 0.5);
  proba(!(Math.abs(med1) <= 0.25), `control negativ: acoperișurile ridicate cu 1 m dau mediana ${med1.toFixed(3)} m — proba ar pica`);

  // b. amprentele: partea din fiecare care stă pe clădire (nMDS > 1 m), față de ele mutate 2 m
  const peCladireFrac = (dx, dz) => {
    let n = 0, pe = 0;
    for (const [k, f] of familii) {
      const L = lidar.get(k);
      for (const c of f) for (const [x, z] of pixeli(c, dx, dz)) {
        const m = L.mds(x, z), t = L.mdt(x, z);
        if (!Number.isFinite(m) || !Number.isFinite(t)) continue;
        n++; if (m - t > 1) pe++;
      }
    }
    return pe / n;
  };
  const f0 = peCladireFrac(0, 0);
  const mutate = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dz]) => peCladireFrac(dx, dz));
  proba(f0 >= 0.9, `amprentele stau pe clădire (nMDS > 1 m) în ${(100 * f0).toFixed(1)}% din aria lor (prag 90%)`);
  proba(Math.max(...mutate) < f0 - 0.08, `control negativ: mutate 2 m, cel mult ${(100 * Math.max(...mutate)).toFixed(1)}% (${mutate.map((v) => (100 * v).toFixed(1)).join(' / ')}) — proba le deosebește`);
}

// ------------------------------------------------------------ 5. umbrele pe grupuri

// Umbrele, luminile, camera, grupurile (`grupuriUmbre`) și soarele zborului (`soareZborDin`) sunt
// ale paginii; texelul de referință și pragurile se socotesc aici, iar tabelul se citește din
// docs/cladiri.md. Controalele schimbă umbre.js, încărcat din text.
console.log('\nUmbrele pe grupuri (umbre.js): texelul cutiilor și pragurile lui urmaresteGrupul, cu camera și soarele paginii');
{
  const { reliefPetic, pastreaza, subPetic } = pregatit;
  const sanctuar = creeazaSanctuar({ date: await incarcaSanctuar(), inaltimeLa, ancora, retea: { relief, reliefPetic, pastreaza, subPetic } });
  const { grupuri: grupuriUmbra, unita } = umbreAzi.grupuriUmbre({ sanctuar, cladiri });
  const cutii = { toate: unita, ...Object.fromEntries(grupuriUmbra.map((g) => [g.nume, g.cutie])) };
  // în ordinea tabelului din docs/cladiri.md
  const nume = ['toate', 'sanctuar', 'far', 'casa_da_ronca'];
  proba(Object.keys(cutii).sort().join() === [...nume].sort().join(), `cutiile: ${Object.keys(cutii).join(', ')}`);

  // Soarele zborului, din sidecarul texturii bazei, ca în satelit.js.
  const S = JSON.parse(readFileSync('public/data/harta_v4-orto_v1.json', 'utf8')).soare_zbor;
  const R = Math.PI / 180;
  // Texelul, socotit aici: colțurile cutiei lărgite cu 60 m (lungimea umbrei), proiectate pe
  // axele camerei de umbră — z dinspre țintă spre soare, x = sus × z, y = z × x —, latura mai
  // lungă împărțită la 2048.
  const texelRef = (soare, c) => {
    const z = soare.position.clone().sub(soare.target.position).normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    const b = c.clone().expandByScalar(60);
    const lx = [], ly = [];
    for (const px of [b.min.x, b.max.x]) for (const py of [b.min.y, b.max.y]) for (const pz of [b.min.z, b.max.z]) {
      const v = new THREE.Vector3(px, py, pz);
      lx.push(v.dot(x)); ly.push(v.dot(y));
    }
    return Math.max(Math.max(...lx) - Math.min(...lx), Math.max(...ly) - Math.min(...ly)) / 2048;
  };
  // Tabelul din docs/cladiri.md, „Umbrele pe grupuri”: rândurile „| Relief” și „| al zborului”,
  // cu virgula zecimală. `null` pe rândul care lipsește sau n-are patru numere.
  const citesteTabel = (text) => {
    const sectiune = text?.split('### Umbrele pe grupuri')[1]?.split('\n### ')[0] ?? '';
    const rand = (eticheta) => {
      const v = sectiune.split('\n').find((l) => l.trim().startsWith(`| ${eticheta}`))?.split('|').slice(2, 6).map((c) => Number(c.trim().replace(',', '.')));
      return v?.length === 4 && v.every(Number.isFinite) ? Object.fromEntries(nume.map((n, i) => [n, v[i]])) : null;
    };
    return { relief: rand('Relief'), zbor: rand('al zborului') };
  };
  const DOCS = textSursa('docs/cladiri.md');
  const DOC = citesteTabel(DOCS);
  const abatereDoc = (t, doc) => (doc ? Math.max(...nume.map((n) => Math.abs(t[n] - doc[n]))) : Infinity);
  // Pixelul canvasului la țintă, la un canvas înalt de 1 px, de la vederea de pornire.
  const pixel1 = (camera, controale) => camera.position.distanceTo(controale.target) * 2 * Math.tan((camera.fov * R) / 2);
  // Pragurile așteptate: cutia unită pleacă la primul canvas cu texel > 1,1 · pixel, revine la
  // ultimul cu texel ≤ 0,9 · pixel.
  const praguri = (texel, p1) => ({ pleaca: Math.floor((1.1 * p1) / texel) + 1, revine: Math.floor((0.9 * p1) / texel) });
  // Ținta, cu camera după ea, mutată în punctul `p` (pe orizontală).
  const mutaTinta = (camera, controale, p) => {
    const decalaj = camera.position.clone().sub(controale.target);
    controale.target.set(p.x, controale.target.y, p.z);
    camera.position.copy(controale.target).add(decalaj);
  };
  const DRUM = [-30, 19, 21, -19, -30];
  const DRUM_BUN = 'sanctuar,sanctuar,far,far,sanctuar';

  /**
   * Tot scenariul pe un modul umbre.js dat: texelul cutiilor, pragurile pe Relief, apoi pe
   * Satelit, histerezisul între grupuri și, separat, pagina fără sanctuar.
   */
  const incearca = (U) => {
    const lumini = creeazaLumini(paleta);
    const soare = lumini.soare;
    const soareZbor = soareZborDin(S, soare.position.length());
    const umbre = U.creeazaUmbre({ renderer: { shadowMap: {} }, soare, cutie: unita, arunca: [sanctuar.obiect, cladiri.obiect], primesc: [teren.obiect, petic?.obiect].filter(Boolean) });
    const { camera, controale } = creeazaCamera(null);
    const canvas = { height: 150 };
    const g = U.urmaresteGrupul({ umbre, grupuri: grupuriUmbra, unita, texelMaxim: U.TEXEL_MAXIM, camera, controale, canvas });
    const r = { creare: g.grup, texel: {}, ref: {}, praguri: {}, asteptat: {} };
    // canvasul urcat de la 600 la 1400 px, apoi coborât înapoi: unde pleacă și unde revine
    const masoara = () => {
      canvas.height = 600; g.pas();
      let pleaca = null, revine = null, spre = null;
      for (let h = 601; h <= 1400 && pleaca === null; h++) { canvas.height = h; g.pas(); if (g.grup !== 'toate') { pleaca = h; spre = g.grup; } }
      for (let h = 1400; h >= 600 && revine === null; h--) { canvas.height = h; g.pas(); if (g.grup === 'toate') revine = h; }
      return { pleaca, revine, spre };
    };
    for (const [vedere, pozitie] of [['relief', soare.position.clone()], ['zbor', soareZbor]]) {
      soare.position.copy(pozitie);
      if (vedere === 'zbor') umbre.potriveste();
      r.texel[vedere] = Object.fromEntries(Object.entries(cutii).map(([n, c]) => [n, umbre.texelPentru(c)]));
      r.ref[vedere] = Object.fromEntries(Object.entries(cutii).map(([n, c]) => [n, texelRef(soare, c)]));
      r.praguri[vedere] = masoara();
      r.asteptat[vedere] = praguri(r.ref[vedere].toate, pixel1(camera, controale));
    }
    // Histerezisul între grupuri: ținta pe segmentul dintre sanctuar și far, în punctele în care
    // farul e mai aproape decât sanctuarul cu δ metri, pe canvasul înalt.
    canvas.height = 4000;
    const dist = (c, p) => c.distanceToPoint(new THREE.Vector3(p.x, (c.min.y + c.max.y) / 2, p.z));
    const cs = cutii.sanctuar.getCenter(new THREE.Vector3()), cf = cutii.far.getCenter(new THREE.Vector3());
    const la = (delta) => {
      let a = 0, b = 1, p = new THREE.Vector3();
      for (let k = 0; k < 60; k++) { const t = (a + b) / 2; p = cs.clone().lerp(cf, t); if (dist(cutii.sanctuar, p) - dist(cutii.far, p) < delta) a = t; else b = t; }
      return p;
    };
    r.drum = [];
    r.alTreilea = Infinity;
    for (const delta of DRUM) {
      const p = la(delta);
      mutaTinta(camera, controale, p);
      g.pas();
      r.drum.push(g.grup);
      r.alTreilea = Math.min(r.alTreilea, dist(cutii.casa_da_ronca, p) - Math.min(dist(cutii.sanctuar, p), dist(cutii.far, p)));
    }
    umbre.dispose();
    lumini.dispose();

    // Fără sanctuar (pagina merge mai departe fără el): farul și Casa da Ronca, cu cutia lor
    // unită. Pe canvasul înalt, cu ținta pe far, harta rămâne pe cutia unită cât texelul ei stă
    // sub TEXEL_MAXIM — singura cale pe care lucrează ramura aceea.
    const { grupuri: gs, unita: u2 } = umbreAzi.grupuriUmbre({ cladiri });
    const l2 = creeazaLumini(paleta);
    const um2 = U.creeazaUmbre({ renderer: { shadowMap: {} }, soare: l2.soare, cutie: u2, arunca: [cladiri.obiect], primesc: [] });
    const { camera: c2, controale: k2 } = creeazaCamera(null);
    mutaTinta(c2, k2, cf);
    const g2 = U.urmaresteGrupul({ umbre: um2, grupuri: gs, unita: u2, texelMaxim: U.TEXEL_MAXIM, camera: c2, controale: k2, canvas: { height: 4000 } });
    r.faraSanctuar = { grupuri: gs.map((x) => x.nume).join(), texelMaxim: U.TEXEL_MAXIM };
    for (const [vedere, pozitie] of [['relief', l2.soare.position.clone()], ['zbor', soareZborDin(S, l2.soare.position.length())]]) {
      l2.soare.position.copy(pozitie);
      if (vedere === 'zbor') um2.potriveste();
      g2.pas();
      r.faraSanctuar[vedere] = { texel: texelRef(l2.soare, u2), grup: g2.grup };
    }
    um2.dispose();
    l2.dispose();
    return r;
  };

  const azi = incearca(umbreAzi);
  proba(azi.creare === 'toate', `la creare, cu canvasul de 300 × 150, cutia unită (${azi.creare})`);
  for (const vedere of ['relief', 'zbor']) {
    const t = azi.texel[vedere], ref = azi.ref[vedere];
    const abRef = Math.max(...nume.map((n) => Math.abs(t[n] - ref[n])));
    const abDoc = abatereDoc(t, DOC[vedere]);
    proba(abRef < 1e-9 && abDoc < 0.0005,
      `soarele ${vedere === 'relief' ? 'Relief' : 'zborului'}: texelul ${nume.map((n) => t[n].toFixed(3)).join(' / ')} m, cât socotit aici (abatere ${abRef.toExponential(1)}) și cât tabelul din docs/cladiri.md (${DOC[vedere] ? `abatere ${abDoc.toFixed(4)} m` : 'rândul NECITIT'})`);
    const p = azi.praguri[vedere], a = azi.asteptat[vedere];
    proba(p.pleaca === a.pleaca && p.revine === a.revine && p.spre === 'sanctuar',
      `${vedere === 'relief' ? 'Relief' : 'Satelit'}: cutia unită pleacă spre ${p.spre} la ${p.pleaca} px de canvas și revine la ${p.revine} px (socotit: ${a.pleaca} / ${a.revine})`);
  }
  {
    // control: tabelul cu o cifră schimbată în text
    const stricat = citesteTabel(muta(DOCS, ['| 0,211 |', '| 0,221 |']));
    const ab = stricat.relief ? abatereDoc(azi.texel.relief, stricat.relief) : null;
    proba(ab !== null && !(ab < 0.0005), `control, tabelul din docs cu 0,211 scris 0,221: ${ab === null ? NEAPLICATA : `abatere ${ab.toFixed(4)} m`} — pică`);
  }
  // Ce spune documentația, măsurat în pagină: Satelit 1120 → cutia unită, 1122 → sanctuarul; Relief 920 / 925.
  proba(azi.praguri.zbor.pleaca > 1120 && azi.praguri.zbor.pleaca <= 1122 && azi.praguri.relief.pleaca > 920 && azi.praguri.relief.pleaca <= 925,
    `pragurile de plecare stau între cele măsurate în pagină (Satelit 1120–1122, Relief 920–925 px)`);
  proba(azi.alTreilea > 30, `pe segmentul sanctuar–far, Casa da Ronca rămâne cu cel puțin ${azi.alTreilea.toFixed(0)} m mai departe`);
  proba(azi.drum.join() === DRUM_BUN,
    `histerezisul între grupuri, cu farul mai aproape cu ${DRUM.join(', ')} m: ${azi.drum.join(' → ')}`);
  const fs_ = azi.faraSanctuar;
  const bunFaraSanctuar = (x) => x.relief.texel < x.texelMaxim && x.zbor.texel < x.texelMaxim && x.relief.grup === 'toate' && x.zbor.grup === 'toate';
  proba(fs_.grupuri === 'casa_da_ronca,far' && bunFaraSanctuar(fs_),
    `fără sanctuar (${fs_.grupuri}): texelul cutiei unite ${fs_.relief.texel.toFixed(3)} / ${fs_.zbor.texel.toFixed(3)} m, sub TEXEL_MAXIM (${fs_.texelMaxim}); pe 4 000 px, cu ținta pe far, rămâne cutia unită (${fs_.relief.grup} / ${fs_.zbor.grup})`);

  // Controalele: umbre.js schimbat, încărcat din text.
  const sursa = textSursa('src/scene/umbre.js');
  const mutatii = [
    ['fără histerezis pe pixel', (r) => r.praguri.relief.revine === r.asteptat.relief.revine && r.praguri.relief.pleaca === r.asteptat.relief.pleaca,
      ['pixel * (curent === toate ? 1.1 : 0.9)', 'pixel']],
    ['fără recitirea texelului când se mută soarele', (r) => r.praguri.zbor.pleaca === r.asteptat.zbor.pleaca,
      ['if (versiune !== umbre.versiuneSoare) {', 'if (versiune === -1) {']],
    ['fără marginea umbrei (expandByScalar)', (r) => Math.abs(r.texel.relief.toate - r.ref.relief.toate) < 1e-9,
      ['c.clone().expandByScalar(lungimeUmbra)', 'c.clone()']],
    ['histerezisul între grupuri de 15 m', (r) => r.drum.join() === DRUM_BUN, ['const HISTEREZIS = 20;', 'const HISTEREZIS = 15;']],
    ['histerezisul între grupuri de 25 m', (r) => r.drum.join() === DRUM_BUN, ['const HISTEREZIS = 20;', 'const HISTEREZIS = 25;']],
    ['fără ramura TEXEL_MAXIM', (r) => bunFaraSanctuar(r.faraSanctuar), ['if (texelUnit > texelMaxim) {', 'if (true) {']],
  ];
  for (const [ce, trece, pereche] of mutatii) {
    const U = await modulDin(muta(sursa, pereche));
    if (!U) { proba(false, `control negativ, ${ce}: ${NEAPLICATA}`); continue; }
    const r = incearca(U);
    proba(!trece(r), `control negativ, ${ce}: proba pică (Relief ${r.praguri.relief.pleaca} / ${r.praguri.relief.revine} px, Satelit ${r.praguri.zbor.pleaca} / ${r.praguri.zbor.revine} px, texelul unit ${r.texel.relief.toate.toFixed(3)} m, ${r.drum.join(' → ')}; fără sanctuar ${r.faraSanctuar.relief.grup})`);
  }
  sanctuar.dispose();
}

await rezumat({ iesi: true });
