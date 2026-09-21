import * as THREE from 'three';

// Selectorul de cutie: un dreptunghi tras pe teren, plus o bandă de altitudine.
//
// Predecesorul lui desena un poligon pe hartă și tăia numai pe orizontală. Din
// el s-au păstrat tiparele care costaseră scump — raycastul cu cădere pe planul
// apei, `depthTest: false` ca unealta să se vadă prin dealuri, stocarea locală —
// și s-a schimbat ce trebuia schimbat: un dreptunghi se trage, nu se punctează,
// iar verticala are nevoie de comenzi proprii.
//
// De ce dreptunghi și nu poligon, și de ce verticala se reglează altfel:
// scena e de 20 de ori mai lată decât înaltă (X ±1163 m, Z ±1492 m, dar Y de la
// −8 la 143,6). Un gizmo cu mânere egale pe cele trei axe ar da mânere verticale
// de câțiva pixeli lângă unele orizontale de sute, imposibil de apucat la 390 px.
//
// Cutia e aliniată la axele scenei, adică la TM06 — nu la nord. Asta e voit:
// scripturile de construit hărți decupează tot în TM06, iar o cutie rotită față
// de ele ar trebui reeșantionată. Rotația de ~0,7° față de nord o poartă cele
// patru colțuri raportate în longitudine/latitudine, nu geometria.

const AUR = 0x94752f;
const TERACOTA = 0x7a3b2e;
const CHEIE = 'cabo:cutie3d';

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {THREE.Camera} o.camera
 * @param {object} o.controale                             OrbitControls
 * @param {THREE.Scene} o.scena
 * @param {object} o.geo                                   de la creeazaGeo()
 * @param {() => THREE.Object3D} o.terenObiect             pentru raycast
 * @param {(x: number, z: number) => number} o.inaltimeLa
 * @param {(cutie: object|null) => object} o.aplica        regenerează terenul
 * @param {(stare: object) => void} o.laSchimbare          pentru panou
 * @param {() => void} o.cereRandare
 */
