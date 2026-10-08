// Încărcarea resurselor: relieful și stratul lui NDVI, sanctuarul, clădirile din afara lui și texturile
// Satelit (KTX2). Loaderele grele stau aici, câte o singură instanță.

/**
 * Încarcă heightmap-ul produs de `npm run build-petic`, împreună cu baza lui,
 * produsă de `npm run build-zona`.
 *
 * Fișierul e Uint16 little-endian, rând 0 = nord. Verificăm lungimea, pentru că
 * un fișier trunchiat ar produce un teren aberant în loc de o eroare limpede.
 *
 * Proiectul are o singură hartă, în două rezoluții. Implicit se cere `harta_v5`
 * — peticul de 1 m — care își aduce singur baza, `harta_v4` la 2 m, prin cheia
 * `baza` din sidecar. Numele bazei nu e scris nicăieri în cod: vine din date.
 *
 * `adancime` oprește lanțul de baze. O hartă care s-ar referi la ea însăși — o
 * greșeală de tastare în sidecar — ar încărca la nesfârșit altfel.
 */
export async function incarcaRelief(
  urlBin = '/data/harta_v5-dem.bin',
  urlMeta = '/data/harta_v5-dem.json',
  adancime = 0,
) {
  const [rMeta, rBin] = await Promise.all([fetch(urlMeta), fetch(urlBin)]);
  if (!rMeta.ok) throw new Error(`metadatele reliefului: HTTP ${rMeta.status} la ${urlMeta}`);
  if (!rBin.ok) throw new Error(`relieful: HTTP ${rBin.status} la ${urlBin}`);

  const meta = await rMeta.json();

  // Stratul NDVI pleacă și el acum, din același motiv ca baza de mai jos: numele
  // hărții abia a sosit, iar descărcarea lui n-are de ce să aștepte relieful.
  // Nu aruncă niciodată — vezi `incarcaStrat`.
  const stratGata = incarcaStrat(meta.nume, meta.latime, meta.inaltime);

  // Baza pleacă ACUM, nu după ce peticul a ajuns întreg și a fost convertit.
  //
  // Numele ei stă în sidecarul tocmai sosit, iar cele două descărcări n-au nimic
  // de împărțit. Ce se câștigă e un dus-întors plus bucla de conversie, nu timpul
  // de transfer: pe o legătură limitată de lățime de bandă cei 5,29 MB ai
  // reliefului și straturilor trebuie duși oricum. Se scoate din serie
  // așteptarea, nu octeții.
  const bazaGata = (meta.baza && adancime < 1)
    ? incarcaRelief(`/data/${meta.baza}-dem.bin`, `/data/${meta.baza}-dem.json`, adancime + 1)
    : null;
  bazaGata?.catch(() => {});   // tratarea adevărată e la `await`, mai jos

  const buf = await rBin.arrayBuffer();
  const asteptat = meta.latime * meta.inaltime * 2;
  if (buf.byteLength !== asteptat)
    throw new Error(`relief trunchiat: ${buf.byteLength} octeți, așteptat ${asteptat}`);

  const brut = new Uint16Array(buf);
  const inaltimi = new Float32Array(brut.length);
  for (let i = 0; i < brut.length; i++) inaltimi[i] = meta.zMin_m + brut[i] * meta.zScara;

  const relief = {
    latime: meta.latime,
    inaltime: meta.inaltime,
    pasX: meta.pasX_m,
    pasZ: meta.pasZ_m,
    inaltimi,
    meta,
  };

  if (bazaGata) relief.baza = await bazaGata;

  // `catch` e plasa pentru o excepție pe care validarea n-a prevăzut-o: un strat
  // stricat nu are voie să oprească scena, oricum s-ar strica.
  relief.ndvi = await stratGata.catch(() => null);

  return relief;
}

