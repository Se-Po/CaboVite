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
2. Verifică faptul că decodoarele există în `public/draco/` și `public/basis/`.
   Dacă lipsesc: `npm run copy-decoders`.
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
- Dimensiunea contează, nu greutatea fișierului: memoria GPU este
  `lățime × înălțime × 4 × 1.33` octeți indiferent de format. O textură 4096×4096
  ocupă ~89 MB pe GPU chiar dacă JPG-ul are 400 KB.
- Plafon pentru proiectul ăsta: 2048×2048 pentru suprafețe apropiate, 1024×1024
  pentru restul. Peste asta, întreabă-mă întâi.
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
