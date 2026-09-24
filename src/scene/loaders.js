// Încărcarea resurselor. Loaderele grele (glTF/Draco/KTX2) se vor adăuga aici,
// ca o singură instanță refolosită — deocamdată relieful și stratul lui NDVI.

/**
 * Încarcă heightmap-ul produs de `npm run build-petic`, împreună cu baza lui,
 * produsă de `npm run build-zona`.
 *
 * Fișierul e Uint16 little-endian, rând 0 = nord. Verificăm lungimea, pentru că
 * un fișier trunchiat ar produce un teren aberant în loc de o eroare limpede.
 *
 * Proiectul are o singură hartă, în două rezoluții. Implicit se cere `harta_v1`
 * — peticul de 1 m — care își aduce singur baza, `harta_v0` la 2 m, prin cheia
 * `baza` din sidecar. Numele bazei nu e scris nicăieri în cod: vine din date.
 *
 * `adancime` oprește lanțul de baze. O hartă care s-ar referi la ea însăși — o
 * greșeală de tastare în sidecar — ar încărca la nesfârșit altfel.
 */
export async function incarcaRelief(
  urlBin = '/data/harta_v1-dem.bin',
  urlMeta = '/data/harta_v1-dem.json',
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
  // de transfer: pe o legătură limitată de lățime de bandă tot 4,23 MB trebuie
  // duși oricum. Se scoate din serie așteptarea, nu octeții.
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
 * și pagina index — text/html, 451 de octeți —, în dev și în preview deopotrivă.
 * Un `r.ok` ar trece, iar pagina index ar fi decodată ca strat.
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

    // Float64, ca 0,15 să rămână 0,15: pragurile regulii de culoare cad exact pe
    // niveluri, iar un Float32 le-ar muta cu o fracțiune de miliardime.
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