/**
 * Stratul NDVI al unei hărți: pe fiecare nod, cât de verde e în infraroșu.
 *
 * Produs de `npm run strat-ndvi` din ortofotoul DGT: 4 biți pe nod, nodul i în
 * octetul i >> 1, pe jumătatea de jos dacă i e par. Codul 0 = fără NDVI; restul
 * se decodează din tabelul `niveluri` din sidecar, nu dintr-o formulă scrisă aici.
 *
 * NU aruncă niciodată. Stratul face culoarea mai bună, dar pagina trebuie să
 * pornească și fără el: întoarce `null`, spune o dată de ce, iar terenul se
 * colorează pe calea care nu-l cere.
 *
 * Validarea e pe CONȚINUT, nu pe `r.ok`. Vite răspunde la un fișier lipsă cu 200
 * și pagina index (text/html), în dev și în preview deopotrivă. Un `r.ok` ar
 * trece; sidecarul pică la `json()`, iar binarul la verificarea lungimii.
 *
 * @returns {Promise<{coduri: Uint8Array, niveluri: Float64Array, meta: object} | null>}
 */
export async function incarcaStrat(nume, latime, inaltime) {
  const lipsa = (motiv) => {
    console.warn(`stratul NDVI ${nume ?? '?'} lipsește (${motiv}) — terenul se colorează fără el`);
    return null;
  };
  try {
    if (!nume) return lipsa('sidecarul hărții n-are `nume`');
    const [rMeta, rBin] = await Promise.all([
      fetch(`/data/${nume}-ndvi.json`), fetch(`/data/${nume}-ndvi.bin`),
    ]);
    if (!rMeta.ok || !rBin.ok) return lipsa(`HTTP ${rMeta.status} / ${rBin.status}`);

    let meta;
    try { meta = await rMeta.json(); } catch { return lipsa('sidecarul nu e JSON'); }
    if (meta?.harta !== nume) return lipsa(`sidecarul e al hărții ${meta?.harta}`);
    if (meta.latime !== latime || meta.inaltime !== inaltime)
      return lipsa(`${meta.latime} × ${meta.inaltime}, harta are ${latime} × ${inaltime}`);
    if (meta.codare?.biti !== 4 || !Array.isArray(meta.niveluri) || meta.niveluri.length !== 16)
      return lipsa('codare necunoscută');

    const buf = await rBin.arrayBuffer();
    const asteptat = Math.ceil((latime * inaltime) / 2);
    if (buf.byteLength !== asteptat) return lipsa(`${buf.byteLength} octeți, așteptat ${asteptat}`);

    // Float64, ca nivelurile să rămână exact cele din sidecar: un Float32 le-ar
    // muta cu până la 2,4e-8 (la 0,6). Regulii nu-i pasă — rampele ei sunt
    // continue —, dar recalcularea independentă din `npm run verifica-teren`
    // compară la 1e-12 și ar raporta nepotriviri. Cu 16 intrări, costul e nul.
    const niveluri = Float64Array.from(meta.niveluri, (v) => (typeof v === 'number' ? v : NaN));
    niveluri[0] = NaN;   // codul 0 înseamnă „fără NDVI", orice ar scrie în tabel
    return { coduri: new Uint8Array(buf), niveluri, meta };
  } catch (e) {
    return lipsa(e.message);
  }
}

/**
 * Straturile bazei și peticului, TOTUL SAU NIMIC — și desprinse de pe relief.
 *
 * Totul sau nimic, fiindcă cele două se încarcă independent: dacă ar veni numai
 * al peticului, dreptunghiul lui s-ar colora după altă logică decât baza din
 * jur și s-ar vedea ca un petic lipit. Mai bine amândouă fără strat.
 *
 * Desprinse, fiindcă obiectul reliefului bazei trăiește cât pagina: getterul
 * `relief` din scena.js îl ține, iar main.js ține scena în `globalThis.__scena`.
 * Lăsat acolo, stratul ar rămâne viu după ce și-a făcut treaba, adică după ce
 * culoarea s-a copt în atribut.
 */
export function straturiNdvi(relief, reliefPetic) {
  const baza = relief.ndvi ?? null;
  const petic = reliefPetic ? (reliefPetic.ndvi ?? null) : null;
  relief.ndvi = null;
  if (reliefPetic) reliefPetic.ndvi = null;
  if (baza && (!reliefPetic || petic)) return { baza, petic };
  if (baza || petic)
    console.warn('a venit numai unul din cele două straturi NDVI — nu-l folosesc nici pe el, '
      + 'ca peticul să nu se coloreze după altă logică decât baza');
  return { baza: undefined, petic: undefined };
}

