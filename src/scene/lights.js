import * as THREE from 'three';

// Lumina.
//
// Soarele stă jos și aproape perpendicular pe peretele falezei. Nu e o alegere
// decorativă: stratele înclinate și adânciturile din calcar se citesc doar în
// lumină razantă — la soare de amiază peretele se aplatizează. Aceeași regulă e
// scrisă și în skill-ul de fotografie pentru urmele de dinozauri.

export function creeazaLumini(paleta, scara = 4000) {
  const grup = new THREE.Group();
  grup.name = 'lumini';

  const soare = new THREE.DirectionalLight(0xfff0dc, 2.1);
  const elevatie = (18 * Math.PI) / 180;   // jos
  const azimut = (244 * Math.PI) / 180;    // vest-sud-vest: razant peste perete
  // Aceeași convenție ca la cameră: azimut geografic, nordul e −Z.
  soare.position.set(
    scara * Math.cos(elevatie) * Math.sin(azimut),
    scara * Math.sin(elevatie),
    -scara * Math.cos(elevatie) * Math.cos(azimut)
  );
  grup.add(soare);

  // Emisferica dă mării ambientul ei de culoarea cerului — de acolo vine cea mai
  // mare parte din senzația de apă, fără nicio animație.
  const cer = new THREE.HemisphereLight(paleta.cer, paleta.mare, 1.15);
  grup.add(cer);

  let viu = true;
  return {
    obiect: grup,
    soare,
    dispose() {
      if (!viu) return;
      viu = false;
      soare.dispose?.();
      cer.dispose?.();
      grup.removeFromParent();
    },
  };
}
