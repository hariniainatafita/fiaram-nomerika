import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseDirect as supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Membre } from '../types';
import { useLanguage } from '../i18n';
import { StorageService } from './storage';
import { getCurrentAppVersion, isAppUpdaterAvailable } from './appUpdate';
import { isMessengerBubbleAvailable, isMessengerBubbleEnabled, MessengerBubble } from './messengerBubble';

// Premiere APK qui declare l'autorisation RECORD_AUDIO. Sur une version
// anterieure, le bundle web peut s'afficher mais le micro reste refuse par
// Android : on invite donc explicitement a installer la mise a jour.
const REQUIRED_NATIVE_VERSION_FOR_CALLS = 12;

export type VoiceCallStatus =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'active'
  | 'ended'
  | 'error';

export type CallType = 'voice' | 'video';

export interface VoiceCallPeer {
  id: string;
  name: string;
  photo?: string;
}

export interface VoiceCallState {
  status: VoiceCallStatus;
  peer: VoiceCallPeer | null;
  callType: CallType;
  muted: boolean;
  cameraOn: boolean;
  durationSeconds: number;
  error: string | null;
}

export interface VoiceCallController {
  state: VoiceCallState;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  startCall: (member: Membre, callType?: CallType) => void;
  startVideoCall: (member: Membre) => void;
  acceptCall: () => void;
  declineCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  dismiss: () => void;
}

// Appels vocaux pair-a-pair (WebRTC) : le son passe directement d'un telephone
// a l'autre. Aucun serveur ni minute payante n'est utilise, donc l'appel ne
// consomme pas de credit telephonique — seulement la connexion Internet.
// Le signalement (sonnerie, acceptation, description SDP et candidats ICE)
// transite par les canaux Broadcast gratuits de Supabase.
const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302'
    ]
  }
];

const RING_TIMEOUT_MS = 45_000;
const INCOMING_TIMEOUT_MS = 45_000;
const DISCONNECT_GRACE_MS = 12_000;
const ENDED_RESET_MS = 3_500;

const INITIAL_STATE: VoiceCallState = {
  status: 'idle',
  peer: null,
  callType: 'voice',
  muted: false,
  cameraOn: true,
  durationSeconds: 0,
  error: null
};

type CallRole = 'caller' | 'callee';

interface CallSession {
  callId: string;
  peerId: string;
  peerName: string;
  peerPhoto?: string;
  callType: CallType;
  role: CallRole;
  pc: RTCPeerConnection | null;
  localStream: MediaStream | null;
  pendingCandidates: RTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
  ringTimer: number | null;
  disconnectTimer: number | null;
  durationTimer: number | null;
  startedAt: number | null;
}

interface PendingIncoming {
  callId: string;
  peer: VoiceCallPeer;
  callType: CallType;
  timer: number | null;
}

interface SignalPayload {
  callId?: string;
  callType?: CallType;
  from?: { id?: string; name?: string; photo?: string };
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  createdAt?: number;
}

interface SendChannel {
  channel: RealtimeChannel;
  ready: Promise<boolean>;
}

