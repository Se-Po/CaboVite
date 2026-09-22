// Încărcarea resurselor. Loaderele grele (glTF/Draco/KTX2) se vor adăuga aici,
// ca o singură instanță refolosită — deocamdată doar relieful.

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

  return relief;
}
