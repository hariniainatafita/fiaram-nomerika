import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppUpdateBanner } from './components/AppUpdateBanner.tsx'
import { LanguageProvider } from './i18n'
import { hydrateFromSupabase } from './utils/supabaseSync'
import { StorageService } from './utils/storage'
import { checkLiveUpdate, markLiveUpdateReady } from './utils/liveUpdate'

async function bootstrap() {
  // Pull shared data from Supabase before the first render so every device
  // starts from the same accounts / presences / settings. A timeout keeps a
  // slow or unreachable network from freezing the login screen.
  await Promise.race([
    hydrateFromSupabase(),
    new Promise<void>((resolve) => setTimeout(resolve, 6000))
  ])
  StorageService.removeLegacyAutoReplies()
  StorageService.upgradePendingMembers()
  // Shrink legacy members rows that still contain inline base64 profile
  // pictures, so later edits upload a few KB instead of several megabytes.
  StorageService.compactMemberImages()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LanguageProvider>
        <App />
        <AppUpdateBanner />
      </LanguageProvider>
    </StrictMode>,
  )

  // Le bundle OTA est déclaré sain seulement après le premier rendu : si un
  // bundle casse l'application, le plugin revient automatiquement au précédent.
  window.setTimeout(() => { void markLiveUpdateReady() }, 800)

  // Vérification OTA des fichiers web : uniquement si le bundle a changé.
  window.setTimeout(() => { void checkLiveUpdate(false, true) }, 5000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkLiveUpdate()
  })
}

void bootstrap()
