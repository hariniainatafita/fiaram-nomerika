// Notification système (OS) — apparaît par-dessus les autres sites/outils
// ouverts tant que l'application reste ouverte dans un onglet du navigateur.

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission as NotificationPermissionState;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return (await window.Notification.requestPermission()) as NotificationPermissionState;
  } catch {
    return 'default';
  }
}

export function showBrowserNotification(title: string, options?: NotificationOptions): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  try {
    // L'API historique suffit : la notification OS sort même quand l'onglet
    // de l'application n'est pas celui affiché.
    const notification = new window.Notification(title, options);
    window.setTimeout(() => {
      try { notification.close(); } catch { /* déjà fermée */ }
    }, 8000);
  } catch {
    /* certains navigateurs mobiles n'autorisent que les notifications via
       service worker : dégradation silencieuse, la bulle in-app reste là */
  }
}
