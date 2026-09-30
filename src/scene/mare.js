import * as THREE from 'three';
import { GLSL_CER } from './cer.js';

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

/** Metri de aer după care ceața mării ajunge la 63% (1 − 1/e). */
export const LUNGIME_CEATA_MARE = 10000;

const UNIFORME_CER = ['sunPosition', 'rayleigh', 'turbidity', 'mieCoefficient', 'mieDirectionalG', 'expunereCer'];

/**
 * Ceața mării, pe fiecare pixel: culoarea cerului la orizont, pe azimutul privirii,
 * trecută prin același AgX și aceeași conversie de ieșire ca cerul însuși. Se
 * cheamă din `onBeforeCompile`, pe orice material al mării.
 *
 * Și cu altă lege decât restul scenei: exponențială, cu 10 km lungime, nu liniară
 * între 5 și 24 km. De la câteva sute de metri înălțime, 24 km cad la 6 pixeli sub
 * orizont, deci marea rămânea închisă până la linia cerului și se vedea o dungă.
 * Aerul dintre ochi și marea îndepărtată o luminează treptat.
 *
 * Un material fără tone mapping (marea fotografiată a vederii Satelit) n-are
 * funcția AgX în shader; atunci se include de mână — culoarea cerului trebuie să
 * treacă prin ea, altfel ceața n-ar mai avea culoarea cerului de deasupra.
 */
export function ceataCer(sh, cer) {
  for (const k of UNIFORME_CER) sh.uniforms[k] = cer.uniforme[k];
  sh.vertexShader = sh.vertexShader
    .replace('void main() {', 'varying vec3 vPozLume;\nvoid main() {')
    .replace('#include <project_vertex>', '#include <project_vertex>\n\tvPozLume = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('void main() {', `varying vec3 vPozLume;
#ifndef TONE_MAPPING
#include <tonemapping_pars_fragment>
#endif
${GLSL_CER}
void main() {`)
    .replace('#include <fog_fragment>', `#ifdef USE_FOG
	float fogFactor = 1.0 - exp( - vFogDepth / ${LUNGIME_CEATA_MARE.toFixed(1)} );
	vec3 dirCer = vPozLume - cameraPosition;
	dirCer = normalize( vec3( dirCer.x, 0.0, dirCer.z ) );
	vec3 culCeata = AgXToneMapping( culoareCer( dirCer ) );
	culCeata = linearToOutputTexel( vec4( culCeata, 1.0 ) ).rgb;
	gl_FragColor.rgb = mix( gl_FragColor.rgb, culCeata, fogFactor );
#endif`);
}

/**
 * @param {object} paleta
 * @param {{uniforme: object}|null} [cer] cerul din cer.js. Cu el, ceața mării ia
 *   culoarea cerului pe direcția fiecărui pixel, în loc de una singură: cerul e mai
 *   luminos spre soare, iar o ceață de o singură culoare ar lăsa o linie vizibilă la
 *   orizont. Fără el, ceața obișnuită.
 * @param {number} [intindere] 120 km, de două ori planul îndepărtat al camerei:
 *   marginea planului stă mereu dincolo de ceața completă (24 km), deci nu se vede.
 */
export function creeazaMare(paleta, cer = null, intindere = 120000) {
  const geometrie = new THREE.PlaneGeometry(intindere, intindere, 1, 1);
  geometrie.rotateX(-Math.PI / 2);
  geometrie.translate(0, COTA_MARE, 0);

  const material = new THREE.MeshStandardMaterial({
    color: paleta.mare,
    roughness: 0.32,
    metalness: 0,
  });
  if (cer) {
    material.onBeforeCompile = (sh) => ceataCer(sh, cer);
    material.customProgramCacheKey = () => 'mare-ceata-cer';
  }

  const obiect = new THREE.Mesh(geometrie, material);
  obiect.name = 'mare';
  obiect.matrixAutoUpdate = false;
  obiect.updateMatrix();

  let viu = true;
  return {
    obiect,
    material,
    dispose() {
      if (!viu) return;
      viu = false;
      geometrie.dispose();
      material.dispose();
      obiect.removeFromParent();
    },
  };
}
