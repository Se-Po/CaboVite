import * as THREE from 'three';
import { arcada, corp, creeazaScriitor, cupola, piramida, placa, placaVerticala, prisma, rama, turn, zid } from './sanctuar-forme.js';
import { creeazaDrapaj } from './drapaj.js';

// Santuário de Nossa Senhora do Cabo Espichel, pe hartă.
//
// Geometria vine gata măsurată din public/data/sanctuar_vN.json: acoperișurile
// ca plane găsite pe MDS-ul DGT, turnurile, cupolele, zidurile ruinelor și ale
// incintei, apeductul. Aici doar se construiește, într-un singur Mesh, cu același
// material ca terenul — fațete plate, culoare pe vârf —, ca amândouă să stea la
// fel în lumină.
//
// Singurul lucru care se calculează aici e TALPA: cota de jos a fiecărui perete,
// luată din relieful paginii (`inaltimeLa`, interpolat biliniar pe grilă), nu din
// LiDAR-ul sanctuarului. Pereții coboară la cel mai jos punct din colțurile și de
// la mijlocul laturilor conturului, minus o jumătate de metru — marja care acoperă
// diferența dintre interpolare și triunghiurile plasei, ca nicăieri să nu rămână o
// fantă de lumină între clădire și teren.
//
// Nu aruncă. O greșeală aici ar dărâma, prin `construieste()`, toată scena, cu
// teren cu tot; așa că fiecare element se construiește în try-ul lui, iar un
// element stricat se sare cu un avertisment.
//
// Același cod construiește și clădirile din afara sanctuarului (cladiri_vN.json:
// farul, casele lui, Casa da Ronca). Acelea n-au fațadă, cruzeiro sau etichetă, iar
// fiecare element poartă un `grup`: umbrele se strâng pe câte unul.

/**
 * @param {{ date: object|null, inaltimeLa: (x: number, z: number) => number, ancora: {x: number, y: number},
 *           retea?: {relief: object, reliefPetic: object|null, pastreaza?: Function, subPetic?: Function},
 *           eticheta?: string }} optiuni
 *   `retea` sunt plasele terenului, ca suprafețele să se așeze pe triunghiurile lor;
 *   `eticheta` începe avertismentele și numește obiectul.
 * @returns {null | { obiect: THREE.Mesh, obiecte: THREE.Mesh[], nrTriunghiuri: {cladiri: number, drapaj: number}, poi: object, surse: object[], dispose(): void }}
 */