/**
 * Datele sanctuarului, produse de `npm run build-sanctuar`.
 *
 * NU aruncă niciodată, ca stratul NDVI: sanctuarul se adaugă peste teren, iar
 * pagina trebuie să pornească și fără el. Validarea e tot pe conținut — Vite
 * răspunde la un fișier lipsă cu 200 și pagina index.
 *
 * Ancora (centrul cutiei hărții pe care sunt scrise coordonatele) NU se verifică
 * aici: încărcarea pleacă în paralel cu relieful, deci harta încă nu e aici. O
 * verifică `creeazaSanctuar()`.
 *
 * @returns {Promise<object|null>}
 */
export function incarcaSanctuar(url = '/data/sanctuar_v2.json') {
  return incarcaCladiriDate(url, 'sanctuar', (motiv) => `sanctuarul lipsește (${motiv}) — scena pornește fără el`);
}

/**
 * Clădirile din afara sanctuarului — farul și casele lui, Casa da Ronca —, produse de
 * `npm run build-cladiri`, în aceeași schemă. Aceleași reguli: nu aruncă.
 *
 * @returns {Promise<object|null>}
 */
export function incarcaCladiri(url = '/data/cladiri_v1.json') {
  return incarcaCladiriDate(url, 'cladiri', (motiv) => `clădirile din afara sanctuarului lipsesc (${motiv}) — scena pornește fără ele`);
}

async function incarcaCladiriDate(url, prefix, mesaj) {
  const lipsa = (motiv) => {
    console.warn(mesaj(motiv));
    return null;
  };
  try {
    const r = await fetch(url);
    if (!r.ok) return lipsa(`HTTP ${r.status}`);
    let d;
    try { d = await r.json(); } catch { return lipsa('nu e JSON'); }
    if (!new RegExp(`^${prefix}_v\\d+$`).test(d?.nume ?? '')) return lipsa(`nume necunoscut: ${d?.nume}`);
    if (d.versiune_schema !== 1) return lipsa(`schema ${d.versiune_schema}, aștept 1`);
    for (const k of ['corpuri', 'turnuri', 'cupole', 'ziduri', 'apeduct', 'surse'])
      if (!Array.isArray(d[k])) return lipsa(`lipsește ${k}`);
    if (typeof d.materiale !== 'object' || !d.materiale) return lipsa('lipsesc materialele');
    for (const [k, m] of Object.entries(d.materiale))
      if (!Array.isArray(m?.rgb) || m.rgb.length !== 3 || !m.rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255))
        return lipsa(`materialul ${k} n-are rgb`);
    return d;
  } catch (e) {
    return lipsa(e.message);
  }
}

/**
 * Încărcătorul KTX2 — o singură instanță, cu `detectSupport` înaintea oricărei
 * încărcări, cum cere regula proiectului.
 *
 * Importat dinamic, nu în capul fișierului: `loaders.js` e importat și în Node, de
 * verifica-teren și verifica-sanctuar, iar KTX2Loader își face acolo un pool de
 * workeri de care nu e nevoie. Așa, și în pagină, ajunge într-un fișier separat,
 * cerut numai când trebuie.
 */
export async function creeazaIncarcatorKtx2(renderer) {
  verificaTranscodorul();
  const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
  return new KTX2Loader().detectSupport(renderer);
}

/**
 * Poate porni transcodorul Basis aici? Aruncă dacă nu, înaintea celor ~12 MB de texturi.
 *
 * Workerul lui cere WebAssembly și `new Function` — embind își face funcțiile din text.
 * Un CSP fără 'unsafe-eval' (numai cu 'wasm-unsafe-eval' cade al doilea), WebAssembly
 * oprit de un mod de securitate al browserului: workerul moare atunci fără să spună
 * nimic paginii. Un worker din `blob:` moștenește CSP-ul documentului, deci proba din
 * firul principal e reprezentativă. Un `worker-src` care oprește `blob:` sau un worker
 * care moare din alt motiv nu se văd de aici: pe acelea le prinde limita de timp din
 * `incarcaOrto`.
 */
