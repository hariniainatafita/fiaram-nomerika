// Charge la librairie de scan html5-qrcode uniquement au premier usage réel
// (apparition du scanner) : le paquet initial de l'application reste léger
// et le site s'affiche beaucoup plus vite, surtout sur mobile.
import type { Html5Qrcode } from 'html5-qrcode';

let cachedClass: typeof Html5Qrcode | null = null;

export async function loadHtml5QrcodeClass(): Promise<typeof Html5Qrcode> {
  if (!cachedClass) {
    const mod = await import('html5-qrcode');
    cachedClass = mod.Html5Qrcode;
  }
  return cachedClass;
}
