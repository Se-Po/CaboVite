import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Cerul: modelul Preetham din three (`Sky.js`), senin.
//
// Până aici fundalul era o culoare plată, iar ceața se topea în aceeași culoare.
// Un cer adevărat variază însă: mai luminos spre soare și spre orizont, mai
// albastru sus. Două lucruri trebuie să se potrivească cu el, altfel se vede linia:
//
// - Expunerea. Sky.js e scris pentru o expunere de ~0,5 sub ACES; sub AgX, la 1,
//   cum stă scena, ar ieși spălat sau prea întunecat. Factorul `expunereCer` se
//   CALCULEAZĂ, nu se alege din ochi: orizontul din partea opusă soarelui trebuie
//   să aibă luminanța culorii de cer a paletei (`paleta.cer`), deci pagina
//   rămâne la fel de luminoasă ca înainte de cerul Preetham.
// - Ceața. Ceața three are o singură culoare, iar cerul nu. Marea, care ajunge
//   până la orizont, primește deci ceața pixel cu pixel, cu culoarea cerului pe
//   aceeași direcție (`GLSL_CER`, folosit de mare.js). La fel împrejurimile, care
//   merg până la 50 km, dar cu legea liniară a scenei. Alpha, care stă sub 5 km,
//   primește culoarea medie a orizontului.
//
// Culoarea cerului se calculează și în JS (`cerLiniar`, `agx`), cu exact aceleași
// formule ca shaderul: așa se află expunerea și media orizontului fără să citim
// pixeli de pe placă. Proba din pagină compară portul cu pixelii GPU.
//
// Scena desenează la cerere, iar norii din Sky.js au nevoie de un `time` care
// curge. Cerul e deci senin: `cloudCoverage` 0.

export const PARAMETRI_CER = { turbidity: 2, rayleigh: 1, mieCoefficient: 0.005, mieDirectionalG: 0.8 };

// ------------------------------------------------------------ portul JS

const TOTAL_RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];

/**
 * Culoarea liniară a cerului pe direcția `d` (unitar, y în sus), cu soarele pe
 * direcția `s` (unitar), fără discul soarelui și fără nori: exact `texColor` din
 * Sky.js, înainte de expunere și de tone mapping.
 */
export function cerLiniar(d, s, p = PARAMETRI_CER) {
  const e = Math.E, pi = Math.PI;
  const zc = Math.max(-1, Math.min(1, s[1]));
  const sunE = 1000 * Math.max(0, 1 - e ** (-((1.6110731556870734 - Math.acos(zc)) / 1.5)));
  const sunfade = 1 - Math.max(0, Math.min(1, 1 - Math.exp(s[1] / 450000)));
  const rc = p.rayleigh - (1 - sunfade);
  const betaR = TOTAL_RAYLEIGH.map((v) => v * rc);
  const betaM = MIE_CONST.map((v) => 0.434 * (0.2 * p.turbidity) * 10e-18 * v * p.mieCoefficient);
  const zen = Math.acos(Math.max(0, d[1]));
  const inv = 1 / (Math.cos(zen) + 0.15 * (93.885 - (zen * 180) / pi) ** -1.253);
  const sR = 8.4e3 * inv, sM = 1.25e3 * inv;
  const Fex = [0, 1, 2].map((k) => Math.exp(-(betaR[k] * sR + betaM[k] * sM)));
  const cosT = d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
  const rPhase = 0.05968310365946075 * (1 + (cosT * 0.5 + 0.5) ** 2);
  const g = p.mieDirectionalG, g2 = g * g;
  const mPhase = 0.07957747154594767 * ((1 - g2) / (1 - 2 * g * cosT + g2) ** 1.5);
  const amestec = Math.max(0, Math.min(1, (1 - s[1]) ** 5));
  return [0, 1, 2].map((k) => {
    const r = (betaR[k] * rPhase + betaM[k] * mPhase) / (betaR[k] + betaM[k]);
    let Lin = (sunE * r * (1 - Fex[k])) ** 1.5;
    Lin *= 1 + ((sunE * r * Fex[k]) ** 0.5 - 1) * amestec;
    const L0 = 0.1 * Fex[k];
    return (Lin + L0) * 0.04 + [0, 0.0003, 0.00075][k];
  });
}

