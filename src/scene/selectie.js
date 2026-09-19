import * as THREE from 'three';

// Selectorul de poligon: alegi pe hartă bucata care rămâne randată.
//
// Există ca să rezolvi tu o problemă pe care n-am rezolvat-o bine din descriere:
// care parte a promontoriului e subiectul. Pui puncte pe teren, închizi conturul,
// iar ce rămâne în afara lui dispare. Conturul se traduce și în coordonate
// geografice, ca aceeași zonă să poată fi apoi extrasă la rezoluție mai mare.
//
// Nu folosește planuri de tăiere (clipping planes): acelea taie doar cu
// semi-spații, deci numai poligoane convexe, și lasă interiorul mesh-ului gol.
// Aici se reconstruiește plasa, păstrând numai celulele din poligon — marginea
// rămâne o muchie adevărată, iar numărul de triunghiuri chiar scade.

// Peste atâția pixeli de mișcare, gestul e rotire de cameră, nu clic. Fără
// pragul ăsta, orice rotire ar lăsa în urmă un punct nedorit.
const PRAG_CLIC = 5;
// Cât de aproape de primul punct trebuie dat clic ca să se închidă conturul.
const PRAG_INCHIDERE = 20;
const CHEIE_STOCARE = 'cabo:selectie';

// Culori de unealtă, nu de peisaj: trebuie să se vadă și pe calcar, și pe apă,
// în ambele teme. De aceea nu vin din paletă.
const AUR = 0xffd166;
const TERACOTA = 0xe2603f;

/**
 * Testul punct-în-poligon, regula par-impar.
 *
 * Trage o rază spre est din (x, z) și numără laturile traversate: impar
 * înseamnă înăuntru. Comparația `(a.z > z) !== (b.z > z)` tratează o latură ca
 * închisă la un capăt și deschisă la celălalt, ceea ce face ca un punct aflat
 * exact pe orizontala unui vârf să fie numărat o singură dată — altfel conturul
 * ar avea găuri pe rândurile care trec fix prin vârfuri.
 */
export function inPoligon(x, z, puncte) {
  let inauntru = false;
  for (let i = 0, j = puncte.length - 1; i < puncte.length; j = i++) {
    const a = puncte[i], b = puncte[j];
    if ((a.z > z) !== (b.z > z) &&
        x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x)
      inauntru = !inauntru;
  }
  return inauntru;
}

/** Aria poligonului, în metri pătrați (formula șiretului). */
export function arie(puncte) {
  let s = 0;
  for (let i = 0, j = puncte.length - 1; i < puncte.length; j = i++)
    s += (puncte[j].x + puncte[i].x) * (puncte[j].z - puncte[i].z);
  return Math.abs(s / 2);
}

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {THREE.Camera} o.camera
 * @param {object} o.controale                    OrbitControls
 * @param {THREE.Scene} o.scena
 * @param {object} o.meta                         sidecar-ul reliefului (lon/lat)
 * @param {() => THREE.Object3D} o.terenObiect    mesh-ul curent, pentru raycast
 * @param {(x: number, z: number) => number} o.inaltimeLa  drapează conturul
 * @param {(puncte: object[]|null) => object} o.aplica     reconstruiește terenul
 * @param {(stare: object) => void} o.laSchimbare          pentru interfață
 * @param {() => void} o.cereRandare
 */
