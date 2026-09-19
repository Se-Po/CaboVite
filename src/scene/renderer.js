import * as THREE from 'three';

// Rendererul și redimensionarea.

/**
 * Tiparul din manual: calculăm noi dimensiunea, cu plafon de pixeli.
 *
 * A trece raportul de pixeli al ecranului direct în `setPixelRatio` e descris în
 * documentația oficială ca puternic nerecomandat: pe un ecran 3x înseamnă de nouă
 * ori mai mulți pixeli de umplut. Plafonul ține costul mărginit indiferent de ecran.
 */
export function redimensioneaza(renderer, maxPixeli = 2560 * 1440) {
  const canvas = renderer.domElement;
  const raport = globalThis.devicePixelRatio || 1;
  let latime = canvas.clientWidth * raport;
  let inaltime = canvas.clientHeight * raport;
  const pixeli = latime * inaltime;
  if (pixeli > maxPixeli) {
    const scara = Math.sqrt(maxPixeli / pixeli);
    latime = Math.floor(latime * scara);
    inaltime = Math.floor(inaltime * scara);
  } else {
    latime = Math.floor(latime);
    inaltime = Math.floor(inaltime);
  }
  const nevoie = canvas.width !== latime || canvas.height !== inaltime;
  // Al treilea argument false: CSS-ul stăpânește dimensiunea afișată.
  if (nevoie) renderer.setSize(latime, inaltime, false);
  return nevoie;
}

/** Întoarce rendererul, sau null dacă WebGL nu pornește. */
export function creeazaRenderer(canvas) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    // outputColorSpace e deja sRGB și ColorManagement e activ — nu le redăm.
    // Tone mapping-ul însă e NoToneMapping implicit, deci îl alegem explicit.
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    return renderer;
  } catch (e) {
    console.warn('WebGL indisponibil:', e.message);
    return null;
  }
}
