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
// Il est telecharge par l'application uniquement lorsque l'identifiant change.
const distDir = 'dist';
const downloadsDir = join(distDir, 'downloads');
const bundlePath = join(downloadsDir, 'app-bundle.zip');
const baseUrl = process.env.LIVE_UPDATE_BASE_URL || 'https://pro-num-tld.pages.dev';

// En CI, l'identifiant est le SHA du commit. En local, il est calcule a partir
// du contenu du bundle : deux deploiements locaux produisent donc des
// identifiants differents et l'APK detecte bien chaque nouvelle version.
const explicitBuildId = process.env.VITE_APP_BUILD_ID;
const useExplicitBuildId = Boolean(explicitBuildId && explicitBuildId !== 'dev');

// Version minimale de l'APK capable de charger le bundle. On garde la premiere
// version disposant du plugin LiveUpdate pour que les nouveautes web arrivent
// aussi sur les APK deja installes. A relever uniquement lorsqu'une modification
// web depend d'une nouvelle capacite native.
const minNativeVersionCode = Number(
  process.env.LIVE_UPDATE_MIN_NATIVE_VERSION || 11
);

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

// Empreinte stable du contenu : le ZIP d'AdmZip embarque des horodatages,
// donc hacher le ZIP produirait un identifiant different a chaque execution.
const contentHasher = createHash('sha256');

function addDirectory(zip, directory, root, isRoot = false) {
  for (const entry of readdirSync(directory).sort()) {
    if (isRoot && excludedRootEntries.has(entry)) continue;
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      addDirectory(zip, fullPath, root);
    } else {
      const archivePath = relative(root, fullPath).split(sep).join('/');
      const data = readFileSync(fullPath);
      contentHasher.update(archivePath);
      contentHasher.update('\0');
      contentHasher.update(data);
      const entry = zip.addFile(archivePath, data);
      // Horodatage fixe : le ZIP doit etre identique octet pour octet quand le
      // contenu n'a pas change, sinon le checksum varie et le telechargement
      // echoue sur un fichier mis en cache par le CDN.
      entry.header.time = new Date('1980-01-01T00:00:00Z');
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

const bundleBuffer = readFileSync(bundlePath);
const checksum = createHash('sha256').update(bundleBuffer).digest('base64');
contentHasher.update(`min:${minNativeVersionCode}`);
const contentId = contentHasher.digest('hex').slice(0, 16);
const buildId = useExplicitBuildId ? explicitBuildId : `auto-${contentId}`;

const manifest = {
  bundleId: buildId,
  url: `${baseUrl}/downloads/app-bundle.zip?v=${encodeURIComponent(buildId)}`,
  checksum,
  minNativeVersionCode,
  notes:
    process.env.LIVE_UPDATE_NOTES ||
    'Mise a jour des fichiers web de Pro-Num-TLD NUMERIQUE (aucune nouvelle installation APK).'
};

writeFileSync(join(distDir, 'bundle.json'), JSON.stringify(manifest, null, 2));
console.log(
  `Bundle OTA ${buildId} : ${(bundleBuffer.length / 1024).toFixed(1)} Ko, checksum ${checksum}, minNativeVersionCode ${minNativeVersionCode}`
);