export function creeazaSelectie(o) {
  const { canvas, camera, controale, scena, meta, terenObiect, inaltimeLa,
          aplica, laSchimbare, cereRandare, areLimitaProprie = false } = o;

  let puncte = [];
  let activ = false;
  let inchis = false;
  let nrTriunghiuri = 0;

  const grup = new THREE.Group();
  grup.name = 'selectie';
  scena.add(grup);

  // depthTest fals: o unealtă trebuie să se vadă și când conturul trece prin
  // spatele unui deal. renderOrder mare, ca să fie desenată ultima.
  const materialLinie = new THREE.LineBasicMaterial({
    color: AUR, depthTest: false, depthWrite: false,
  });
  const materialVarfuri = new THREE.PointsMaterial({
    size: 11, sizeAttenuation: false, vertexColors: true,
    depthTest: false, depthWrite: false,
  });
  let linie = null, varfuri = null;

  const raycaster = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const planApa = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const temp = new THREE.Vector3();

  // --------------------------------------------------------------- geometrie

  function stergeDesen() {
    for (const obj of [linie, varfuri]) {
      if (!obj) continue;
      obj.geometry.dispose();
      obj.removeFromParent();
    }
    linie = null;
    varfuri = null;
  }

  /**
   * Redesenează conturul.
   *
   * Segmentele se împart în pași scurți, iar fiecare pas ia altitudinea
   * terenului de dedesubt: conturul se drapează peste relief în loc să treacă
   * prin dealuri ca o coardă întinsă. Ridicarea de 6 m îl ține deasupra
   * fațetelor de 24 × 31 m fără să pară că plutește.
   */
  function deseneaza() {
    stergeDesen();
    if (!puncte.length) { cereRandare(); return; }

    const traseu = [];
    const nrLaturi = inchis ? puncte.length : puncte.length - 1;
    for (let i = 0; i < nrLaturi; i++) {
      const a = puncte[i], b = puncte[(i + 1) % puncte.length];
      const lung = Math.hypot(b.x - a.x, b.z - a.z);
      const pasi = Math.max(1, Math.min(48, Math.round(lung / 40)));
      for (let k = 0; k < pasi; k++) {
        const t = k / pasi;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        traseu.push(x, inaltimeLa(x, z) + 6, z);
      }
    }
    const ultim = inchis ? puncte[0] : puncte[puncte.length - 1];
    if (puncte.length > 1) traseu.push(ultim.x, inaltimeLa(ultim.x, ultim.z) + 6, ultim.z);

    if (traseu.length >= 6) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(traseu), 3));
      linie = new THREE.Line(g, materialLinie);
      linie.renderOrder = 999;
      grup.add(linie);
    }

    // Primul vârf e teracota cât timp conturul e deschis: acolo se dă clic ca
    // să se închidă.
    const poz = new Float32Array(puncte.length * 3);
    const col = new Float32Array(puncte.length * 3);
    const culoare = new THREE.Color();
    puncte.forEach((p, i) => {
      poz[i * 3] = p.x;
      poz[i * 3 + 1] = inaltimeLa(p.x, p.z) + 6;
      poz[i * 3 + 2] = p.z;
      culoare.setHex(i === 0 && !inchis ? TERACOTA : AUR, THREE.SRGBColorSpace);
      col[i * 3] = culoare.r; col[i * 3 + 1] = culoare.g; col[i * 3 + 2] = culoare.b;
    });
    const gv = new THREE.BufferGeometry();
    gv.setAttribute('position', new THREE.BufferAttribute(poz, 3));
    gv.setAttribute('color', new THREE.BufferAttribute(col, 3));
    varfuri = new THREE.Points(gv, materialVarfuri);
    varfuri.renderOrder = 1000;
    grup.add(varfuri);

    cereRandare();
  }

  // -------------------------------------------------------------- coordonate

  /**
   * Scenă → longitudine/latitudine.
   *
   * Două forme de sidecar, pentru că datele vin din două lanțuri diferite:
   * Copernicus dă direct un `bbox` geografic, iar extragerile din LiDAR sunt în
   * TM06 și poartă cele patru `colturi_geo`. Al doilea caz cere interpolare
   * biliniară, nu liniară pe fiecare axă: un dreptunghi TM06 e rotit față de
   * nord cu unghiul de convergență a meridianelor, iar aici asta înseamnă vreo
   * 35 m pe diagonală — peste zece celule.
   */
  function laGeo(x, z) {
    const w = meta?.latime, h = meta?.inaltime;
    if (!w || !h) return null;
    const u = (x / meta.pasX_m + (w - 1) / 2) / (w - 1); // 0 la vest, 1 la est
    const v = (z / meta.pasZ_m + (h - 1) / 2) / (h - 1); // 0 la nord, 1 la sud

    const b = meta.bbox;
    if (b) {
      return {
        lon: +(b.vest + u * (b.est - b.vest)).toFixed(5),
        lat: +(b.nord - v * (b.nord - b.sud)).toFixed(5),
      };
    }

    const c = meta.colturi_geo;
    if (!c) return null;
    const amesteca4 = (cheie) =>
      (c.nv[cheie] * (1 - u) + c.ne[cheie] * u) * (1 - v) +
      (c.sv[cheie] * (1 - u) + c.se[cheie] * u) * v;
    return { lon: +amesteca4('lon').toFixed(5), lat: +amesteca4('lat').toFixed(5) };
  }

  function stare() {
    const geo = puncte.map((p) => laGeo(p.x, p.z)).filter(Boolean);
    const cutie = geo.length ? {
      nord: Math.max(...geo.map((g) => g.lat)),
      sud: Math.min(...geo.map((g) => g.lat)),
      vest: Math.min(...geo.map((g) => g.lon)),
      est: Math.max(...geo.map((g) => g.lon)),
    } : null;
    return {
      activ, inchis, nrPuncte: puncte.length, nrTriunghiuri, areLimitaProprie,
      arie_km2: puncte.length >= 3 ? +(arie(puncte) / 1e6).toFixed(3) : 0,
      varfuri: geo, cutie,
    };
  }

  const anunta = () => laSchimbare?.(stare());

  // ------------------------------------------------------------ interacțiune

  function punctSubCursor(ev) {
    const r = canvas.getBoundingClientRect();
    cursor.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    cursor.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(cursor, camera);
    const t = terenObiect();
    if (t) {
      const lovit = raycaster.intersectObject(t, false)[0];
      if (lovit) return { x: lovit.point.x, z: lovit.point.z };
    }
    // Dincolo de uscat, raza cade pe planul apei — ca să se poată încercui și
    // mare, nu doar teren.
    if (raycaster.ray.intersectPlane(planApa, temp)) return { x: temp.x, z: temp.z };
    return null;
  }

  function pePixeli(p) {
    const r = canvas.getBoundingClientRect();
    temp.set(p.x, inaltimeLa(p.x, p.z), p.z).project(camera);
    return {
      sx: ((temp.x + 1) / 2) * r.width + r.left,
      sy: ((1 - temp.y) / 2) * r.height + r.top,
    };
  }

  function adauga(p) {
    if (inchis) return;
    puncte.push(p);
    deseneaza();
    salveaza();
    anunta();
  }

  function inchide() {
    if (inchis || puncte.length < 3) return;
    inchis = true;
    nrTriunghiuri = aplica(puncte)?.nrTriunghiuri ?? 0;
    activ = false;
    canvas.style.cursor = '';
    deseneaza();
    salveaza();
    anunta();
  }

  let apasat = null;
  const laApasare = (e) => { if (activ) apasat = { x: e.clientX, y: e.clientY }; };
  const laRidicare = (e) => {
    if (!activ || !apasat) return;
    const dist = Math.hypot(e.clientX - apasat.x, e.clientY - apasat.y);
    apasat = null;
    if (dist > PRAG_CLIC) return; // a fost rotire de cameră, nu clic

    if (puncte.length >= 3) {
      const prim = pePixeli(puncte[0]);
      if (Math.hypot(e.clientX - prim.sx, e.clientY - prim.sy) <= PRAG_INCHIDERE) {
        inchide();
        return;
      }
    }
    const p = punctSubCursor(e);
    if (p) adauga(p);
  };

  const laTasta = (e) => {
    if (!activ) return;
    if (e.key === 'Enter') { e.preventDefault(); inchide(); }
    else if (e.key === 'Escape') { e.preventDefault(); api.opreste(); }
    else if (e.key === 'Backspace' && puncte.length) {
      e.preventDefault();
      puncte.pop();
      deseneaza(); salveaza(); anunta();
    }
  };

  canvas.addEventListener('pointerdown', laApasare);
  canvas.addEventListener('pointerup', laRidicare);
  globalThis.addEventListener('keydown', laTasta);

  // ----------------------------------------------------------------- stocare

  // Se iterează pe aceeași zonă de mai multe ori; o reîncărcare n-ar trebui să
  // șteargă conturul. Stocarea poate lipsi (fereastră privată), deci fiecare
  // atingere e prinsă și pagina funcționează și fără ea.
  //
  // Cheia poartă forma grilei: punctele sunt în metri de scenă, iar scena e
  // centrată pe grilă. Dacă se schimbă harta, aceleași numere ar cădea în alt
  // loc — mai bine se pierde selecția decât să reapară deplasată.
  const cheie = `${CHEIE_STOCARE}:${meta?.latime}x${meta?.inaltime}@${meta?.pasX_m}`;

  function salveaza() {
    try {
      localStorage.setItem(cheie, JSON.stringify({ puncte, inchis }));
    } catch { /* fără memorie locală, selecția trăiește doar în sesiune */ }
  }

  function incarca() {
    let d = null;
    try {
      const brut = localStorage.getItem(cheie);
      if (brut) d = JSON.parse(brut);
    } catch { return; }
    if (!Array.isArray(d?.puncte)) return;
    puncte = d.puncte.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.z));
    inchis = !!d.inchis && puncte.length >= 3;
    if (inchis) nrTriunghiuri = aplica(puncte)?.nrTriunghiuri ?? 0;
    deseneaza();
    anunta();
  }

  // --------------------------------------------------------------------- API

  const api = {
    porneste() {
      if (inchis) api.goleste();
      activ = true;
      canvas.style.cursor = 'crosshair';
      anunta();
    },
    opreste() {
      activ = false;
      canvas.style.cursor = '';
      anunta();
    },
    comuta() { activ ? api.opreste() : api.porneste(); },
    inchide,
    goleste() {
      puncte = [];
      inchis = false;
      nrTriunghiuri = aplica(null)?.nrTriunghiuri ?? 0;
      stergeDesen();
      salveaza();
      anunta();
      cereRandare();
    },
    /** Camera aproape vertical deasupra: cu cât privirea e mai de sus, cu atât
     *  punctul pus pe ecran cade mai aproape de locul dorit pe hartă. */
    vedereDeSus() {
      const d = camera.position.distanceTo(controale.target);
      const polar = Math.max(controale.minPolarAngle, 0.001);
      camera.position.set(
        controale.target.x,
        controale.target.y + d * Math.cos(polar),
        controale.target.z + d * Math.sin(polar)
      );
      camera.lookAt(controale.target);
      controale.update();
      cereRandare();
    },
    stare,
    seteazaNrTriunghiuri(n) { nrTriunghiuri = n; anunta(); },
    incarca,
    dispose() {
      canvas.removeEventListener('pointerdown', laApasare);
      canvas.removeEventListener('pointerup', laRidicare);
      globalThis.removeEventListener('keydown', laTasta);
      stergeDesen();
      materialLinie.dispose();
      materialVarfuri.dispose();
      grup.removeFromParent();
    },
  };
  return api;
}