export function verificaTranscodorul() {
  if (typeof WebAssembly !== 'object' || !WebAssembly) throw new Error('WebAssembly lipsește: transcodorul KTX2 nu poate porni');
  try {
    new WebAssembly.Module(Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
  } catch (e) {
    throw new Error(`WebAssembly refuzat (${e?.message ?? e}): transcodorul KTX2 nu poate porni`);
  }
  try {
    new Function('');
  } catch (e) {
    throw new Error(`new Function refuzat (${e?.message ?? e}): transcodorul KTX2 nu poate porni`);
  }
}

/**
 * Cât poate dura o textură Satelit DUPĂ ce transcodorul a sosit: pornirea workerului,
 * compilarea WASM-ului, coada și transcodarea. Descărcările nu intră.
 *
 * Fără limită, un worker care nu pornește agăța Satelit pentru totdeauna: workerul
 * Basis își așteaptă transcodorul la nesfârșit, WorkerPool nu ascultă 'error', iar
 * `parse()` nu mai cheamă nici `onLoad`, nici `onError`. Rămâneau Relief fără
 * buton și fără avertisment — cu preferința Relief, un buton `aria-busy` pe vecie —,
 * iar `dispose()` nu mai oprea workerii.
 *
 * Măsurat pe desktop (Chrome, 20 de fire): toate cele șapte texturi printr-un singur
 * worker, cu pornirea lui, în 0,40 s (BC7) și 0,29 s (RGBA); cu patru, 0,21 s. Pe un
 * telefon de 10–20 de ori mai lent — estimare, NEVERIFICAT pe un telefon — ar fi 4–8 s,
 * deci limita lasă o margine de cel puțin patru ori.
 */
export const LIMITA_TRANSCODARE_MS = 30_000;

const ABANDON = Symbol('abandon'), EXPIRAT = Symbol('expirat');

/**
 * Promisiunea `p`, sau `ABANDON` când `semnal` se oprește, sau `EXPIRAT` după `limitaMs`
 * de pagină VIZIBILĂ (0: fără limită).
 *
 * Vizibilă, fiindcă pe telefon o filă ascunsă poate fi înghețată cu workeri cu tot, iar
 * la întoarcere un temporizator trecut de termen ar suna înaintea workerului, care n-a
 * apucat să termine (dedus, nemăsurat pe un telefon). Un termen în care pagina a fost
 * ascunsă măcar o clipă nu se numără: ceasul pornește din nou, întreg.
 */
function inCursa(p, semnal, limitaMs) {
  return new Promise((res, rej) => {
    const doc = globalThis.document;
    let ceas = null, ascuns = false, terminat = false;
    const laVizibilitate = () => { if (doc.hidden) ascuns = true; };
    const gata = (f, v) => {
      if (terminat) return;
      terminat = true;
      clearTimeout(ceas);
      semnal?.removeEventListener('abort', laAbandon);
      doc?.removeEventListener?.('visibilitychange', laVizibilitate);
      f(v);
    };
    const laAbandon = () => gata(res, ABANDON);
    const arma = () => {
      ascuns = !!doc?.hidden;
      ceas = setTimeout(() => (ascuns ? arma() : gata(res, EXPIRAT)), limitaMs);
    };
    if (semnal?.aborted) return laAbandon();
    semnal?.addEventListener('abort', laAbandon, { once: true });
    if (limitaMs > 0) {
      doc?.addEventListener?.('visibilitychange', laVizibilitate);
      arma();
    }
    Promise.resolve(p).then((v) => gata(res, v), (e) => gata(rej, e));
  });
}

/** Sidecarul unei texturi Satelit: `<hartă>-orto_vN.json`. Aruncă numai pe greșeli de programare. */
export async function incarcaSidecarOrto(nume, semnal = null) {
  const r = await fetch(`/data/${nume}.json`, { signal: semnal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  let m;
  try { m = await r.json(); } catch { throw new Error('sidecarul nu e JSON'); }
  if (m?.nume !== nume) throw new Error(`sidecarul e al lui ${m?.nume}, nu al lui ${nume}`);
  const b = m.bbox_tm06;
  if (!b || !['xMin', 'xMax', 'yMin', 'yMax'].every((k) => Number.isFinite(b[k])) || !(b.xMax > b.xMin && b.yMax > b.yMin))
    throw new Error('bbox_tm06 lipsă sau greșit');
  if (!Number.isInteger(m.latime) || !Number.isInteger(m.inaltime) || !/^[0-9a-f]{64}$/.test(m.sha256 ?? '') || !Number.isInteger(m.octeti))
    throw new Error('dimensiunile, octeții sau sha256 lipsesc');
  return m;
}

/**
 * Textura Satelit a unei hărți. NU aruncă: fără ea, pagina rămâne pe Relief.
 *
 * Fișierul se verifică înainte de decodare — mărimea, sha256, antetul KTX2 cu
 * lățimea, înălțimea și numărul de niveluri —, fiindcă `parse()` mută bufferul în
 * workerul de transcodare: după el nu mai e nimic de verificat.
 *
 * `semnal` (un AbortSignal) oprește cererile pornite și, dacă fișierul a sosit deja,
 * transcodarea: întoarce `null` fără avertisment — nu lipsește nimic, scena a plecat.
 *
 * `limitaMs`: cât poate dura transcodarea după ce transcodorul a sosit
 * (`LIMITA_TRANSCODARE_MS`); trecută, `null` cu un avertisment.
 *
 * @returns {Promise<{meta: object, textura: THREE.CompressedTexture}|null>}
 */
export async function incarcaOrto(nume, ktx2, metaGata = null, semnal = null, { limitaMs = LIMITA_TRANSCODARE_MS } = {}) {
  const lipsa = (motiv) => {
    if (semnal?.aborted) return null;
    console.warn(`textura Satelit ${nume} lipsește (${motiv})`);
    return null;
  };
  try {
    const meta = metaGata ?? await incarcaSidecarOrto(nume, semnal);
    const r = await fetch(`/data/${nume}.ktx2`, { signal: semnal });
    if (!r.ok) return lipsa(`HTTP ${r.status}`);
    const buf = await r.arrayBuffer();
    if (buf.byteLength !== meta.octeti) return lipsa(`${buf.byteLength} octeți, aștept ${meta.octeti}`);
    const dv = new DataView(buf);
    const magic = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb];
    if (!magic.every((v, i) => dv.getUint8(i) === v)) return lipsa('nu e KTX2');
    const w = dv.getUint32(20, true), h = dv.getUint32(24, true), niv = dv.getUint32(40, true);
    if (w !== meta.latime || h !== meta.inaltime || niv !== meta.niveluri)
      return lipsa(`antetul spune ${w} × ${h}, ${niv} niveluri; sidecarul ${meta.latime} × ${meta.inaltime}, ${meta.niveluri}`);
    // `crypto.subtle` există numai în context securizat (HTTPS, localhost). Un telefon
    // care deschide serverul de dezvoltare pe http://192.168… nu-l are: acolo se
    // sare doar verificarea asta — mărimea și antetul au trecut deja —, nu textura.
    if (globalThis.crypto?.subtle) {
      const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (sha !== meta.sha256) return lipsa('sha256 nu se potrivește');
    } else {
      console.info(`textura Satelit ${nume}: sha256 neverificat (pagina nu e într-un context securizat)`);
    }
    // Abandonată cât se verifica: transcodorul nu se mai cere.
    if (semnal?.aborted) return null;
    // Transcodorul (~0,6 MB) se așteaptă ÎNTÂI, fără limită: e aceeași promisiune pe care
    // o cheamă `parse()`, deci nu se cere de două ori, iar limita de mai jos nu cuprinde
    // și descărcarea lui — pe o legătură lentă ar fi oprit încărcări bune. `init()` e
    // public în r186, dar marcat „TODO: Make this method private”: verifica-pagina pică
    // dacă dispare sau dacă `parse()` nu mai trece prin el.
    if (await inCursa(ktx2.init(), semnal, 0) === ABANDON) return null;
    // parse() nu întoarce o promisiune; o eroare de transcodare vine pe onError. Un
    // worker care n-a pornit nu cheamă nimic: de aceea limita.
    const textura = await inCursa(new Promise((res, rej) => ktx2.parse(buf, res, rej)), semnal, limitaMs);
    if (textura === ABANDON) return null;
    if (textura === EXPIRAT) return lipsa(`transcodorul n-a răspuns în ${limitaMs / 1000} s`);
    return { meta, textura };
  } catch (e) {
    return lipsa(e?.message ?? String(e));
  }
}
