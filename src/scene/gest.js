import * as THREE from 'three';
import { STARE } from './camera.js';

// Ce gest face utilizatorul cu harta: cursorul care îl spune și pivotul rotirii.
//
// Cursorul îl desenează CSS-ul (main.css, `html[data-gest]`), după starea pe care o
// scrie modulul ăsta: `mutare` cât ții butonul stâng — sau un deget —, `rotire` cât
// ții butonul drept — sau două degete. Pe `<html>`, nu pe canvas: o tragere care
// trece peste text sau peste un panou își păstrează cursorul.
//
// Starea se citește din controale la `start`, după ce au hotărât ce fac — cu Shift,
// butonul stâng rotește. `start` înseamnă „starea s-a schimbat”, nu „a început un
// gest”: de la două degete la unul vine din nou, cu mutarea, fără `end` între ele.
// Rotița emite și ea `start`, cu starea NIMIC: se ignoră.
//
// Pivotul e o sferă aurie pe ținta camerei, cât ține rotirea — punctul în jurul
// căruia se rotește, ca la Revit și Potree. Se proiectează pe cadrul care se desenează,
// după `camera.updateMatrixWorld()`, ca eticheta. Se stinge printr-o tranziție CSS,
// fără niciun cadru cerut; sub prefers-reduced-motion regula globală o face pe loc.

const GEST = {
  [STARE.ROTIRE]: 'rotire', [STARE.DEGET_ROTIRE]: 'rotire', [STARE.DEGETE_ZOOM_ROTIRE]: 'rotire',
  [STARE.MUTARE]: 'mutare', [STARE.DEGET_MUTARE]: 'mutare',
};

/**
 * @param {{gazda: HTMLElement, canvas: HTMLCanvasElement, camera: THREE.Camera, controale: object}} o
 */
export function creeazaGest({ gazda, canvas, camera, controale }) {
  const radacina = document.documentElement;
  const pivot = document.createElement('span');
  pivot.className = 'pivot-rotire';
  pivot.setAttribute('aria-hidden', 'true');
  gazda.appendChild(pivot);
  const v = new THREE.Vector3();
  let gest = null;

  const asaza = () => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    v.copy(controale.target).project(camera);
    const r = canvas.getBoundingClientRect();
    const x = r.left + (v.x * 0.5 + 0.5) * cw, y = r.top + (-v.y * 0.5 + 0.5) * ch;
    pivot.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };

  const seteaza = (g) => {
    gest = g;
    if (g) radacina.dataset.gest = g; else delete radacina.dataset.gest;
    pivot.classList.toggle('activ', g === 'rotire');
    if (g === 'rotire') { camera.updateMatrixWorld(); asaza(); }
  };
  const laStart = () => {
    if (controale.state === STARE.NIMIC) return;
    seteaza(GEST[controale.state] ?? null);
  };
  const laSfarsit = () => seteaza(null);

  // Fereastra pierde focusul în mijlocul unei trageri (Alt+Tab) sau captura se pierde:
  // controalele încheie singure gestul și emit `end` (camera.js, `incheieGestul`). Înainte
  // se ștergea aici numai cursorul, iar harta mergea mai departe după mouse.
  controale.addEventListener('start', laStart);
  controale.addEventListener('end', laSfarsit);

  return {
    /** Pe cadrul care se desenează, după `camera.updateMatrixWorld()`. */
    pas() { if (gest === 'rotire') asaza(); },
    get gest() { return gest; },
    dispose() {
      controale.removeEventListener('start', laStart);
      controale.removeEventListener('end', laSfarsit);
      delete radacina.dataset.gest;
      pivot.remove();
    },
  };
}
