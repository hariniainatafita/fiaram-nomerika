import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';

export interface MessageToastData {
  id: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  groupName?: string;
  peerId?: string;
}

interface MessageToastListProps {
  toasts: MessageToastData[];
  onOpen: (toast: MessageToastData) => void;
  onClose: (id: string) => void;
}

// Bulles de nouveaux messages : visibles quel que soit l'écran en cours,
// empilées en bas à droite, se ferment seules, et renvoient dans le chat.
export function MessageToastList({ toasts, onOpen, onClose }: MessageToastListProps) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed',
      right: '14px',
      bottom: '84px',
      zIndex: 3200,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: 'min(340px, calc(100vw - 28px))'
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => onOpen(toast)}
          className="animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '14px',
            background: 'var(--bg-secondary, #101828)',
            border: '1px solid var(--border-gold, rgba(245,158,11,.45))',
            boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
            color: 'var(--text-main, #f8fafc)',
            cursor: 'pointer'
          }}
        >
          <img
            src={toast.senderPhoto || DEFAULT_AVATAR_IMAGE}
            alt={toast.senderName}
            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.groupName ? `👥 ${toast.groupName} — ${toast.senderName}` : toast.senderName}
            </div>
            <div style={{
              fontSize: '0.76rem',
              color: 'var(--text-muted, #9ca3af)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {toast.text || '…'}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={(event) => {
              event.stopPropagation();
              onClose(toast.id);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted, #9ca3af)',
              fontSize: '1.1rem',
              lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
              padding: '2px 4px'
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
