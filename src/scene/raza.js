import * as THREE from 'three';
import { COTA_MARE } from './mare.js';

// Unde lovește o rază relieful: mersul pe rază peste un câmp de înălțimi.
//
// NU prin `raycaster.intersectObject()` pe plasă. Aceea e neindexată și are milioane
// de triunghiuri: măsurat, 53 ms pe rază. Pe un câmp de înălțimi nu e nevoie să testezi
// triunghiuri — mergi pe rază și compari înălțimea ei cu a terenului dedesubt; unde
// semnul se schimbă, ai trecut prin suprafață, apoi bisectezi. Vreo 1 400 de căutări
// biliniare, 0,19 ms, și e MAI exact: pe fiecare celulă suprafața testată e chiar
// interpolarea pe care o citește `inaltimeLa`, nu triunghiurile plasei.
//
// A stat în punct.js; de când o folosesc și zoomul rotiței (rotita.js) și apucarea
// hărții (camera.js), stă aici, neschimbată.

export const PAS_MARS = 8;    // metri; sub mărimea unei celule de teren văzută de sus
export const BISECTII = 22;   // 8 m / 2²² — mult sub un milimetru

const temp = new THREE.Vector3();

/**
 * Prima trecere a razei de deasupra reliefului sub el.
 *
 * @param {THREE.Ray} raza — cu direcția normată, deci `t` e în metri
 * @param {(x: number, z: number) => number} inaltimeLa
 * @param {{xMin: number, xMax: number, zMin: number, zMax: number}} lim — unde are relieful
 *   valori; pașii din afară rup lanțul, ca reintrarea să nu producă o falsă traversare
 * @param {number} maxim — cât de departe se merge, în metri
 * @returns {number|null} t-ul punctului lovit, sau null
 */
export function marsPeTeren(raza, inaltimeLa, lim, maxim) {
  const inHarta = (p) => p.x >= lim.xMin && p.x <= lim.xMax
                      && p.z >= lim.zMin && p.z <= lim.zMax;
  const subTeren = (t) => {
    raza.at(t, temp);
    return inHarta(temp) ? temp.y - inaltimeLa(temp.x, temp.z) : null;
  };

  let tAnterior = null, semnAnterior = null;
  for (let t = 0; t <= maxim; t += PAS_MARS) {
    const d = subTeren(t);
    if (d === null) { tAnterior = null; semnAnterior = null; continue; }
    if (semnAnterior !== null && semnAnterior > 0 && d <= 0) {
      let a = tAnterior, b = t;
      for (let i = 0; i < BISECTII; i++) {
        const m = (a + b) / 2;
        const dm = subTeren(m);
        if (dm === null || dm > 0) a = m; else b = m;
      }
      return (a + b) / 2;
    }
    tAnterior = t; semnAnterior = d;
  }
  return null;
}

/**
 * Ce se VEDE de-a lungul razei: relieful, suprafața mării sau o clădire — cel mai
 * apropiat. Pentru zoomul spre cursor, apucarea hărții și pivotul rotirii.
 *
 * Pe apă relieful e umplutura de −8 m („artificiu de randare”), iar marea se vede la
 * `COTA_MARE`: apucată pe umplutură, marea aluneca sub cursor cu 11–23%. Clădirile vin
 * din `teren.loveste` (sanctuarul și celelalte, ca la panoul punctului): fără ele, zoomul
 * spre far trecea camera prin turn.
 *
 * @param {THREE.Ray} raza — cu direcția normată
 * @param {{inaltimeLa: Function, lim: object, loveste?: (raza: THREE.Ray) => ({t: number}|null)}} teren
 * @param {number} maxim
 * @returns {number|null}
 */
export function punctVazut(raza, teren, maxim) {
  let t = marsPeTeren(raza, teren.inaltimeLa, teren.lim, maxim) ?? Infinity;
  if (raza.direction.y < 0) {
    const tMare = (raza.origin.y - COTA_MARE) / -raza.direction.y;
    if (tMare > 0 && tMare <= maxim) t = Math.min(t, tMare);
  }
  const c = teren.loveste?.(raza);
  if (c && c.t > 0 && c.t < t) t = c.t;
  return Number.isFinite(t) ? t : null;
}

/**
 * Relieful randat peste tot: alpha unde e alpha, împrejurimile în rest. Pe el merg
 * raza panoului punctului, ocluzia etichetei, zoomul și apucarea hărții — un deal din
 * împrejurimi ascunde ce e în spatele lui. Măsurătorile rămân ale lui alpha.
 *
 * @param {{alpha?: {contine: Function}|null, inaltimeLa: Function, imprejurimi?: {inaltimeLa: Function}|null}} o
 */
export function reliefRandat({ alpha, inaltimeLa, imprejurimi }) {
  return imprejurimi
    ? (x, z) => (alpha && !alpha.contine(x, z) ? imprejurimi.inaltimeLa(x, z) : inaltimeLa(x, z))
    : inaltimeLa;
}
