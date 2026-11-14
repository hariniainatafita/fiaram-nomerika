import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Billet, Membre } from '../types';
import { StorageService } from '../utils/storage';
import { useLanguage } from '../i18n';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  Ticket
} from 'lucide-react';

function TicketQr({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) => {
        if (cancelled) return;
        QRCode.toCanvas(
          canvas,
          JSON.stringify({ code }),
          {
            width: 168,
            margin: 1,
            color: { dark: '#070d1e', light: '#ffffff' }
          },
          () => {}
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '168px',
        height: '168px',
        borderRadius: '10px',
        background: '#ffffff',
        display: 'block'
      }}
    />
  );
}

export const MyTicketsSection: React.FC<{ currentUser: Membre }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    const interval = window.setInterval(refresh, 8000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const billets = useMemo(
    () => {
      void tick;
      return StorageService.getBilletsForUser(currentUser.id).filter((billet) => billet.statut !== 'annule');
    },
    [currentUser.id, tick]
  );
  const commandes = useMemo(
    () => {
      void tick;
      return StorageService.getCommandesForUser(currentUser.id);
    },
    [currentUser.id, tick]
  );

  const pending = commandes.filter((commande) => commande.statut === 'paiement_declare');
  const rejected = commandes.filter((commande) => commande.statut === 'rejete');

  const handleDownload = async (billet: Billet) => {
    try {
      const { default: QRCode } = await import('qrcode');
      const url = await QRCode.toDataURL(
        JSON.stringify({ code: billet.code }),
        {
          width: 512,
          margin: 2,
          color: { dark: '#070d1e', light: '#ffffff' }
        }
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `${billet.code}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Download is a convenience: the QR remains visible on screen.
    }
  };

  if (billets.length === 0 && pending.length === 0 && rejected.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '28px 20px', textAlign: 'center' }}>
        <Ticket size={34} style={{ color: 'var(--text-dim)', marginBottom: '10px' }} />
        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
          {t('publications.event.noTickets')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{t('publications.event.myTickets')}</h3>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: '0.72rem' }}
          onClick={() => setTick((value) => value + 1)}
        >
          <RefreshCw size={13} />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      {pending.map((commande) => (
        <div
          key={commande.id}
          className="glass-card"
          style={{
            padding: '12px 14px',
            border: '1px solid var(--border-gold)',
            background: 'rgba(212, 175, 55, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <Clock size={18} style={{ color: '#d4af37', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{commande.evenement_nom}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('publications.event.orderPending')} · {commande.reference}
            </div>
          </div>
          <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>
            {t('publications.event.ticketCount', { count: commande.quantite })}
          </span>
        </div>
      ))}

      {rejected.map((commande) => (
        <div
          key={commande.id}
          className="glass-card"
          style={{
            padding: '12px 14px',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            background: 'rgba(239, 68, 68, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{commande.evenement_nom}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('publications.event.orderRejected')} · {commande.reference}
            </div>
          </div>
        </div>
      ))}

      {billets.map((billet) => (
        <div
          key={billet.id}
          className="glass-card"
          style={{ padding: '14px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <TicketQr code={billet.code} />
          <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.9rem' }}>{billet.evenement_nom}</strong>
              <span
                className={`badge ${billet.statut === 'utilise' ? 'badge-red' : 'badge-green'}`}
                style={{ fontSize: '0.62rem', padding: '2px 7px' }}
              >
                {billet.statut === 'utilise'
                  ? t('publications.event.ticketUsedBadge')
                  : t('publications.event.ticketValidBadge')}
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {billet.evenement_date} · {billet.evenement_lieu}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#d4af37' }}>
              {billet.code}
            </div>
            {billet.statut === 'utilise' && billet.used_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: '#ef4444' }}>
                <CheckCircle2 size={12} />
                <span>{new Date(billet.used_at).toLocaleString()}</span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-start', padding: '7px 10px', fontSize: '0.72rem' }}
              onClick={() => void handleDownload(billet)}
            >
              <Download size={13} />
              <span>{t('publications.event.downloadTicket')}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