// AgX din three r186 (tonemapping_pars_fragment), coloană cu coloană: în GLSL,
// mat3(a, b, c) are coloanele a, b, c.
const col = (a, b, c, v) => [0, 1, 2].map((k) => a[k] * v[0] + b[k] * v[1] + c[k] * v[2]);
const SRGB_2020 = [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.0880], [0.0433, 0.0113, 0.8956]];
const R2020_SRGB = [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]];
const INSET = [[0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859]];
const OUTSET = [[1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405]];

/** AgX pe o culoare liniară sRGB → liniar sRGB în [0, 1], ca `AgXToneMapping`. */
export function agx(c, expunere = 1) {
  const mn = -12.47393, mx = 4.026069;
  let v = c.map((x) => x * expunere);
  v = col(...SRGB_2020, v);
  v = col(...INSET, v);
  v = v.map((x) => Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-10)) - mn) / (mx - mn))));
  v = v.map((x) => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; });
  v = col(...OUTSET, v);
  v = v.map((x) => Math.max(0, x) ** 2.2);
  v = col(...R2020_SRGB, v);
  return v.map((x) => Math.min(1, Math.max(0, x)));
}

const oetf = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** 0.41666 - 0.055);
const eotf = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const Y = (l) => 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];

/** Culoarea afișată (sRGB în [0, 1]) a cerului pe direcția d, cu expunerea dată. */
export function cerAfisat(d, s, expunere, p = PARAMETRI_CER) {
  return agx(cerLiniar(d, s, p).map((x) => x * expunere)).map(oetf);
}

/** Direcția orizontală la azimutul de grilă `az` (grade): x est, z sud, deci nordul e −z. */
const laOrizont = (az) => [Math.sin((az * Math.PI) / 180), 0, -Math.cos((az * Math.PI) / 180)];

/**
 * Expunerea la care orizontul opus soarelui are luminanța culorii `tinta` (hex
 * sRGB), plus media orizontului pe tot turul, ca sRGB [0, 1].
 */
export function calibreaza(s, tinta, p = PARAMETRI_CER) {
  const tl = Y([(tinta >> 16) & 255, (tinta >> 8) & 255, tinta & 255].map((v) => eotf(v / 255)));
  const azSoare = (Math.atan2(s[0], -s[2]) * 180) / Math.PI;
  const opus = laOrizont(azSoare + 180);
  const lum = (k) => Y(cerAfisat(opus, s, k, p).map(eotf));
  let a = Math.log(1e-3), b = Math.log(1e3);
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (lum(Math.exp(m)) < tl) a = m; else b = m; }
  const expunere = Math.exp((a + b) / 2);
  const suma = [0, 0, 0];
  for (let az = 0; az < 360; az += 5) cerAfisat(laOrizont(az), s, expunere, p).forEach((v, k) => { suma[k] += eotf(v); });
  const orizont = suma.map((v) => oetf(v / 72));
  return { expunere, orizont };
}

// ------------------------------------------------------------ shaderul, pentru mare

/**
 * Aceeași culoare a cerului, în GLSL, pentru ceața mării. Cere uniformele
 * `sunPosition`, `rayleigh`, `turbidity`, `mieCoefficient`, `mieDirectionalG` și
 * `expunereCer` — aceleași obiecte ca ale cerului, deci o schimbare a soarelui le
 * mută pe amândouă.
 */
