# Pro-Num-TLD (Projet numerique TafLeaDer)

Application de gestion de groupe : membres, activités, finances, cotisations, présence, messagerie, appels et publications.

## Identité

- Nom affiché : **Pro-Num-TLD**
- Nom complet : **Projet numerique TafLeaDer**
- Domaine web : `https://pro-num-tld.pages.dev`
- Dépôt GitHub : `https://github.com/hariniainatafita/pro-num-tld`
- Package Android : `mg.pro.num.tld`
- Logo source : `src/tld-logo.png`

## Stack

- React 18 + TypeScript + Vite
- Capacitor 7 (Android)
- Cloudflare Pages + Functions
- Supabase / Neon pour la synchronisation
- R2 ou Supabase Storage pour les médias

## Développement

```powershell
npm install
npm run dev
```

## Build web

```powershell
npm run build
npm run preview
```

## Android

```powershell
npm run cap:sync
npm run apk:release
npm run aab:play
```

## Regénérer le logo et les icônes

Le logo est décliné en favicon, icônes PWA, icônes Android, icônes adaptatives et écrans de démarrage :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\generate_icons.ps1
```

## Vérifications

```powershell
npm run lint
npm run build
```

## Ressources externes à provisionner après renommage

- Projet Cloudflare Pages : `pro-num-tld`
- Bucket R2 : `pro-num-tld-media`
- Bucket Supabase Storage : `pro-num-tld-media`
- Secrets GitHub : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROXY_URL`
