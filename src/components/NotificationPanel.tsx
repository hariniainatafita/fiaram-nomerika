import React, { useEffect } from 'react';
import {
  BellOff,
  CalendarDays,
  Camera,
  CheckCheck,
  Download,
  Heart,
  MessageCircle,
  MessageSquare,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '../i18n';
import type { AppNotification, AppNotificationKind } from '../utils/notifications';
import type { Membre } from '../types';

interface NotificationPanelProps {
  notifications: AppNotification[];
  members: Membre[];
  onClose: () => void;
  onSelect: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
}

const KIND_ICONS: Record<AppNotificationKind, LucideIcon> = {
  publication: Camera,
  reaction: Heart,
  comment: MessageCircle,
  update: Download,
  message: MessageSquare,
  group: Users,
  event: CalendarDays,
  member: UserPlus
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  members,
  onClose,
  onSelect,
  onMarkAllRead,
  onClear
}) => {
  const { t } = useLanguage();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const formatTime = (createdAt: number) => {
    const minutes = Math.floor(Math.max(0, Date.now() - createdAt) / 60000);
    if (minutes < 1) return t('notifications.time.now');
    if (minutes < 60) return t('notifications.time.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('notifications.time.hours', { count: hours });
    return t('notifications.time.days', { count: Math.floor(hours / 24) });
  };

  return (
    <div className="notification-overlay" onClick={onClose}>
      <section
        className="notification-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('notifications.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="notification-panel-header">
          <div className="notification-panel-title">
            <span>{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <span className="notification-panel-count">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="notification-close"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </header>

        <div className="notification-list">
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <BellOff size={30} />
              <span>{t('notifications.empty')}</span>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = KIND_ICONS[notification.kind];
              const actor = notification.actorId
                ? members.find((member) => member.id === notification.actorId)
                : undefined;
              const actorPhoto = actor?.photo_url || notification.actorPhoto;
              return (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-item${notification.read ? '' : ' unread'}`}
                  onClick={() => onSelect(notification)}
                >
                  {actorPhoto ? (
                    <img
                      src={actorPhoto}
                      alt=""
                      className="notification-avatar"
                    />
                  ) : (
                    <span className="notification-icon">
                      <Icon size={18} />
                    </span>
                  )}

                  <span className="notification-content">
                    <span className="notification-title">{notification.title}</span>
                    {notification.body && (
                      <span className="notification-body">{notification.body}</span>
                    )}
                    <span className="notification-time">{formatTime(notification.createdAt)}</span>
                  </span>

                  {!notification.read && <span className="notification-dot" />}
                </button>
              );
            })
          )}
        </div>

        <footer className="notification-panel-footer">
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={15} />
            <span>{t('notifications.markAllRead')}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={notifications.length === 0}
          >
            <Trash2 size={15} />
            <span>{t('notifications.clear')}</span>
          </button>
        </footer>
      </section>
    </div>
  );
};
