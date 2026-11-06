import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import { useLanguage } from '../i18n';
import type { VoiceCallController } from '../utils/voiceCall';

interface VoiceCallOverlayProps {
  call: VoiceCallController;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const roundButton: React.CSSProperties = {
  width: '62px',
  height: '62px',
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#ffffff',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
  transition: 'transform 0.12s ease, filter 0.12s ease'
};

export const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({ call }) => {
  const { t } = useLanguage();
  const { state, remoteStream } = call;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const visible = state.status !== 'idle';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!remoteStream) {
      audio.srcObject = null;
      setAudioBlocked(false);
      return;
    }
    audio.srcObject = remoteStream;
    audio.volume = 1;
    void audio
      .play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  }, [remoteStream]);

  if (!visible) return null;

  const peerName = state.peer?.name || t('calls.unknownCaller');
  const photo = state.peer?.photo || DEFAULT_AVATAR_IMAGE;
  const isIncoming = state.status === 'incoming';
  const isActive = state.status === 'active';
  const isRinging = state.status === 'outgoing' || state.status === 'connecting';
  const isFinished = state.status === 'ended' || state.status === 'error';
  const isError = state.status === 'error';

  const statusText = isIncoming
    ? t('calls.incoming')
    : state.status === 'outgoing'
      ? t('calls.ringing')
      : state.status === 'connecting'
        ? t('calls.connecting')
        : isActive
          ? formatDuration(state.durationSeconds)
          : state.error || t('calls.ended');

  const unlockAudio = () => {
    void audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => undefined);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('calls.title')}
      data-fiaram-call-active="true"
      onClick={unlockAudio}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at 50% 18%, rgba(16, 185, 129, 0.22), rgba(2, 6, 23, 0.94) 58%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
    >
      <style>{`
        @keyframes fiaram-call-pulse {
          0% { transform: scale(0.92); opacity: 0.75; }
          70% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes fiaram-call-fade-in {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fiaram-call-card {
          animation: fiaram-call-fade-in 0.22s ease-out;
        }
        .fiaram-call-pulse {
          animation: fiaram-call-pulse 1.8s ease-out infinite;
        }
        .fiaram-call-action:active { transform: scale(0.94); }
        .fiaram-call-action:hover { filter: brightness(1.08); }
      `}</style>

      <section
        className="fiaram-call-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(400px, 100%)',
          padding: '34px 26px 30px',
          borderRadius: '28px',
          background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.97), rgba(2, 6, 23, 0.98))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          color: '#f8fafc'
        }}
      >
        <div style={{ position: 'relative', width: '132px', height: '132px', marginBottom: '20px' }}>
          {(isIncoming || isRinging) && (
            <span
              className="fiaram-call-pulse"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid rgba(16, 185, 129, 0.55)'
              }}
            />
          )}
          <img
            src={photo}
            alt={peerName}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid rgba(16, 185, 129, 0.7)',
              position: 'relative',
              background: '#111827'
            }}
          />
        </div>

        <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
          {peerName}
        </div>

        <div
          style={{
            marginTop: '8px',
            fontSize: isActive ? '1.45rem' : '0.92rem',
            fontWeight: isActive ? 700 : 600,
            color: isError ? '#f87171' : isActive ? '#34d399' : 'rgba(226, 232, 240, 0.86)',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {statusText}
        </div>

        <div
          style={{
            marginTop: '14px',
            fontSize: '0.72rem',
            lineHeight: 1.5,
            color: 'rgba(148, 163, 184, 0.9)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span aria-hidden="true">🌐</span>
          <span>{t('calls.freeNote')}</span>
        </div>

        {isActive && audioBlocked && (
          <button
            type="button"
            onClick={unlockAudio}
            style={{
              marginTop: '16px',
              padding: '9px 16px',
              borderRadius: '999px',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              background: 'rgba(245, 158, 11, 0.14)',
              color: '#fbbf24',
              fontWeight: 700,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Volume2 size={16} />
            {t('calls.tapToHear')}
          </button>
        )}

        <div
          style={{
            marginTop: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isIncoming || isActive ? '34px' : '18px',
            flexWrap: 'wrap'
          }}
        >
          {isIncoming && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="fiaram-call-action"
                  onClick={call.declineCall}
                  title={t('calls.decline')}
                  aria-label={t('calls.decline')}
                  style={{ ...roundButton, background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
                >
                  <PhoneOff size={26} />
                </button>
                <span style={{ fontSize: '0.72rem', color: 'rgba(226, 232, 240, 0.75)' }}>
                  {t('calls.decline')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="fiaram-call-action"
                  onClick={call.acceptCall}
                  title={t('calls.accept')}
                  aria-label={t('calls.accept')}
                  style={{ ...roundButton, background: 'linear-gradient(135deg, #22c55e, #059669)' }}
                >
                  <Phone size={26} />
                </button>
                <span style={{ fontSize: '0.72rem', color: 'rgba(226, 232, 240, 0.75)' }}>
                  {t('calls.accept')}
                </span>
              </div>
            </>
          )}

          {isActive && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="fiaram-call-action"
                  onClick={call.toggleMute}
                  title={state.muted ? t('calls.unmute') : t('calls.mute')}
                  aria-label={state.muted ? t('calls.unmute') : t('calls.mute')}
                  style={{
                    ...roundButton,
                    background: state.muted
                      ? 'linear-gradient(135deg, #f59e0b, #b45309)'
                      : 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.16)'
                  }}
                >
                  {state.muted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <span style={{ fontSize: '0.72rem', color: 'rgba(226, 232, 240, 0.75)' }}>
                  {state.muted ? t('calls.unmute') : t('calls.mute')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="fiaram-call-action"
                  onClick={call.hangUp}
                  title={t('calls.hangUp')}
                  aria-label={t('calls.hangUp')}
                  style={{ ...roundButton, background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
                >
                  <PhoneOff size={26} />
                </button>
                <span style={{ fontSize: '0.72rem', color: 'rgba(226, 232, 240, 0.75)' }}>
                  {t('calls.hangUp')}
                </span>
              </div>
            </>
          )}

          {(isRinging || isFinished) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="fiaram-call-action"
                onClick={isFinished ? call.dismiss : call.hangUp}
                title={isFinished ? t('calls.close') : t('calls.cancel')}
                aria-label={isFinished ? t('calls.close') : t('calls.cancel')}
                style={{
                  ...roundButton,
                  background: isFinished
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  border: isFinished ? '1px solid rgba(255, 255, 255, 0.16)' : 'none'
                }}
              >
                {isFinished ? <Phone size={24} /> : <PhoneOff size={26} />}
              </button>
              <span style={{ fontSize: '0.72rem', color: 'rgba(226, 232, 240, 0.75)' }}>
                {isFinished ? t('calls.close') : t('calls.cancel')}
              </span>
            </div>
          )}
        </div>
      </section>

      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
};
