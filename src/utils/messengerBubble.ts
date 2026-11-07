import { Capacitor, registerPlugin } from '@capacitor/core';

export const MESSENGER_BUBBLE_ENABLED_KEY = 'fn_messenger_bubble_enabled';

export interface BubblePermissions {
  overlay: boolean;
  notifications: boolean;
}

export interface BubbleSessionOptions {
  userId: string;
  userName: string;
  photoUrl?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  role?: string;
  groupeId?: string;
}

export interface BubbleMessageOptions {
  messageId: string;
  peerId?: string;
  groupId?: string;
  senderId: string;
  senderName: string;
  text: string;
  photoUrl?: string;
}

export interface PendingChat {
  type?: 'direct' | 'group' | 'list';
  id?: string;
}

export interface IncomingCallOptions {
  peerId: string;
  peerName?: string;
  peerPhoto?: string;
  callType?: 'voice' | 'video';
}

export interface MessengerBubblePlugin {
  getBubblePermissions(): Promise<BubblePermissions>;
  requestOverlayPermission(): Promise<{ requested: boolean; granted: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  startBubble(options: BubbleSessionOptions): Promise<{ started: boolean; needsOverlayPermission?: boolean }>;
  stopBubble(): Promise<void>;
  startBackgroundWatcher(options: BubbleSessionOptions): Promise<{ started: boolean }>;
  stopBackgroundWatcher(): Promise<void>;
  showMessage(options: BubbleMessageOptions): Promise<void>;
  showIncomingCall(options: IncomingCallOptions): Promise<void>;
  hideIncomingCall(): Promise<void>;
  clearMessages(): Promise<void>;
  consumePendingChat(): Promise<PendingChat>;
  refreshBubble(): Promise<void>;
  registerPushToken(options: BubbleSessionOptions): Promise<{ registered: boolean }>;
}

export const MessengerBubble = registerPlugin<MessengerBubblePlugin>('MessengerBubble');

export function isMessengerBubbleAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isMessengerBubbleEnabled(): boolean {
  try {
    return window.localStorage.getItem(MESSENGER_BUBBLE_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMessengerBubbleEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(MESSENGER_BUBBLE_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* stockage indisponible */
  }
}
