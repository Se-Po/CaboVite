import * as THREE from 'three';

// Marea: un singur plan la cota zero.
//
// Fără Water.js — acela cere un uniform de timp actualizat la fiecare cadru, ceea
// ce ar impune o buclă continuă și ar contrazice randarea la cerere. Senzația de
// apă vine din lumina emisferică (cerul se oglindește în ambient) plus reflexul
// soarelui jos, nu din animație.

// Puțin sub zero, nu exact la zero: plaja din golf are cote de ordinul
// centimetrilor, iar un plan fix la 0 ar fi coplanar cu ea și ar pâlpâi.
// Coborârea e sub pragul de vizibilitate la scara scenei.
export const COTA_MARE = -0.25;

export function creeazaMare(paleta, intindere = 40000) {
  const geometrie = new THREE.PlaneGeometry(intindere, intindere, 1, 1);
  geometrie.rotateX(-Math.PI / 2);
  geometrie.translate(0, COTA_MARE, 0);

  const material = new THREE.MeshStandardMaterial({
    color: paleta.mare,
    roughness: 0.32,
    metalness: 0,
  });

  const obiect = new THREE.Mesh(geometrie, material);
  obiect.name = 'mare';
  obiect.matrixAutoUpdate = false;
  obiect.updateMatrix();

  let viu = true;
  return {
    obiect,
    dispose() {
      if (!viu) return;
      viu = false;
      geometrie.dispose();
      material.dispose();
      obiect.removeFromParent();
    },
  };
}