function createCallId(): string {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function memberToPeer(member: Membre): VoiceCallPeer {
  return {
    id: member.id,
    name: `${member.prenom} ${member.nom}`.trim(),
    photo: member.photo_url
  };
}

function formatCallDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useVoiceCall(currentUser: Membre | null): VoiceCallController {
  const { t } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;

  const [state, setState] = useState<VoiceCallState>(INITIAL_STATE);
  const stateRef = useRef<VoiceCallState>(INITIAL_STATE);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const currentUserId = currentUser?.id ?? null;
  const sessionRef = useRef<CallSession | null>(null);
  const pendingIncomingRef = useRef<PendingIncoming | null>(null);
  const displayPeerRef = useRef<VoiceCallPeer | null>(null);
  const sendChannelsRef = useRef<Map<string, SendChannel>>(new Map());
  const resetTimerRef = useRef<number | null>(null);
  const cameraFacingRef = useRef<'user' | 'environment'>('user');
  const ringIntervalRef = useRef<number | null>(null);
  const ringCtxRef = useRef<AudioContext | null>(null);
  const signalHandlerRef = useRef<(event: string, payload: SignalPayload) => void>(() => {});

  function commit(next: VoiceCallState): void {
    stateRef.current = next;
    setState(next);
  }

  function patch(partial: Partial<VoiceCallState>): void {
    commit({ ...stateRef.current, ...partial });
  }

  function clearResetTimer(): void {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }

  function scheduleReset(): void {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      displayPeerRef.current = null;
      commit(INITIAL_STATE);
      setRemoteStream(null);
      setLocalStream(null);
    }, ENDED_RESET_MS);
  }

  function playRingBurst(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!ringCtxRef.current) ringCtxRef.current = new AudioCtx();
      const ctx = ringCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      [0, 0.42].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 760;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.32);
      });
    } catch {
      /* le sonnerie ne doit jamais bloquer l'appel */
    }
    try {
      navigator.vibrate?.([320, 220, 320]);
    } catch {
      /* vibration non disponible */
    }
  }

  function startRingtone(): void {
    stopRingtone();
    playRingBurst();
    ringIntervalRef.current = window.setInterval(playRingBurst, 1_900);
  }

  function stopRingtone(): void {
    if (ringIntervalRef.current !== null) {
      window.clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    try {
      navigator.vibrate?.(0);
    } catch {
      /* ignore */
    }
  }

  function closeRingContext(): void {
    stopRingtone();
    if (ringCtxRef.current) {
      const ctx = ringCtxRef.current;
      ringCtxRef.current = null;
      void ctx.close().catch(() => undefined);
    }
  }

  function getSendChannel(peerId: string): SendChannel {
    const existing = sendChannelsRef.current.get(peerId);
    if (existing) return existing;
    const channel = supabase!.channel(`pronumtld-voice-${peerId}`, {
      config: { broadcast: { self: false } }
    });
    const ready = new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') finish(true);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          finish(false);
        }
      });
      window.setTimeout(() => finish(false), 8_000);
    });
    const entry: SendChannel = { channel, ready };
    sendChannelsRef.current.set(peerId, entry);
    return entry;
  }

  async function sendToPeer(
    peerId: string,
    event: string,
    payload: SignalPayload
  ): Promise<boolean> {
    if (!supabase) return false;
    const entry = getSendChannel(peerId);
    const ready = await entry.ready;
    if (!ready) return false;
    try {
      const result = await entry.channel.send({ type: 'broadcast', event, payload });
      return result === 'ok';
    } catch {
      return false;
    }
  }

  function showNativeIncomingCall(peer: VoiceCallPeer, callType: CallType): void {
    if (!isMessengerBubbleAvailable() || !isMessengerBubbleEnabled()) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    void MessengerBubble.showIncomingCall({
      peerId: peer.id,
      peerName: peer.name,
      peerPhoto: peer.photo,
      callType
    }).catch(() => undefined);
  }

  function hideNativeIncomingCall(): void {
    if (!isMessengerBubbleAvailable()) return;
    void MessengerBubble.hideIncomingCall().catch(() => undefined);
  }

  async function needsNativeUpdate(): Promise<boolean> {
    if (!isAppUpdaterAvailable()) return false;
    try {
      const version = await getCurrentAppVersion();
      return version.versionCode > 0 && version.versionCode < REQUIRED_NATIVE_VERSION_FOR_CALLS;
    } catch {
      return false;
    }
  }

  async function acquireMicrophone(callType: CallType = 'voice'): Promise<{ stream: MediaStream } | { error: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { error: tRef.current('calls.unsupported') };
    }
    const videoConstraints: MediaTrackConstraints | boolean =
      callType === 'video'
        ? { facingMode: { ideal: cameraFacingRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: videoConstraints
      });
      return { stream };
    } catch (error) {
      const name = (error as DOMException | undefined)?.name;
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return { error: tRef.current(callType === 'video' ? 'calls.noCamera' : 'calls.noMic') };
      }
      if (await needsNativeUpdate()) {
        return { error: tRef.current('calls.updateApp') };
      }
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return { error: tRef.current(callType === 'video' ? 'calls.cameraDenied' : 'calls.micDenied') };
      }
      return { error: tRef.current('calls.micError') };
    }
  }

  // Le canal d'envoi est libere apres un court delai pour laisser partir le
  // dernier message (hangup / decline) avant de se desabonner.
  function scheduleSendChannelRelease(peerId: string): void {
    window.setTimeout(() => {
      const session = sessionRef.current;
      const pending = pendingIncomingRef.current;
      if (session?.peerId === peerId || pending?.peer.id === peerId) return;
      const entry = sendChannelsRef.current.get(peerId);
      if (!entry) return;
      sendChannelsRef.current.delete(peerId);
      if (supabase) void supabase.removeChannel(entry.channel);
    }, 5_000);
  }

  function cleanupSession(): void {
    const session = sessionRef.current;
    sessionRef.current = null;
    pendingIncomingRef.current = null;
    if (!session) {
      setRemoteStream(null);
      setLocalStream(null);
      return;
    }
    scheduleSendChannelRelease(session.peerId);
    if (session.ringTimer !== null) window.clearTimeout(session.ringTimer);
    if (session.disconnectTimer !== null) window.clearTimeout(session.disconnectTimer);
    if (session.durationTimer !== null) window.clearInterval(session.durationTimer);
    if (session.pc) {
      session.pc.onicecandidate = null;
      session.pc.ontrack = null;
      session.pc.onconnectionstatechange = null;
      try {
        session.pc.close();
      } catch {
        /* ignore */
      }
    }
    session.localStream?.getTracks().forEach((track) => track.stop());
    setRemoteStream(null);
    setLocalStream(null);
  }

  function logCallEnd(session: CallSession, status: 'ended' | 'error'): void {
    if (!currentUserId || session.role !== 'caller') return;
    const duration = session.startedAt
      ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
      : 0;
    let text: string | null = null;
    if (session.startedAt !== null && status === 'ended') {
      text = session.callType === 'video'
        ? tRef.current('calls.logEndedVideo', { duration: formatCallDuration(duration) })
        : tRef.current('calls.logEndedVoice', { duration: formatCallDuration(duration) });
    } else if (status === 'ended') {
      text = session.callType === 'video'
        ? tRef.current('calls.logMissedVideo')
        : tRef.current('calls.logMissedVoice');
    }
    if (!text) return;
    try {
      StorageService.sendMessage(currentUserId, text, session.peerId);
    } catch {
      /* the call log must never break the call */
    }
  }

  function finish(
    status: 'ended' | 'error',
    message: string | null,
    notifyPeer: boolean
  ): void {
    const session = sessionRef.current;
    if (session && notifyPeer) {
      void sendToPeer(session.peerId, 'hangup', { callId: session.callId });
    }
    if (session) logCallEnd(session, status);
    cleanupSession();
    stopRingtone();
    commit({
      status,
      peer: displayPeerRef.current,
      callType: session?.callType ?? stateRef.current.callType,
      muted: false,
      cameraOn: false,
      durationSeconds: 0,
      error: message
    });
    scheduleReset();
  }

  function failCall(message: string, notifyPeer = true): void {
    finish('error', message, notifyPeer);
  }

  function markActive(): void {
    const session = sessionRef.current;
    if (!session) return;
    stopRingtone();
    if (session.ringTimer !== null) {
      window.clearTimeout(session.ringTimer);
      session.ringTimer = null;
    }
    if (stateRef.current.status !== 'active') {
      patch({ status: 'active', error: null });
    }
    if (session.startedAt === null) {
      session.startedAt = Date.now();
      if (session.disconnectTimer !== null) {
        window.clearTimeout(session.disconnectTimer);
        session.disconnectTimer = null;
      }
      session.durationTimer = window.setInterval(() => {
        const active = sessionRef.current;
        if (!active || active.callId !== session.callId || active.startedAt === null) return;
        patch({ durationSeconds: Math.floor((Date.now() - active.startedAt) / 1000) });
      }, 1_000);
    }
  }

  async function flushCandidates(session: CallSession): Promise<void> {
    if (!session.pc) return;
    const pending = session.pendingCandidates.splice(0);
    for (const candidate of pending) {
      try {
        await session.pc.addIceCandidate(candidate);
      } catch {
        /* candidat obsolete : on continue */
      }
    }
  }

  function createPeerConnection(session: CallSession): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    session.pc = pc;

    if (session.localStream) {
      session.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, session.localStream as MediaStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendToPeer(session.peerId, 'ice', {
        callId: session.callId,
        candidate: event.candidate.toJSON()
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStream(stream);
      markActive();
    };

    pc.onconnectionstatechange = () => {
      if (sessionRef.current !== session) return;
      const connection = pc.connectionState;
      if (connection === 'connected') {
        markActive();
        return;
      }
      if (connection === 'disconnected') {
        if (session.disconnectTimer === null) {
          session.disconnectTimer = window.setTimeout(() => {
            session.disconnectTimer = null;
            if (
              sessionRef.current === session &&
              pc.connectionState !== 'connected' &&
              pc.connectionState !== 'closed'
            ) {
              failCall(tRef.current('calls.connectionFailed'));
            }
          }, DISCONNECT_GRACE_MS);
        }
        return;
      }
      if (connection === 'failed') {
        failCall(tRef.current('calls.connectionFailed'));
      }
    };

    return pc;
  }

  function startCall(member: Membre, callType: CallType = 'voice'): void {
    if (!currentUser || member.id === currentUser.id) return;
    const currentStatus = stateRef.current.status;
    if (currentStatus !== 'idle' && currentStatus !== 'ended' && currentStatus !== 'error') return;
    clearResetTimer();

    if (!isSupabaseConfigured || !supabase) {
      patch({ status: 'error', peer: memberToPeer(member), error: tRef.current('calls.notConfigured') });
      scheduleReset();
      return;
    }
    if (typeof RTCPeerConnection === 'undefined') {
      patch({ status: 'error', peer: memberToPeer(member), error: tRef.current('calls.unsupported') });
      scheduleReset();
      return;
    }

    stopRingtone();
    const peer = memberToPeer(member);
    const self = memberToPeer(currentUser);
    displayPeerRef.current = peer;

    const session: CallSession = {
      callId: createCallId(),
      peerId: peer.id,
      peerName: peer.name,
      peerPhoto: peer.photo,
      callType,
      role: 'caller',
      pc: null,
      localStream: null,
      pendingCandidates: [],
      remoteDescriptionSet: false,
      ringTimer: null,
      disconnectTimer: null,
      durationTimer: null,
      startedAt: null
    };
    sessionRef.current = session;
    cameraFacingRef.current = 'user';
    commit({ status: 'outgoing', peer, callType, muted: false, cameraOn: callType === 'video', durationSeconds: 0, error: null });
    startRingtone();

    void (async () => {
      const mic = await acquireMicrophone(callType);
      if ('error' in mic) {
        if (sessionRef.current?.callId === session.callId) failCall(mic.error, false);
        return;
      }
      if (sessionRef.current?.callId !== session.callId) {
        mic.stream.getTracks().forEach((track) => track.stop());
        return;
      }
      session.localStream = mic.stream;
      setLocalStream(mic.stream);
      createPeerConnection(session);

      const delivered = await sendToPeer(session.peerId, 'invite', {
        callId: session.callId,
        callType: session.callType,
        createdAt: Date.now(),
        from: { id: currentUser.id, name: self.name, photo: self.photo }
      });
      if (!delivered) {
        if (sessionRef.current?.callId === session.callId) {
          failCall(tRef.current('calls.connectionFailed'), false);
        }
        return;
      }

      session.ringTimer = window.setTimeout(() => {
        if (sessionRef.current?.callId !== session.callId) return;
        void sendToPeer(session.peerId, 'hangup', { callId: session.callId });
        finish('ended', tRef.current('calls.noAnswer'), false);
      }, RING_TIMEOUT_MS);
    })();
  }

  function acceptCall(): void {
    const pending = pendingIncomingRef.current;
    if (!pending || stateRef.current.status !== 'incoming') return;

    if (pending.timer !== null) window.clearTimeout(pending.timer);
    pendingIncomingRef.current = null;
    stopRingtone();
    hideNativeIncomingCall();

    if (typeof RTCPeerConnection === 'undefined') {
      void sendToPeer(pending.peer.id, 'hangup', { callId: pending.callId });
      finish('error', tRef.current('calls.unsupported'), false);
      return;
    }

    const session: CallSession = {
      callId: pending.callId,
      peerId: pending.peer.id,
      peerName: pending.peer.name,
      peerPhoto: pending.peer.photo,
      callType: pending.callType,
      role: 'callee',
      pc: null,
      localStream: null,
      pendingCandidates: [],
      remoteDescriptionSet: false,
      ringTimer: null,
      disconnectTimer: null,
      durationTimer: null,
      startedAt: null
    };
    sessionRef.current = session;
    cameraFacingRef.current = 'user';
    commit({
      status: 'connecting',
      peer: pending.peer,
      callType: pending.callType,
      muted: false,
      cameraOn: pending.callType === 'video',
      durationSeconds: 0,
      error: null
    });

    void (async () => {
      const mic = await acquireMicrophone(pending.callType);
      if ('error' in mic) {
        if (sessionRef.current?.callId === session.callId) failCall(mic.error);
        return;
      }
      if (sessionRef.current?.callId !== session.callId) {
        mic.stream.getTracks().forEach((track) => track.stop());
        return;
      }
      session.localStream = mic.stream;
      setLocalStream(mic.stream);
      createPeerConnection(session);

      const delivered = await sendToPeer(session.peerId, 'accept', { callId: session.callId });
      if (!delivered && sessionRef.current?.callId === session.callId) {
        failCall(tRef.current('calls.connectionFailed'));
        return;
      }

      session.ringTimer = window.setTimeout(() => {
        if (sessionRef.current?.callId !== session.callId) return;
        if (stateRef.current.status !== 'active') {
          failCall(tRef.current('calls.connectionFailed'));
        }
      }, RING_TIMEOUT_MS);
    })();
  }

  function declineCall(): void {
    const pending = pendingIncomingRef.current;
    if (!pending) return;
    if (pending.timer !== null) window.clearTimeout(pending.timer);
    pendingIncomingRef.current = null;
    stopRingtone();
    hideNativeIncomingCall();
    void sendToPeer(pending.peer.id, 'decline', { callId: pending.callId });
    displayPeerRef.current = null;
    commit(INITIAL_STATE);
  }

  function hangUp(): void {
    if (pendingIncomingRef.current) {
      declineCall();
      return;
    }
    const session = sessionRef.current;
    if (session) {
      void sendToPeer(session.peerId, 'hangup', { callId: session.callId });
      finish('ended', null, false);
      return;
    }
    clearResetTimer();
    displayPeerRef.current = null;
    commit(INITIAL_STATE);
  }

  function toggleMute(): void {
    const session = sessionRef.current;
    if (!session?.localStream) return;
    const nextMuted = !stateRef.current.muted;
    session.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    patch({ muted: nextMuted });
  }

  function toggleCamera(): void {
    const session = sessionRef.current;
    if (!session?.localStream) return;
    const nextOn = !stateRef.current.cameraOn;
    session.localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextOn;
    });
    patch({ cameraOn: nextOn });
  }

  async function switchCamera(): Promise<void> {
    const session = sessionRef.current;
    if (!session?.localStream) return;
    const oldTrack = session.localStream.getVideoTracks()[0];
    if (!oldTrack || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');
      let nextConstraints: MediaTrackConstraints;
      if (videoDevices.length > 1) {
        const currentDeviceId = oldTrack.getSettings().deviceId;
        const currentIndex = videoDevices.findIndex((device) => device.deviceId === currentDeviceId);
        const next = videoDevices[(currentIndex + 1) % videoDevices.length];
        nextConstraints = next?.deviceId
          ? { deviceId: { exact: next.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } };
      } else {
        nextConstraints = {
          facingMode: { ideal: cameraFacingRef.current === 'user' ? 'environment' : 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
      }
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: nextConstraints });
      const newTrack = nextStream.getVideoTracks()[0];
      if (!newTrack) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (session.pc) {
        const sender = session.pc.getSenders().find((entry) => entry.track?.kind === 'video');
        if (sender && typeof sender.replaceTrack === 'function') {
          await sender.replaceTrack(newTrack);
        } else {
          session.pc.addTrack(newTrack, session.localStream);
        }
      }
      const audioTracks = session.localStream.getAudioTracks();
      oldTrack.stop();
      const combined = new MediaStream([...audioTracks, newTrack]);
      session.localStream = combined;
      setLocalStream(combined);
      cameraFacingRef.current = cameraFacingRef.current === 'user' ? 'environment' : 'user';
    } catch {
      /* keep the current camera when switching fails */
    }
  }

  function dismiss(): void {
    clearResetTimer();
    cleanupSession();
    stopRingtone();
    displayPeerRef.current = null;
    commit(INITIAL_STATE);
  }

  function handleSignal(event: string, payload: SignalPayload): void {
    if (!currentUserId || !payload) return;
    const callId = typeof payload.callId === 'string' ? payload.callId : '';
    const session = sessionRef.current;

    if (event === 'invite') {
      const from = payload.from;
      if (!callId || !from?.id || from.id === currentUserId) return;
      if (typeof RTCPeerConnection === 'undefined') {
        void sendToPeer(from.id, 'decline', { callId, reason: 'unsupported' });
        return;
      }
      // Un appel tres ancien (application restee en veille, message en retard)
      // ne doit pas faire sonner le telephone une fois le delai depasse.
      if (
        typeof payload.createdAt === 'number' &&
        Date.now() - payload.createdAt > INCOMING_TIMEOUT_MS + 5_000
      ) {
        return;
      }
      const busy =
        stateRef.current.status !== 'idle' ||
        sessionRef.current !== null ||
        pendingIncomingRef.current !== null;
      const canReplaceEnded =
        stateRef.current.status === 'ended' || stateRef.current.status === 'error';
      if (busy && !canReplaceEnded) {
        void sendToPeer(from.id, 'decline', { callId, reason: 'busy' });
        return;
      }
      if (canReplaceEnded) clearResetTimer();
      const peer: VoiceCallPeer = {
        id: from.id,
        name: from.name || `${tRef.current('calls.unknownCaller')}`,
        photo: from.photo
      };
      displayPeerRef.current = peer;
      const timer = window.setTimeout(() => {
        const pending = pendingIncomingRef.current;
        if (!pending || pending.callId !== callId) return;
        pendingIncomingRef.current = null;
        stopRingtone();
        hideNativeIncomingCall();
        void sendToPeer(peer.id, 'decline', { callId, reason: 'timeout' });
        displayPeerRef.current = null;
        commit(INITIAL_STATE);
      }, INCOMING_TIMEOUT_MS);
      const callType: CallType = payload.callType === 'video' ? 'video' : 'voice';
      pendingIncomingRef.current = { callId, peer, callType, timer };
      commit({
        status: 'incoming',
        peer,
        callType,
        muted: false,
        cameraOn: callType === 'video',
        durationSeconds: 0,
        error: null
      });
      startRingtone();
      showNativeIncomingCall(peer, callType);
      return;
    }

    if (event === 'decline') {
      if (!session || session.callId !== callId) return;
      finish(
        'ended',
        payload.reason === 'busy'
          ? tRef.current('calls.busy')
          : payload.reason === 'unsupported'
            ? tRef.current('calls.unsupported')
            : tRef.current('calls.declined'),
        false
      );
      return;
    }

    if (event === 'hangup') {
      const pending = pendingIncomingRef.current;
      if (pending && pending.callId === callId) {
        if (pending.timer !== null) window.clearTimeout(pending.timer);
        pendingIncomingRef.current = null;
        stopRingtone();
        hideNativeIncomingCall();
        displayPeerRef.current = null;
        commit(INITIAL_STATE);
        return;
      }
      if (!session || session.callId !== callId) return;
      finish('ended', tRef.current('calls.endedByPeer'), false);
      return;
    }

    if (event === 'accept') {
      if (!session || session.role !== 'caller' || session.callId !== callId) return;
      if (session.ringTimer !== null) {
        window.clearTimeout(session.ringTimer);
        session.ringTimer = null;
      }
      patch({ status: 'connecting' });
      void (async () => {
        try {
          const pc = session.pc ?? createPeerConnection(session);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: session.callType === 'video'
          });
          await pc.setLocalDescription(offer);
          await sendToPeer(session.peerId, 'offer', {
            callId: session.callId,
            sdp: pc.localDescription ?? undefined
          });
        } catch {
          if (sessionRef.current?.callId === session.callId) {
            failCall(tRef.current('calls.connectionFailed'));
          }
        }
      })();
      return;
    }

    if (event === 'offer') {
      if (!session || session.role !== 'callee' || session.callId !== callId) return;
      void (async () => {
        try {
          const pc = session.pc;
          if (!pc || !payload.sdp) return;
          await pc.setRemoteDescription(payload.sdp);
          session.remoteDescriptionSet = true;
          await flushCandidates(session);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendToPeer(session.peerId, 'answer', {
            callId: session.callId,
            sdp: pc.localDescription ?? undefined
          });
        } catch {
          if (sessionRef.current?.callId === session.callId) {
            failCall(tRef.current('calls.connectionFailed'));
          }
        }
      })();
      return;
    }

    if (event === 'answer') {
      if (!session || session.role !== 'caller' || session.callId !== callId) return;
      void (async () => {
        try {
          const pc = session.pc;
          if (!pc || !payload.sdp) return;
          await pc.setRemoteDescription(payload.sdp);
          session.remoteDescriptionSet = true;
          await flushCandidates(session);
        } catch {
          if (sessionRef.current?.callId === session.callId) {
            failCall(tRef.current('calls.connectionFailed'));
          }
        }
      })();
      return;
    }

    if (event === 'ice') {
      if (!session || session.callId !== callId || !payload.candidate) return;
      if (session.pc && session.remoteDescriptionSet) {
        void session.pc.addIceCandidate(payload.candidate).catch(() => undefined);
      } else {
        session.pendingCandidates.push(payload.candidate);
      }
    }
  }

  signalHandlerRef.current = handleSignal;

  // Chaque membre ecoute sa propre boite de signalement. Un appel entrant peut
  // donc sonner depuis n'importe quel ecran de l'application.
  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client.channel(`pronumtld-voice-${currentUserId}`, {
      config: { broadcast: { self: false } }
    });
    channel.on('broadcast', { event: '*' }, (message) => {
      const data = message as { event?: string; payload?: SignalPayload };
      if (!data.event || !data.payload) return;
      signalHandlerRef.current(data.event, data.payload);
    });
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [currentUserId]);

  // Deconnexion : aucun appel ne doit rester ouvert apres la fermeture de session.
  useEffect(() => {
    if (currentUserId) return;
    const activeSession = sessionRef.current;
    if (activeSession) {
      void sendToPeer(activeSession.peerId, 'hangup', { callId: activeSession.callId });
    }
    cleanupSession();
    stopRingtone();
    clearResetTimer();
    displayPeerRef.current = null;
    commit(INITIAL_STATE);
    // Uniquement quand la session se ferme : sendToPeer est stable via les refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Nettoyage complet au demontage de l'application.
  useEffect(() => {
    const sendChannels = sendChannelsRef.current;
    return () => {
      cleanupSession();
      closeRingContext();
      clearResetTimer();
      const channels = [...sendChannels.values()];
      sendChannels.clear();
      channels.forEach((entry) => {
        if (supabase) void supabase.removeChannel(entry.channel);
      });
    };
    // Nettoyage uniquement au demontage : les fonctions internes sont stables
    // via les refs et ne doivent pas relancer cet effet a chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    remoteStream,
    localStream,
    startCall,
    startVideoCall: (member: Membre) => startCall(member, 'video'),
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
    switchCamera,
    dismiss
  };
}