export const GLSL_CER = /* glsl */`
uniform vec3 sunPosition;
uniform float rayleigh;
uniform float turbidity;
uniform float mieCoefficient;
uniform float mieDirectionalG;
uniform float expunereCer;
vec3 culoareCer( vec3 direction ) {
  const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );
  const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );
  vec3 sunDir = normalize( sunPosition );
  float sunE = 1000.0 * max( 0.0, 1.0 - pow( 2.718281828459045, -( ( 1.6110731556870734 - acos( clamp( sunDir.y, -1.0, 1.0 ) ) ) / 1.5 ) ) );
  float sunfade = 1.0 - clamp( 1.0 - exp( sunPosition.y / 450000.0 ), 0.0, 1.0 );
  vec3 betaR = totalRayleigh * ( rayleigh - ( 1.0 - sunfade ) );
  vec3 betaM = 0.434 * ( 0.2 * turbidity ) * 10E-18 * MieConst * mieCoefficient;
  float zenithAngle = acos( max( 0.0, direction.y ) );
  float inv = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / 3.141592653589793 ), -1.253 ) );
  vec3 Fex = exp( -( betaR * 8.4E3 * inv + betaM * 1.25E3 * inv ) );
  float cosTheta = dot( direction, sunDir );
  float rPhase = 0.05968310365946075 * ( 1.0 + pow( cosTheta * 0.5 + 0.5, 2.0 ) );
  float g2 = mieDirectionalG * mieDirectionalG;
  float mPhase = 0.07957747154594767 * ( ( 1.0 - g2 ) / pow( 1.0 - 2.0 * mieDirectionalG * cosTheta + g2, 1.5 ) );
  vec3 r = ( betaR * rPhase + betaM * mPhase ) / ( betaR + betaM );
  vec3 Lin = pow( sunE * r * ( 1.0 - Fex ), vec3( 1.5 ) );
  Lin *= mix( vec3( 1.0 ), pow( sunE * r * Fex, vec3( 0.5 ) ), clamp( pow( 1.0 - sunDir.y, 5.0 ), 0.0, 1.0 ) );
  return ( ( Lin + vec3( 0.1 ) * Fex ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 ) ) * expunereCer;
}
`;

// ------------------------------------------------------------ cerul din scenă

/**
 * @param {{paleta: object, soare: THREE.DirectionalLight}} o
 * @returns {{obiect: THREE.Mesh, uniforme: object, orizont: number[], potriveste: () => void, dispose: () => void}}
 */
export function creeazaCer({ paleta, soare }) {
  const cer = new Sky();
  cer.name = 'cer';
  // Camera ajunge la 8 km de țintă; cutia are 20 km până la margine și stă, cu
  // gl_Position.z = w, pe planul îndepărtat: nu acoperă nimic.
  cer.scale.setScalar(40000);
  cer.frustumCulled = false;
  cer.matrixAutoUpdate = false;
  cer.updateMatrix();
  const u = cer.material.uniforms;
  for (const [k, v] of Object.entries(PARAMETRI_CER)) u[k].value = v;
  u.cloudCoverage.value = 0;
  u.expunereCer = { value: 1 };
  cer.material.onBeforeCompile = (sh) => {
    sh.uniforms.expunereCer = u.expunereCer;
    sh.fragmentShader = sh.fragmentShader
      .replace('uniform float time;', 'uniform float time;\nuniform float expunereCer;')
      .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * expunereCer, 1.0 );');
  };
  cer.material.customProgramCacheKey = () => 'cer-expunere';

  const rezultat = {
    obiect: cer,
    uniforme: u,
    orizont: [1, 1, 1],
    /** Soarele s-a mutat: noua direcție, expunerea, media orizontului. */
    potriveste() {
      const s = soare.position.clone().normalize();
      u.sunPosition.value.copy(s);
      const c = calibreaza([s.x, s.y, s.z], paleta.cer);
      u.expunereCer.value = c.expunere;
      rezultat.orizont = c.orizont;
      return c;
    },
    dispose() {
      cer.geometry.dispose();
      cer.material.dispose();
      cer.removeFromParent();
    },
  };
  rezultat.potriveste();
  return rezultat;
}
