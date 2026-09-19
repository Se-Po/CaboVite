#!/usr/bin/env node
// Hook PostToolUse: verifică fișierele editate pentru API three.js deprecat
// în r186. Nu blochează nimic — întoarce corectura ca context suplimentar.
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const file = input?.tool_input?.file_path;
if (!file || !/\.(js|mjs|jsx|ts|tsx)$/.test(file)) process.exit(0);

let src = '';
try {
  src = readFileSync(file, 'utf8');
} catch {
  process.exit(0);
}

const esteThree = /from ['"]three/.test(src) || /THREE\./.test(src);
if (!esteThree) process.exit(0);

const verificari = [
  {
    test: (s) => s.includes('three/examples/jsm/'),
    mesaj: "importuri din 'three/examples/jsm/' → folosește 'three/addons/'",
  },
  {
    test: (s) => /requestAnimationFrame\s*\(/.test(s) && /renderer\.render\s*\(/.test(s),
    mesaj: 'requestAnimationFrame pentru bucla de randare → renderer.setAnimationLoop(animate)',
  },
  {
    test: (s) => /new\s+THREE\.Clock\s*\(/.test(s) || /\bnew\s+Clock\s*\(/.test(s),
    mesaj: 'THREE.Clock e deprecat din r183 → THREE.Timer (timer.update(), apoi timer.getDelta())',
  },
  {
    test: (s) => s.includes('PCFSoftShadowMap'),
    mesaj: 'PCFSoftShadowMap a fost eliminat în r186 → THREE.PCFShadowMap',
  },
  {
    test: (s) => /setPixelRatio\s*\(\s*window\.devicePixelRatio\s*\)/.test(s),
    mesaj:
      'setPixelRatio(window.devicePixelRatio) fără plafon → vezi tiparul resizeRendererToDisplaySize din .claude/rules/three-scene.md',
  },
  {
    test: (s) => /setSize\s*\([^)]*\)/.test(s) && !/setSize\s*\([^)]*,\s*false\s*\)/.test(s),
    mesaj:
      'renderer.setSize(...) fără al treilea argument false — CSS-ul trebuie să controleze dimensiunea canvasului',
  },
  {
    test: (s) => /new\s+THREE\.TextureLoader\s*\(/.test(s) && !s.includes('colorSpace'),
    mesaj:
      'TextureLoader fără colorSpace — texturile de culoare au nevoie de SRGBColorSpace; cele de date rămân NoColorSpace',
  },
];

const gasite = verificari.filter((v) => v.test(src)).map((v) => `- ${v.mesaj}`);
if (gasite.length === 0) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `Convenții three.js r186 de respectat în ${file}:\n${gasite.join('\n')}\n` +
        `Corectează acum, în același fișier.`,
    },
  })
);
