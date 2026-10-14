---
name: asset-pipeline
description: Procedura de adăugare a unui model 3D, a unei texturi sau a unei fotografii în proiect — compresie, decodoare, spațiu de culoare, buget de memorie. Folosește-o la orice fișier nou din public/models, public/textures sau public/photos.
when_to_use: Când se adaugă un .glb, .gltf, .ktx2, .jpg, .png sau .webp în public/, sau când o textură apare prea întunecată, prea luminoasă ori spălăcită.
---

## Modele 3D

Formatul este glTF 2.0 (`.glb` de preferat — un singur fișier). Documentația
oficială three.js recomandă explicit un flux bazat pe glTF.

Înainte de a pune un model în `public/models/`:

1. Comprimă geometria cu Draco și texturile cu KTX2/Basis.
2. Decodoarele nu se copiază: în r186, `DRACOLoader` și `KTX2Loader` și le iau din
   three, cu `new URL(…, import.meta.url)`, iar Vite le emite în `dist/assets` la
   build. Nimic în `public/draco/` sau `public/basis/`: directoarele sunt gitignorate,
   deci Vercel nu le-ar publica. Fără `setDecoderPath` și fără `setTranscoderPath`;
   tiparul e în `.claude/rules/three-scene.md`, „Încărcare modele”. Texturile KTX2
   se încarcă prin `creeazaIncarcatorKtx2(renderer)` din `src/scene/loaders.js`, ca
   în `satelit.js`.
3. Încarcă prin `src/scene/loaders.js`, nu cu o instanță nouă de loader.
   `DRACOLoader` se creează o dată și se refolosește.

Dacă modelul nu apare: verifică în ordine — `onError` al loaderului, existența
unei lumini în scenă, scara (glTF e în metri; modelele din alte surse pot fi de
1000× mai mari sau mai mici), căile absolute către texturi în fișierul glTF.

## Texturi

- Spațiu de culoare: `.map` și `.emissiveMap` → `texture.colorSpace = THREE.SRGBColorSpace`.
  `.normalMap`, `.roughnessMap`, `.metalnessMap`, `.aoMap` → se lasă `NoColorSpace`.
  Un map de normale marcat greșit sRGB nu dă eroare, doar iluminare subtil falsă.
- Hărțile de mediu în `.exr` sunt `LinearSRGBColorSpace`.
- Dimensiunea contează, nu greutatea fișierului. O textură necomprimată pe GPU —
  JPG, PNG, WebP, și KTX2 pe un GPU fără niciun format comprimat (calea RGBA) —
  ocupă `lățime × înălțime × 4 × 1.33` octeți: 4096×4096 face ~89 MB pe GPU, chiar
  dacă JPG-ul are 400 KB.
- KTX2 rămâne comprimat pe GPU. În r186 (`FORMAT_OPTIONS` din `KTX2Loader.js`):
  UASTC → ASTC 4×4 sau BC7, 1 octet pe pixel; ETC1S → ETC2 sau ETC1 pe telefon,
  0,5 octeți pe pixel fără alfa (cu alfa, ETC2 RGBA, 1 octet; ETC1 n-are alfa și cade pe
  RGBA), iar pe un desktop fără ETC → BC7, 1 octet. Toate × ~1,33 cu mipurile. Aceeași 4096×4096 face ~22 MB în UASTC. Cele șase texturi Satelit
  publicate fac împreună ~34 MB în BC7 sau ASTC; formula necomprimată le-ar da
  ~136 MB.
- Plafon pentru proiectul ăsta: peste 2048 pe oricare latură, întreabă-mă întâi.
  Excepțiile deja publicate nu se mai întreabă: texturile Satelit ale bazei
  (2368 × 3008), peticului (2176 × 2880) și lui `harta_v9` (2432 × 2752), din
  `public/data/*-orto_v1.json`. Vezi
  `docs/satelit.md`, „Texturile: `npm run textura-ortofoto`”, și
  `docs/imprejurimi.md`, „Textura lui `harta_v9`”.
- Setează `minFilter`, `magFilter` și `anisotropy` explicit când textura se vede
  în unghi ascuțit (teren, plăci de calcar).

## Fotografii

Fotografiile personale din `public/photos/` sunt conținut editorial, nu texturi.
Servește-le ca `<img>` cu `loading="lazy"`, `width` și `height` explicite (evită
saltul de layout) și `alt` descriptiv **în română**. Nu le încărca prin
`TextureLoader` decât dacă ajung efectiv pe o suprafață 3D.

Fotografiile de urme de dinozauri au nevoie de lumină razantă ca să fie citibile;
dacă o fotografie nu arată urmele, spune-o în legendă în loc să pretinzi că se văd.

## După orice adăugare

Rulează `npm run build` și compară dimensiunea din `dist/`. Dacă un singur asset
adaugă peste 2 MB, oprește-te și spune-mi înainte să continui.
