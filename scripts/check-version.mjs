import { readFileSync } from 'node:fs';

const gradle = readFileSync('android/app/build.gradle', 'utf8');
const manifest = JSON.parse(readFileSync('public/update.json', 'utf8'));

const codeMatch = gradle.match(/versionCode\s+(\d+)/);
const nameMatch = gradle.match(/versionName\s+["']([^"']+)["']/);

if (!codeMatch || !nameMatch) {
  console.error('Impossible de lire versionCode/versionName dans android/app/build.gradle');
  process.exit(1);
}

const code = Number(codeMatch[1]);
const name = nameMatch[1];

if (code !== Number(manifest.versionCode) || name !== manifest.versionName) {
  console.error(
    `Version incoherente: build.gradle=${code}/${name} update.json=${manifest.versionCode}/${manifest.versionName}`
  );
  process.exit(1);
}

console.log(`Version coherente: ${code} / ${name}`);