export function creeazaSelectie3d(o) {
  const { canvas, camera, controale, scena, geo, terenObiect, inaltimeLa,
          aplica, laSchimbare, cereRandare, cutieInitiala = null } = o;

  const lim = geo.limite;
  // Selectorul e singura sursă de adevăr pentru cutie. Dacă harta vine cu o
  // bandă scrisă în sidecar, ea intră tot pe aici — altfel scena ar tăia după o
  // bandă despre care panoul n-ar ști nimic și ar scrie „toată harta".
  let cutie = cutieInitiala;  // {xMin, xMax, zMin, zMax, yMin, yMax} în metri de scenă
  let activ = false;
  let aplicata = false;
  let eliberat = false;
  let nrTriunghiuri = 0;

  const grup = new THREE.Group();
  grup.name = 'selectie3d';
  scena.add(grup);

  // depthTest fals: o unealtă trebuie văzută și când trece prin spatele unui
  // deal. renderOrder mare, ca să fie desenată ultima.
  //
  // `transparent: true` pe linii NU e pentru transparență — opacitatea lor e 1.
  // three.js sortează în două liste, opacă și transparentă, iar `renderOrder`
  // contează numai ÎN interiorul uneia; lista opacă se desenează prima. Deci un
  // material opac cu renderOrder 999 ajunge tot înaintea unuia transparent cu
  // 998, iar planele-mânere ar spăla muchiile cutiei. Trecute amândouă în lista
  // transparentă, 999 > 998 înseamnă iar ce pare că înseamnă.
  //
  // `fog: false` fiindcă ceața începe la 5000 m, iar pe 390 px încadrarea duce
  // camera la ~4350: muchia depărtată a cutiei ar începe să se decoloreze spre
  // culoarea cerului. O unealtă n-are voie să se piardă în atmosferă.
  const matLinie = new THREE.LineBasicMaterial({
    color: AUR, depthTest: false, depthWrite: false, transparent: true, fog: false,
  });
  const matPlan = new THREE.MeshBasicMaterial({
    color: AUR, transparent: true, opacity: 0.16, fog: false,
    side: THREE.DoubleSide, depthTest: false, depthWrite: false,
  });
  const matPlanActiv = matPlan.clone();
  matPlanActiv.color.setHex(TERACOTA);
  matPlanActiv.opacity = 0.3;

  const geomLinii = new THREE.BufferGeometry();
  geomLinii.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
  const linii = new THREE.LineSegments(geomLinii, matLinie);
  linii.renderOrder = 999;
  linii.visible = false;
  grup.add(linii);

  // Cele două mânere sunt plase adevărate, nu doar desen: pe ele se dă raycast
  // ca să se știe că de mânerul ăla se trage.
  const planuri = { jos: null, sus: null };
  for (const cheie of ['jos', 'sus']) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
    const m = new THREE.Mesh(g, matPlan);
    m.name = `maner-${cheie}`;
    m.renderOrder = 998;
    m.visible = false;
    grup.add(m);
    planuri[cheie] = m;
  }

  const raycaster = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const planApa = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const temp = new THREE.Vector3();

  // --------------------------------------------------------------- geometrie

  function deseneaza() {
    const vizibil = !!cutie;
    linii.visible = vizibil;
    planuri.jos.visible = vizibil;
    planuri.sus.visible = vizibil;
    if (!cutie) { cereRandare(); return; }

    const { xMin, xMax, yMin, yMax, zMin, zMax } = cutie;
    const c = [
      [xMin, yMin, zMin], [xMax, yMin, zMin], [xMax, yMin, zMax], [xMin, yMin, zMax],
      [xMin, yMax, zMin], [xMax, yMax, zMin], [xMax, yMax, zMax], [xMin, yMax, zMax],
    ];
    const muchii = [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]];
    const p = linii.geometry.attributes.position;
    muchii.forEach(([a, b], i) => {
      p.array.set(c[a], i * 6);
      p.array.set(c[b], i * 6 + 3);
    });
    p.needsUpdate = true;
    linii.geometry.computeBoundingSphere();

    for (const [cheie, y] of [['jos', yMin], ['sus', yMax]]) {
      const q = planuri[cheie].geometry.attributes.position;
      q.array.set([
        xMin, y, zMin,  xMax, y, zMin,  xMax, y, zMax,
        xMin, y, zMin,  xMax, y, zMax,  xMin, y, zMax,
      ]);
      q.needsUpdate = true;
      planuri[cheie].geometry.computeBoundingSphere();
    }
    cereRandare();
  }

  // -------------------------------------------------------------- coordonate

  function razaDinEveniment(ev) {
    const r = canvas.getBoundingClientRect();
    cursor.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    cursor.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(cursor, camera);
  }

  /**
   * Punctul de pe teren de sub cursor.
   *
   * NU prin `raycaster.intersectObject()` pe plasă. Aceea e neindexată și are
   * 2,75 milioane de triunghiuri: măsurat, 53 ms pe rază pe desktop, de câteva
   * ori mai mult pe telefon. `pointermove` vine de 60–120 de ori pe secundă,
   * deci tragerea ar fi fost imposibilă exact pe ecranul mic.
   *
   * Pe un câmp de înălțimi nu e nevoie să testezi triunghiuri. Mergi pe rază și
   * compari înălțimea ei cu a terenului dedesubt; unde semnul se schimbă, ai
   * trecut prin suprafață. Apoi bisecție, ca să nimerești între pași. Vreo 1400
   * de căutări biliniare în loc de 2,75 milioane de teste de triunghi — și e
   * exact, nu aproximativ, fiindcă pe fiecare celulă suprafața e chiar
   * interpolarea pe care o citește `inaltimeLa`.
   */
  const PAS_MARS = 8;      // metri; sub mărimea unei celule de teren văzută de sus
  const BISECTII = 22;     // 8 m / 2²² — mult sub un milimetru

  function punctSubCursor(ev) {
    razaDinEveniment(ev);
    const raza = raycaster.ray;
    const inHarta = (p) => p.x >= lim.xMin && p.x <= lim.xMax && p.z >= lim.zMin && p.z <= lim.zMax;
    const subTeren = (t) => {
      raza.at(t, temp);
      return inHarta(temp) ? temp.y - inaltimeLa(temp.x, temp.z) : null;
    };

    // Cât de departe are rost să mergem: diagonala hărții plus distanța până la
    // ea. Dincolo, raza a ieșit demult din zonă.
    const diag = Math.hypot(lim.xMax - lim.xMin, lim.zMax - lim.zMin);
    const maxim = raza.origin.length() + diag * 1.5;

    let tAnterior = null, semnAnterior = null;
    for (let t = 0; t <= maxim; t += PAS_MARS) {
      const d = subTeren(t);
      if (d === null) { tAnterior = null; semnAnterior = null; continue; }
      if (semnAnterior !== null && semnAnterior > 0 && d <= 0) {
        // Traversare de sus în jos: bisectăm între ultimii doi pași.
        let a = tAnterior, b = t;
        for (let i = 0; i < BISECTII; i++) {
          const m = (a + b) / 2;
          const dm = subTeren(m);
          if (dm === null || dm > 0) a = m; else b = m;
        }
        raza.at((a + b) / 2, temp);
        return { x: temp.x, z: temp.z };
      }
      tAnterior = t; semnAnterior = d;
    }

    // Dincolo de uscat, raza cade pe planul apei — ca să se poată cuprinde și
    // mare, nu doar teren.
    if (raza.intersectPlane(planApa, temp)) return { x: temp.x, z: temp.z };
    return null;
  }

  /** Care mâner e sub cursor, dacă vreunul. */
  function manerSubCursor(ev) {
    if (!cutie) return null;
    razaDinEveniment(ev);
    const loviri = raycaster.intersectObjects([planuri.jos, planuri.sus], false);
    if (!loviri.length) return null;
    return loviri[0].object.name === 'maner-sus' ? 'sus' : 'jos';
  }

  /**
   * Cât se mișcă un mâner, din deplasarea pe ecran.
   *
   * Prima variantă proiecta raza pe un plan vertical prin centrul cutiei. E
   * geometric corect și complet nepractic aici: camera stă la ~1600 m, deci o
   * fracțiune de ecran înseamnă sute de metri în lume, iar toată axa Y are 152.
   * O tragere scurtă prăbușea banda dintr-o dată.
   *
   * Aici scara e fixă și nu depinde de cameră: o tragere pe toată înălțimea
   * ecranului parcurge exact tot intervalul de altitudine al hărții. La 780 px
   * înseamnă ~0,2 m pe pixel — destulă finețe, și la fel de previzibil de
   * aproape ca de departe.
   */
  function inaltimeDinTragere(ev) {
    const r = canvas.getBoundingClientRect();
    const dy = (ev.clientY - trage.ecranY) / r.height;
    return prinde(trage.yInitial - dy * (lim.yMax - lim.yMin), lim.yMin, lim.yMax);
  }

  const prinde = (v, min, max) => Math.max(min, Math.min(max, v));

  // Captura de pointer e o comoditate, nu o condiție. `?.` păzește doar
  // împotriva metodei lipsă, nu și a excepției: releasePointerCapture aruncă
  // NotFoundError dacă pointerul n-a fost capturat, iar o excepție acolo ar sări
  // peste regenerarea terenului de după. Deci try/catch, nu `?.`.
  const captureaza = (id) => { try { canvas.setPointerCapture(id); } catch { /* fără captură */ } };
  const elibereaza = (id) => { try { canvas.releasePointerCapture(id); } catch { /* n-a fost */ } };

  function stare() {
    if (!cutie) return { activ, are: false, aplicata: false, nrTriunghiuri };
    const { xMin, xMax, yMin, yMax, zMin, zMax } = cutie;
    // Colțurile în ordinea nv, ne, se, sv — Z crește spre sud.
    const colturi = [[xMin, zMin], [xMax, zMin], [xMax, zMax], [xMin, zMax]]
      .map(([x, z]) => geo.laGeo(x, z)).filter(Boolean);
    const tm = [[xMin, zMin], [xMax, zMax]].map(([x, z]) => geo.laTM06(x, z));
    return {
      activ, are: true, aplicata, nrTriunghiuri,
      scena: { xMin, xMax, yMin: +yMin.toFixed(1), yMax: +yMax.toFixed(1), zMin, zMax },
      latime_m: Math.round(xMax - xMin),
      adancime_m: Math.round(zMax - zMin),
      banda_m: [+yMin.toFixed(1), +yMax.toFixed(1)],
      arie_km2: +((xMax - xMin) * (zMax - zMin) / 1e6).toFixed(3),
      colturi,
      tm06: tm[0] && tm[1] ? {
        xMin: +Math.min(tm[0].x, tm[1].x).toFixed(1), xMax: +Math.max(tm[0].x, tm[1].x).toFixed(1),
        yMin: +Math.min(tm[0].y, tm[1].y).toFixed(1), yMax: +Math.max(tm[0].y, tm[1].y).toFixed(1),
      } : null,
    };
  }

  const anunta = () => laSchimbare?.(stare());

  // ------------------------------------------------------------ interacțiune

  let trage = null; // {fel: 'dreptunghi'|'maner', ...}

  /**
   * Amprenta cutiei, ca să știm dacă o tragere a schimbat ceva.
   *
   * Fără ea, orice clic rătăcit ajungea la `aplica()` și reconstruia toată harta
   * degeaba: ~250 MB de tablouri și 2,75 milioane de triunghiuri pentru zero
   * schimbare — exact RangeError-ul de care se teme comentariul de mai jos.
   */
  const instantaneu = () => (cutie
    ? `${cutie.xMin},${cutie.xMax},${cutie.zMin},${cutie.zMax},${cutie.yMin},${cutie.yMax}`
    : 'fara');

  function laApasare(ev) {
    if (!activ || ev.button !== 0) return;
    const maner = manerSubCursor(ev);
    if (maner) {
      trage = {
        fel: 'maner', care: maner,
        ecranY: ev.clientY,
        yInitial: maner === 'sus' ? cutie.yMax : cutie.yMin,
        inainte: instantaneu(),
      };
      planuri[maner].material = matPlanActiv;
      captureaza(ev.pointerId);
      cereRandare();
      return;
    }
    const p = punctSubCursor(ev);
    if (!p) return;
    trage = { fel: 'dreptunghi', x0: p.x, z0: p.z, inainte: instantaneu() };
    captureaza(ev.pointerId);
  }

  function laMiscare(ev) {
    if (!trage) return;
    if (trage.fel === 'dreptunghi') {
      const p = punctSubCursor(ev);
      if (!p) return;
      // Banda se păstrează dacă exista deja; altfel pornește cuprinzând tot.
      const yMin = cutie ? cutie.yMin : lim.yMin;
      const yMax = cutie ? cutie.yMax : lim.yMax;
      cutie = {
        xMin: prinde(Math.min(trage.x0, p.x), lim.xMin, lim.xMax),
        xMax: prinde(Math.max(trage.x0, p.x), lim.xMin, lim.xMax),
        zMin: prinde(Math.min(trage.z0, p.z), lim.zMin, lim.zMax),
        zMax: prinde(Math.max(trage.z0, p.z), lim.zMin, lim.zMax),
        yMin, yMax,
      };
    } else {
      const y = inaltimeDinTragere(ev);
      // Cele două plane nu se pot trece unul prin altul: banda ar ieși negativă.
      if (trage.care === 'sus') cutie.yMax = Math.max(y, cutie.yMin + 0.5);
      else cutie.yMin = Math.min(y, cutie.yMax - 0.5);
    }
    deseneaza();
    anunta();
  }

  function laRidicare(ev) {
    if (!trage) return;
    elibereaza(ev.pointerId);
    if (trage.fel === 'maner') planuri[trage.care].material = matPlan;
    const { fel, inainte } = trage;
    trage = null;
    // O apăsare fără mișcare nu e o cutie de lățime zero; e un clic în gol.
    if (fel === 'dreptunghi' && cutie && (cutie.xMax - cutie.xMin < 1 || cutie.zMax - cutie.zMin < 1)) {
      cutie = null;
      deseneaza();
      anunta();
      return;
    }
    // Nimic nu s-a mutat: nu reconstruim harta ca să obținem exact ce e deja pe
    // ecran. Un clic în gol nu costă 250 MB.
    if (instantaneu() === inainte) { cereRandare(); return; }
    salveaza();
    // Regenerarea se face AICI, la eliberare, nu în laMiscare.
    //
    // creeazaTeren() alocă până la ~250 MB pentru baza de 1164 × 1493. Chemat pe
    // fiecare cadru de tragere, ar rămâne fără memorie pe telefon — exact
    // RangeError-ul pentru care există garda din porneste(). În timpul tragerii
    // se mișcă doar cutia de linii, care are 24 de vârfuri.
    api.aplica();
  }

  function laTasta(e) {
    if (!activ) return;
    if (e.key === 'Escape') { e.preventDefault(); api.opreste(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); api.goleste(); }
    else if (e.key === 'Enter') { e.preventDefault(); api.aplica(); }
  }

  canvas.addEventListener('pointerdown', laApasare);
  canvas.addEventListener('pointermove', laMiscare);
  canvas.addEventListener('pointerup', laRidicare);
  canvas.addEventListener('pointercancel', laRidicare);
  globalThis.addEventListener('keydown', laTasta);

  // ----------------------------------------------------------------- stocare

  // Se iterează pe aceeași zonă de mai multe ori; o reîncărcare n-ar trebui să
  // șteargă munca.
  function salveaza() {
    try { localStorage.setItem(CHEIE, JSON.stringify(cutie)); } catch { /* privat */ }
  }
  function incarca() {
    try {
      const s = JSON.parse(localStorage.getItem(CHEIE) || 'null');
      if (s && Number.isFinite(s.xMin) && Number.isFinite(s.yMax)) {
        cutie = s;
        deseneaza();
        anunta();
        return true;
      }
    } catch { /* privat */ }
    return false;
  }

  // --------------------------------------------------------------------- API

  // Comenzile OrbitControls se schimbă cât ține unealta, altfel fură fiecare
  // tragere. La mouse: stânga desenează, dreapta rotește.
  //
  // `touches` trebuie schimbat separat de `mouseButtons` — OrbitControls le
  // citește din două locuri diferite, iar implicitul `{ ONE: TOUCH.ROTATE }`
  // înseamnă că pe telefon o tragere cu un deget ar roti camera ȘI ar desena
  // dreptunghiul în același timp. Adică exact pe ecranul de 390 px, pe care
  // CLAUDE.md cere să verific, unealta n-ar fi mers deloc.
  //
  // Se salvează ce era înainte și se pune la loc la ieșire, ca să nu presupunem
  // configurația altcuiva.
  let comenziVechi = null;

  const api = {
    porneste() {
      if (activ) return;
      activ = true;
      comenziVechi = {
        mouseButtons: { ...controale.mouseButtons },
        touches: { ...controale.touches },
      };
      controale.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controale.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
      canvas.style.cursor = 'crosshair';
      anunta();
    },
    opreste() {
      if (!activ) return;
      activ = false;
      if (comenziVechi) {
        controale.mouseButtons = comenziVechi.mouseButtons;
        controale.touches = comenziVechi.touches;
      }
      comenziVechi = null;
      canvas.style.cursor = '';
      anunta();
    },
    comuta() { activ ? api.opreste() : api.porneste(); },

    /** Regenerează terenul cu cutia curentă. */
    aplica() {
      nrTriunghiuri = aplica(cutie)?.nrTriunghiuri ?? 0;
      aplicata = !!cutie;
      anunta();
    },

    goleste() {
      cutie = null;
      deseneaza();
      salveaza();
      api.aplica();
    },

    /** Schimbă numai banda de altitudine — pentru câmpurile din panou. */
    seteazaBanda(min, max) {
      if (!cutie) return;
      cutie.yMin = prinde(Math.min(min, max), lim.yMin, lim.yMax);
      cutie.yMax = prinde(Math.max(min, max), lim.yMin, lim.yMax);
      if (cutie.yMax - cutie.yMin < 0.5) cutie.yMax = cutie.yMin + 0.5;
      deseneaza();
      salveaza();
      api.aplica();
    },

    /** Cuprinde toată harta — punctul de pornire pentru o selecție nouă. */
    tot() {
      cutie = { xMin: lim.xMin, xMax: lim.xMax, zMin: lim.zMin, zMax: lim.zMax,
                yMin: lim.yMin, yMax: lim.yMax };
      deseneaza();
      salveaza();
      api.aplica();
    },

    /** Privirea de sus face dreptunghiul mult mai ușor de nimerit. */
    vedereDeSus() {
      const d = camera.position.distanceTo(controale.target);
      const polar = Math.max(controale.minPolarAngle, 0.001);
      camera.position.set(
        controale.target.x,
        controale.target.y + d * Math.cos(polar),
        controale.target.z + d * Math.sin(polar),
      );
      camera.lookAt(controale.target);
      controale.update();
      cereRandare();
    },

    stare,
    incarca,
    /** Cutia curentă, pentru scenă la pornire — înainte de prima construcție. */
    cutieCurenta: () => (cutie ? { ...cutie } : null),
    seteazaNrTriunghiuri(n) { nrTriunghiuri = n; aplicata = !!cutie; anunta(); },

    dispose() {
      if (eliberat) return; // schimbarea de capitol poate chema de două ori
      eliberat = true;
      if (activ) api.opreste();
      cutie = null;
      trage = null;
      canvas.removeEventListener('pointerdown', laApasare);
      canvas.removeEventListener('pointermove', laMiscare);
      canvas.removeEventListener('pointerup', laRidicare);
      canvas.removeEventListener('pointercancel', laRidicare);
      globalThis.removeEventListener('keydown', laTasta);
      linii.geometry.dispose();
      planuri.jos.geometry.dispose();
      planuri.sus.geometry.dispose();
      matLinie.dispose();
      matPlan.dispose();
      matPlanActiv.dispose();
      grup.removeFromParent();
    },
  };
  return api;
}
