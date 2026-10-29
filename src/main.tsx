import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n'
import { hydrateFromSupabase } from './utils/supabaseSync'
import { StorageService } from './utils/storage'

async function bootstrap() {
  // Pull shared data from Supabase before the first render so every device
  // starts from the same accounts / presences / settings.
  await hydrateFromSupabase()
  StorageService.removeLegacyAutoReplies()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </StrictMode>,
  )
}

void bootstrap()
