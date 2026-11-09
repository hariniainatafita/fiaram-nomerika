import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseDirect as supabase } from '../lib/supabase';

export type TypingChannelType = 'group' | 'direct';

export interface TypingEvent {
  userId: string;
  userName: string;
  channelType: TypingChannelType;
  channelId: string;
  at: number;
}

const TYPING_TTL_MS = 3500;
const TYPING_THROTTLE_MS = 1200;
const BROADCAST_CHANNEL = 'fiaram-chat-typing';

/**
 * Indicateur « en train d'écrire » façon Messenger.
 * - Supabase Realtime broadcast pour les autres appareils.
 * - BroadcastChannel pour les autres onglets du même navigateur (hors ligne).
 */
export function useTypingIndicator(
  currentUserId: string,
  currentUserName: string,
  activeChannelType: TypingChannelType,
  activeChannelId: string
) {
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; at: number }>>({});
  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const localChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSentRef = useRef(0);
  const activeRef = useRef({ type: activeChannelType, id: activeChannelId });

  useEffect(() => {
    activeRef.current = { type: activeChannelType, id: activeChannelId };
  }, [activeChannelType, activeChannelId]);

  useEffect(() => {
    const receive = (event: TypingEvent | undefined) => {
      if (!event || event.userId === currentUserId) return;
      if (event.channelType !== activeRef.current.type || event.channelId !== activeRef.current.id) return;
      if (!event.at || Date.now() - event.at > TYPING_TTL_MS) return;
      setTypingUsers((prev) => ({
        ...prev,
        [event.userId]: { name: event.userName, at: event.at }
      }));
    };

    if (typeof BroadcastChannel !== 'undefined') {
      const local = new BroadcastChannel(BROADCAST_CHANNEL);
      local.onmessage = (message: MessageEvent<TypingEvent>) => receive(message.data);
      localChannelRef.current = local;
    }

    if (supabase) {
      const channel = supabase.channel('fiaram-chat-typing-live', {
        config: { broadcast: { self: false } }
      });
      channel.on('broadcast', { event: 'typing' }, (message) => {
        receive((message as unknown as { payload?: TypingEvent }).payload);
      });
      channel.subscribe();
      supabaseChannelRef.current = channel;
    }

    return () => {
      if (supabaseChannelRef.current && supabase) {
        void supabase.removeChannel(supabaseChannelRef.current);
      }
      supabaseChannelRef.current = null;
      localChannelRef.current?.close();
      localChannelRef.current = null;
    };
  }, [currentUserId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next: Record<string, { name: string; at: number }> = {};
        let changed = false;
        for (const [id, entry] of Object.entries(prev)) {
          if (now - entry.at <= TYPING_TTL_MS) next[id] = entry;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // On change de conversation : les anciens « en train d'écrire » ne doivent
  // pas apparaître dans la nouvelle.
  useEffect(() => {
    setTypingUsers({});
  }, [activeChannelType, activeChannelId]);

  const notifyTyping = () => {
    if (!activeChannelId) return;
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    const event: TypingEvent = {
      userId: currentUserId,
      userName: currentUserName,
      channelType: activeChannelType,
      channelId: activeChannelId,
      at: now
    };
    localChannelRef.current?.postMessage(event);
    void supabaseChannelRef.current
      ?.send({ type: 'broadcast', event: 'typing', payload: event })
      .catch(() => { /* hors ligne : le BroadcastChannel local suffit */ });
  };

  const typingNames = Object.values(typingUsers)
    .filter((entry) => Date.now() - entry.at <= TYPING_TTL_MS)
    .map((entry) => entry.name)
    .filter(Boolean);

  return { typingNames, notifyTyping };
}
