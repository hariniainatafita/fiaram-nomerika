import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { join, relative, sep } from 'node:path';

// Le bundle OTA contient uniquement les fichiers web (HTML, JS, CSS, images).
// Il est téléchargé par l'application uniquement lorsque l'identifiant change.
const distDir = 'dist';
const downloadsDir = join(distDir, 'downloads');
const bundlePath = join(downloadsDir, 'app-bundle.zip');
const baseUrl = process.env.LIVE_UPDATE_BASE_URL || 'https://fiaram-nomerika.pages.dev';

const buildId = process.env.VITE_APP_BUILD_ID || 'dev';
const versionCode = (() => {
  const gradle = readFileSync('android/app/build.gradle', 'utf8');
  return Number(gradle.match(/versionCode\s+(\d+)/)?.[1] || 0);
})();

const excludedRootEntries = new Set([
  'downloads',
  'bundle.json',
  'update.json',
  '_headers',
  '_redirects',
  '_routes.json',
  'vite.svg',
  'logo-512.png',
  'logo-maskable-512.png'
]);

function addDirectory(zip, directory, root, isRoot = false) {
  for (const entry of readdirSync(directory)) {
    if (isRoot && excludedRootEntries.has(entry)) continue;
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      addDirectory(zip, fullPath, root);
    } else {
      const archivePath = relative(root, fullPath).split(sep).join('/');
      zip.addFile(archivePath, readFileSync(fullPath));
    }
  }
}

if (!existsSync(join(distDir, 'index.html'))) {
  console.error('dist/index.html introuvable : lancez npm run build avant ce script.');
  process.exit(1);
}

mkdirSync(downloadsDir, { recursive: true });
const zip = new AdmZip();
addDirectory(zip, distDir, distDir, true);
zip.writeZip(bundlePath);

const checksum = createHash('sha256').update(readFileSync(bundlePath)).digest('base64');
const manifest = {
  bundleId: buildId,
  url: `${baseUrl}/downloads/app-bundle.zip?v=${encodeURIComponent(buildId)}`,
  checksum,
  minNativeVersionCode: versionCode,
  notes:
    process.env.LIVE_UPDATE_NOTES ||
    'Mise a jour des fichiers web de FIARAM NUMERIQUE (aucune nouvelle installation APK).'
};

writeFileSync(join(distDir, 'bundle.json'), JSON.stringify(manifest, null, 2));
console.log(
  `Bundle OTA ${buildId} : ${(readFileSync(bundlePath).length / 1024).toFixed(1)} Ko, checksum ${checksum}`
);