export function creeazaSanctuar({ date, inaltimeLa, ancora, retea, eticheta = 'sanctuar' }) {
  if (!date) return null;
  try {
    // Datele sunt în coordonatele unei hărți anume. Pe alta ar ateriza la sute de metri.
    if (!ancora || date.ancora_tm06?.x !== ancora.x || date.ancora_tm06?.y !== ancora.y) {
      console.warn(`${eticheta}: ${date.nume} e ancorat în (${date.ancora_tm06?.x}, ${date.ancora_tm06?.y}), harta în (${ancora?.x}, ${ancora?.y}) — nu-l așez`);
      return null;
    }
    const cul = Object.fromEntries(Object.entries(date.materiale).map(([k, m]) => [k, m.rgb]));
    // `let`, și golit imediat după predare: închiderile de mai jos (`loveste`, `dispose`)
    // țin viu contextul funcției, iar tablourile scriitorului, dublate prin creștere,
    // ar rămâne în RAM lângă atributele geometriei — 1,8 MiB măsurați.
    let s = creeazaScriitor();
    let sarite = 0;
    // Pentru fiecare element, intervalul lui de triunghiuri în geometria comună:
    // panoul punctului caută clădirea lovită numai acolo.
    const intervale = [];
    // Datele unui element: numai numere finite. JSON n-are NaN, dar are `null`, iar
    // `null` intră în aritmetică drept 0 — un colț mutat tăcut în originea scenei.
    const valid = (o) => (Array.isArray(o) ? o.every(valid)
      : o === null ? false
        : typeof o === 'object' ? Object.values(o).every(valid)
          : typeof o !== 'number' || Number.isFinite(o));
    const incearca = (cheie, f, parte = cheie, element = null) => {
      const n0 = s.nrTriunghiuri;
      try {
        if (element && !valid(element)) throw new Error('date lipsă sau nefinite');
        f();
        // O coordonată lipsă din date nu aruncă: dă NaN. Elementul se derulează înapoi.
        if (!s.finite(n0)) throw new Error('coordonate nefinite');
      } catch (e) { s.inapoi(n0); sarite++; console.warn(`${eticheta}: ${cheie} sărit — ${e.message}`); }
      if (s.nrTriunghiuri > n0) intervale.push({ cheie: parte, grup: element?.grup ?? null, t0: n0, t1: s.nrTriunghiuri });
    };
    /** Cota cea mai joasă a reliefului în colțurile unui contur și la mijlocul laturilor, minus 0,5 m. */
    const talpa = (puncte, inchis = true) => {
      let m = Infinity;
      for (let k = 0; k < puncte.length; k++) {
        const p = puncte[k];
        m = Math.min(m, inaltimeLa(p[0], p[1]));
        const q = puncte[(k + 1) % puncte.length];
        if (inchis || k + 1 < puncte.length) m = Math.min(m, inaltimeLa((p[0] + q[0]) / 2, (p[1] + q[1]) / 2));
      }
      return m - 0.5;
    };

    // Un corp cu `baza` nu stă pe teren: etajul de peste o galerie, o streașină.
    for (const c of date.corpuri) incearca(c.cheie, () => corp(s, c.contur, c.baza ?? talpa(c.contur), c.plane, cul[c.perete], cul[c.acoperis], { jos: Boolean(c.jos) }), c.cheie, c);
    for (const t of date.turnuri) incearca(t.cheie, () => turn(s, t.contur, talpa(t.contur),
      { registru: t.registru ?? t.cornisa - 3, cornisa: t.cornisa, platforma: t.platforma, varf: t.varf, goluri: t.goluri, adancimeGol: t.adancime_gol }, cul), t.cheie, t);
    // Arcadele aripilor și pasajele corpurilor de legătură. Talpa: cel mai jos punct al
    // terenului de-a lungul fețelor, la fiecare 2 m, minus 0,5 m.
    for (const a of date.arcade ?? []) incearca(a.cheie, () => {
      const [u0, u1] = [a.stalpi[0][0], a.stalpi[a.stalpi.length - 1][0]];
      const linie = [];
      for (let u = u0; u <= u1 + 1e-6; u += 2) linie.push([a.a[0] + a.d[0] * u, a.a[1] + a.d[1] * u]);
      // În date, `cheie` e numele elementului; cota cheii arcului e `cheie_arc`.
      arcada(s, { ...a, cheie: a.cheie_arc, talpa: talpa(linie, false), pardoseala: a.pardoseala ?? null }, { stalp: cul.cantaria, perete: cul.var, pardoseala: cul.cantaria });
    }, a.cheie, a);
    // Detaliile fațadelor: rame, uși, cornișe, trepte — plăci scoase din perete.
    for (const q of date.detalii ?? []) incearca(q.cheie, () => {
      if (q.tip === 'pinaclu') piramida(s, q.baza, q.y[0], q.y[1], cul[q.material]);
      else if (q.tip === 'rama') rama(s, q, cul[q.material]);
      else s.cuOcluzie(q.ocluzie ?? 1, () => placa(s, q, cul[q.material]));
    }, q.parte ?? q.cheie, q);
    if (date.fatada) incearca('fatada', () => {
      const f = date.fatada;
      placaVerticala(s, f.a, f.b, f.spre_interior, f.profil, talpa([f.a, f.b], false), cul.var, cul.cantaria);
    }, 'fatada', date.fatada);
    for (const c of date.cupole) incearca(c.cheie, () => {
      prisma(s, c.contur, talpa(c.contur), c.cornisa, cul.var, cul.cupola);
      const [x0, z0] = c.contur[0];
      // O cheie de material greșită ar da o culoare nedefinită, scrisă tăcut ca negru.
      if (c.materiale_profil && (c.materiale_profil.length !== c.profil.length - 1 || !c.materiale_profil.every((k) => cul[k])))
        throw new Error('materiale_profil nu se potrivește cu profilul');
      cupola(s, c.centru, c.profil, c.laturi, Math.atan2(z0 - c.centru[1], x0 - c.centru[0]),
        cul[c.material], c.materiale_profil ? c.materiale_profil.map((k) => cul[k]) : null);
    }, c.cheie, c);
    for (const z of [...date.ziduri, ...date.apeduct]) incearca(z.cheie, () => zid(s, z.linie, talpa(z.linie, false), z.sus, z.grosime, cul[z.material]), z.cheie, z);
    for (const c of date.cosuri ?? []) incearca(c.cheie, () => prisma(s, c.contur, c.baza, c.sus, cul[c.material]), c.parte ?? c.cheie, c);
    if (date.cruzeiro) incearca('cruzeiro', () => {
      // Platforma cu trei trepte și crucea. Dimensiunile sunt ale fotografiilor, NEVERIFICATE pe LiDAR:
      // crucea e mai subțire decât pixelul MDS-ului.
      const [x, z] = date.cruzeiro.centru, y = inaltimeLa(x, z);
      const pat = (l) => [[x - l, z - l], [x + l, z - l], [x + l, z + l], [x - l, z + l]];
      prisma(s, pat(1.5), y - 0.5, y + 0.25, cul.cantaria);
      prisma(s, pat(1.15), y + 0.25, y + 0.5, cul.cantaria);
      prisma(s, pat(0.8), y + 0.5, y + 0.75, cul.cantaria);
      prisma(s, pat(0.4), y + 0.75, y + 2.0, cul.cantaria);
      prisma(s, pat(0.16), y + 2.0, y + 4.6, cul.cantaria);
      prisma(s, [[x - 0.7, z - 0.16], [x + 0.7, z - 0.16], [x + 0.7, z + 0.16], [x - 0.7, z + 0.16]], y + 3.7, y + 4.0, cul.cantaria);
    });

    const geometrie = new THREE.BufferGeometry();
    // `pozitii` rămâne pentru `loveste` și se stinge la dispose(); restul predării
    // stă într-un bloc, deci nu-l mai ține nicio închidere.
    let pozitii;
    {
      const predat = s.preda();
      s = null;
      pozitii = predat.pozitii;
      geometrie.setAttribute('position', new THREE.BufferAttribute(pozitii, 3));
      geometrie.setAttribute('color', new THREE.BufferAttribute(predat.culori, 3, true));
      geometrie.setAttribute('ocluzie', new THREE.BufferAttribute(predat.ocluzie, 1, true));
      // Cutia și sfera se scriu din ce s-a strâns, fără o a doua trecere prin vârfuri.
      const c = predat.cutie;
      geometrie.boundingBox = new THREE.Box3(new THREE.Vector3(c.xMin, c.yMin, c.zMin), new THREE.Vector3(c.xMax, c.yMax, c.zMax));
      geometrie.boundingSphere = geometrie.boundingBox.getBoundingSphere(new THREE.Sphere());
    }
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });
    // Ocluzia pe vârf înmulțește numai lumina indirectă, exact unde ar face-o un aoMap:
    // după aomap_fragment. Soarele rămâne întreg — de el se ocupă umbrele.
    material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float ocluzie;\nvarying float vOcluzie;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOcluzie = ocluzie;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vOcluzie;')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= vOcluzie;');
    };
    material.customProgramCacheKey = () => 'sanctuar-ocluzie';
    const obiect = new THREE.Mesh(geometrie, material);
    obiect.name = eticheta;
    obiect.matrixAutoUpdate = false;
    obiect.updateMatrix();

    // Suprafețele de pe teren, într-un try al lor: fără ele clădirile rămân.
    let drapaj = null;
    if (retea && date.suprafete?.length) {
      try { drapaj = creeazaDrapaj({ suprafete: date.suprafete, culori: cul, ...retea }); } catch (e) { console.warn(`${eticheta}: suprafețele sărite — ${e.message}`); }
    }

    const nrTriunghiuri = { cladiri: pozitii.length / 9, drapaj: drapaj?.nrTriunghiuri ?? 0 };

    // Cutia fiecărui element, pentru o respingere ieftină înainte de triunghiuri.
    for (const iv of intervale) {
      const b = new THREE.Box3();
      for (let k = iv.t0 * 9; k < iv.t1 * 9; k += 3) b.expandByPoint(new THREE.Vector3(pozitii[k], pozitii[k + 1], pozitii[k + 2]));
      iv.cutie = b;
    }
    // Cutia clădirilor, fără apeduct: umbrele se strâng pe ea. Apeductul merge ~550 m
    // spre est și ar lărgi fereastra luminii de două ori, pentru umbre de 2–8 m.
    const cutieCladiri = new THREE.Box3();
    for (const iv of intervale) if (!iv.cheie.startsWith('apeduct')) cutieCladiri.union(iv.cutie);
    // Cutia fiecărui grup, pentru datele care își numesc grupurile.
    const cutiiGrupuri = new Map();
    for (const iv of intervale) if (iv.grup) (cutiiGrupuri.get(iv.grup) ?? cutiiGrupuri.set(iv.grup, new THREE.Box3()).get(iv.grup)).union(iv.cutie);
    /**
     * Prima clădire pe care o lovește raza: cutiile în ordinea intrării, apoi
     * Möller–Trumbore numai pe triunghiurile elementului. Întoarce distanța de-a
     * lungul razei, cheia elementului și punctul, sau null.
     */
    const o = new THREE.Vector3(), d = new THREE.Vector3(), tmp = new THREE.Vector3();
    const loveste = (raza) => {
      if (!viu || !pozitii) return null;
      o.copy(raza.origin); d.copy(raza.direction);
      const cand = [];
      // Cu originea în cutie, intersectBox dă punctul de IEȘIRE; atunci cutia se
      // cercetează prima, cu distanța 0 — altfel `break`-ul de mai jos ar sări o
      // lovitură mai apropiată. Camera ajunge acolo: la 80 m de pivot, aproape de
      // orizontală, stă la ~135 m, sub coamele aripilor.
      for (const iv of intervale) { const p = raza.intersectBox(iv.cutie, tmp); if (p) cand.push({ iv, t: iv.cutie.containsPoint(o) ? 0 : p.distanceTo(o) }); }
      cand.sort((a, b) => a.t - b.t);
      let best = null;
      for (const { iv, t } of cand) {
        if (best && t > best.t) break;
        for (let k = iv.t0 * 9; k < iv.t1 * 9; k += 9) {
          const ax = pozitii[k], ay = pozitii[k + 1], az = pozitii[k + 2];
          const e1x = pozitii[k + 3] - ax, e1y = pozitii[k + 4] - ay, e1z = pozitii[k + 5] - az;
          const e2x = pozitii[k + 6] - ax, e2y = pozitii[k + 7] - ay, e2z = pozitii[k + 8] - az;
          const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-9) continue;
          const inv = 1 / det, tx = o.x - ax, ty = o.y - ay, tz = o.z - az;
          const u = (tx * px + ty * py + tz * pz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
          const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (tt > 1e-6 && (!best || tt < best.t)) best = { t: tt, cheie: iv.cheie };
        }
      }
      if (!best) return null;
      const p = raza.at(best.t, new THREE.Vector3());
      return { t: best.t, cheie: best.cheie, x: p.x, y: p.y, z: p.z };
    };
    if (sarite) console.warn(`${eticheta}: ${sarite} elemente sărite`);
    let viu = true;
    return {
      obiect,
      obiecte: [obiect, ...(drapaj?.obiecte ?? [])],
      nrTriunghiuri,
      cutieCladiri,
      cutiiGrupuri,
      loveste,
      poi: date.poi ?? null,
      surse: date.surse,
      dispose() {
        if (!viu) return;
        viu = false;
        geometrie.dispose();
        geometrie.deleteAttribute('position');
        geometrie.deleteAttribute('color');
        geometrie.deleteAttribute('ocluzie');
        // obiectul întors trăiește în globalThis.__scena: fără asta, `loveste` ar ține
        // pozițiile vii și după dispose()
        pozitii = null;
        intervale.length = 0;
        material.dispose();
        obiect.removeFromParent();
        drapaj?.dispose();
      },
    };
  } catch (e) {
    console.warn(`${eticheta}: nu s-a putut construi — ${e.message}`);
    return null;
  }
}
