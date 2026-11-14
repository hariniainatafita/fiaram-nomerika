import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Billet, BilletCommande, Membre, Publication } from '../types';
import { StorageService } from '../utils/storage';
import { loadHtml5QrcodeClass } from '../utils/html5QrcodeLoader';
import { playScanErrorSound, playScanSuccessSound } from '../utils/audio';
import { isAdmin, isChef } from '../utils/permissions';
import { useLanguage } from '../i18n';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Copy,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Ticket,
  TicketCheck,
  Wand2,
  X
} from 'lucide-react';

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 120,
  background: 'rgba(5, 11, 22, 0.9)',
  backdropFilter: 'blur(10px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px'
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  maxHeight: '92dvh',
  overflowY: 'auto',
  borderRadius: '20px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px'
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  textTransform: 'uppercase'
};

const money = (value: number): string =>
  `${Math.max(0, Math.round(value)).toLocaleString('fr-FR')} Ar`;

function ModalHeader({
  icon,
  title,
  subtitle,
  onClose
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #d4af37, #b8860b)',
        color: '#07101e',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800 }}>{title}</h3>
        {subtitle && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{subtitle}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="btn btn-ghost"
        style={{ padding: '6px', borderRadius: '50%' }}
        title="Fermer"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export const BuyTicketModal: React.FC<{
  publication: Publication;
  currentUser: Membre;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({ publication, currentUser, onClose, onSubmitted }) => {
  const { t } = useLanguage();
  const event = publication.event;
  const [quantite, setQuantite] = useState(1);
  const [reference] = useState(() => StorageService.generateBilletReference());
  const [referenceTransfert, setReferenceTransfert] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const total = event.prix_billet * quantite;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('common.error'));
    }
  };

  const handleSubmit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!referenceTransfert.trim()) {
      setError(t('publications.event.transferRef'));
      return;
    }
    const commande = StorageService.createBilletCommande(
      publication,
      currentUser.id,
      quantite,
      reference,
      referenceTransfert
    );
    if (!commande) {
      setError(t('common.error'));
      return;
    }
    setError(null);
    setSubmitted(true);
    onSubmitted();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        className="glass-card"
        style={panelStyle}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <ModalHeader
          icon={<Ticket size={20} />}
          title={t('publications.event.buyTicket')}
          subtitle={event.nom}
          onClose={onClose}
        />

        {submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center', padding: '14px 0' }}>
            <CheckCircle2 size={48} style={{ color: '#10b981' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{t('publications.event.orderSent')}</p>
            <div className="badge badge-gold" style={{ fontSize: '0.82rem', padding: '8px 14px' }}>
              {t('publications.event.reference')} : {reference}
            </div>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px'
            }}>
              <div>
                <div style={labelStyle}>{t('publications.event.date')}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{event.date || '—'}</div>
              </div>
              <div>
                <div style={labelStyle}>{t('publications.event.lieu')}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{event.lieu || '—'}</div>
              </div>
              <div>
                <div style={labelStyle}>{t('publications.event.prix')}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d4af37' }}>{money(event.prix_billet)}</div>
              </div>
            </div>

            <div>
              <div style={{ ...labelStyle, marginBottom: '6px' }}>{t('publications.event.quantity')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '8px 12px' }}
                  onClick={() => setQuantite((value) => Math.max(1, value - 1))}
                >
                  <Minus size={16} />
                </button>
                <span style={{ minWidth: '34px', textAlign: 'center', fontWeight: 800, fontSize: '1.05rem' }}>
                  {quantite}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '8px 12px' }}
                  onClick={() => setQuantite((value) => Math.min(20, value + 1))}
                >
                  <Plus size={16} />
                </button>
                <span style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 700 }}>
                  {t('common.total')} : <span style={{ color: '#10b981' }}>{money(total)}</span>
                </span>
              </div>
            </div>

            <div style={{
              borderRadius: '14px',
              border: '1px solid var(--border-gold)',
              background: 'rgba(212, 175, 55, 0.08)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                {t('publications.event.paymentInfo')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={labelStyle}>{t('publications.event.mobileMoney')}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>{event.numero_mobile_money || '—'}</div>
                </div>
                <div>
                  <div style={labelStyle}>{t('publications.event.reference')}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#d4af37' }}>{reference}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '7px 10px' }}
                  onClick={handleCopy}
                >
                  <Copy size={14} />
                  <span>{copied ? t('common.copied') : t('common.code')}</span>
                </button>
              </div>
            </div>

            <div>
              <div style={{ ...labelStyle, marginBottom: '6px' }}>{t('publications.event.transferRef')}</div>
              <input
                type="text"
                value={referenceTransfert}
                onChange={(inputEvent) => setReferenceTransfert(inputEvent.target.value)}
                className="form-input"
                placeholder={t('publications.event.transferRefPlaceholder')}
                maxLength={80}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.8rem' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ padding: '11px' }}>
              <CheckCircle2 size={17} />
              <span>{t('publications.event.iPaid')}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const ManageEventTicketsModal: React.FC<{
  publication: Publication;
  currentUser: Membre;
  allMembres: Membre[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ publication, currentUser, allMembres, onClose, onRefresh }) => {
  const { t } = useLanguage();
  const [tick, setTick] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const canManage = isAdmin(currentUser) || isChef(currentUser);

  useEffect(() => {
    const interval = window.setInterval(
      () => setTick((value) => value + 1),
      8000
    );
    return () => window.clearInterval(interval);
  }, []);

  const commandes = useMemo(
    () => {
      void tick;
      return StorageService.getCommandesForPublication(publication.id);
    },
    [publication.id, tick]
  );
  const billets = useMemo(
    () => {
      void tick;
      return StorageService.getBilletsForPublication(publication.id);
    },
    [publication.id, tick]
  );

  const pending = commandes.filter((commande) => commande.statut === 'paiement_declare');
  const valides = commandes.filter((commande) => commande.statut === 'valide');
  const used = billets.filter((billet) => billet.statut === 'utilise');
  const grandTotal = valides.reduce((total, commande) => total + commande.montant_total, 0);

  const buyerName = (id: string): string => {
    const membre = allMembres.find((item) => item.id === id);
    return membre ? `${membre.prenom} ${membre.nom}` : t('common.unknown');
  };

  const handleValidate = (commande: BilletCommande) => {
    StorageService.validateBilletCommande(commande.id, currentUser.id);
    setTick((value) => value + 1);
    onRefresh();
  };

  const handleReject = (commande: BilletCommande) => {
    StorageService.rejectBilletCommande(commande.id, currentUser.id);
    setTick((value) => value + 1);
    onRefresh();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        className="glass-card"
        style={panelStyle}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <ModalHeader
          icon={<TicketCheck size={20} />}
          title={t('publications.event.manageTickets')}
          subtitle={publication.event?.nom}
          onClose={onClose}
        />

        {!canManage ? (
          <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{t('publications.event.onlyStaff')}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div className="glass-card" style={{ padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d4af37' }}>{valides.reduce((total, commande) => total + commande.quantite, 0)}</div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{t('publications.event.ticketsSold')}</div>
              </div>
              <div className="glass-card" style={{ padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{used.length}</div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{t('publications.event.ticketsUsed')}</div>
              </div>
              <div className="glass-card" style={{ padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#a78bfa' }}>{money(grandTotal)}</div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{t('common.total')}</div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScannerOpen(true)}
              style={{ padding: '10px' }}
            >
              <ScanLine size={17} />
              <span>{t('publications.event.scanTicket')}</span>
            </button>

            {valides.some(
              (commande) => !billets.some((billet) => billet.commande_id === commande.id)
            ) && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '9px', fontSize: '0.78rem', color: '#d4af37' }}
                onClick={() => {
                  valides.forEach((commande) => {
                    if (!billets.some((billet) => billet.commande_id === commande.id)) {
                      StorageService.validateBilletCommande(commande.id, currentUser.id);
                    }
                  });
                  setTick((value) => value + 1);
                  onRefresh();
                }}
              >
                <Wand2 size={15} />
                <span>{t('publications.event.generateMissing')}</span>
              </button>
            )}

            <div>
              <div style={{ ...labelStyle, marginBottom: '8px' }}>
                {t('publications.event.pendingOrders')} ({pending.length})
              </div>
              {pending.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('publications.event.noPending')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pending.map((commande) => (
                    <div
                      key={commande.id}
                      className="glass-card"
                      style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{buyerName(commande.acheteur_id)}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{money(commande.montant_total)}</div>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {t('publications.event.quantity')} : {commande.quantite} · {t('publications.event.reference')} : {commande.reference}
                        {commande.reference_transfert ? ` · ${t('publications.event.transferRef')} : ${commande.reference_transfert}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '8px', fontSize: '0.78rem' }}
                          onClick={() => handleValidate(commande)}
                        >
                          <CheckCircle2 size={15} />
                          <span>{t('publications.event.validate')}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '8px 12px', fontSize: '0.78rem', color: '#ef4444' }}
                          onClick={() => handleReject(commande)}
                        >
                          <X size={15} />
                          <span>{t('publications.event.reject')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {scannerOpen && (
        <TicketScannerModal
          currentUser={currentUser}
          onClose={() => {
            setScannerOpen(false);
            setTick((value) => value + 1);
            onRefresh();
          }}
          onScanned={() => {
            setTick((value) => value + 1);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

export const TicketScannerModal: React.FC<{
  currentUser: Membre;
  onClose: () => void;
  onScanned?: () => void;
}> = ({ currentUser, onClose, onScanned }) => {
  const { t } = useLanguage();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<{ status: 'valid' | 'used' | 'invalid'; code: string; billet?: Billet } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resultLockRef = useRef(false);
  const handlerRef = useRef<(raw: string) => void>(() => {});
  const containerId = 'ticket-scanner-viewport';

  const handleCode = (raw: string) => {
    if (resultLockRef.current) return;
    const response = StorageService.validateBilletCode(raw, currentUser.id);
    resultLockRef.current = true;
    if (response.status === 'valid') {
      playScanSuccessSound();
    } else {
      playScanErrorSound();
    }
    setResult({ ...response, code: raw });
    if (scannerRef.current?.isScanning) {
      scannerRef.current.pause(true);
    }
    onScanned?.();
  };

  useEffect(() => {
    handlerRef.current = handleCode;
  });

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const ScannerClass = await loadHtml5QrcodeClass();
        if (cancelled) return;
        if (!scannerRef.current) {
          scannerRef.current = new ScannerClass(containerId);
        }
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
          (decodedText) => handlerRef.current(decodedText),
          () => {}
        );
      } catch {
        if (!cancelled) setCameraError(t('scanner.camera.startError'));
      }
    };
    void start();
    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [containerId, t]);

  const handleManualSubmit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!manualCode.trim()) return;
    handleCode(manualCode.trim());
    setManualCode('');
  };

  const handleScanNext = () => {
    resultLockRef.current = false;
    setResult(null);
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        scanner.resume();
      } catch {
        // The scanner will restart on the next mount if resume is unavailable.
      }
    }
  };

  const resultColor = result?.status === 'valid' ? '#10b981' : result?.status === 'used' ? '#d4af37' : '#ef4444';
  const resultLabel = result?.status === 'valid'
    ? t('publications.event.ticketValid')
    : result?.status === 'used'
      ? t('publications.event.ticketUsed')
      : t('publications.event.ticketInvalid');

  return (
    <div
      style={{ ...overlayStyle, zIndex: 140 }}
      onClick={(clickEvent) => clickEvent.stopPropagation()}
    >
      <div className="glass-card" style={{ ...panelStyle, maxWidth: '460px' }}>
        <ModalHeader
          icon={<QrCode size={20} />}
          title={t('publications.event.scanTitle')}
          subtitle={t('publications.event.scanHint')}
          onClose={onClose}
        />

        <div
          id={containerId}
          style={{
            width: '100%',
            minHeight: '240px',
            borderRadius: '14px',
            overflow: 'hidden',
            background: '#050a16',
            border: '1px solid var(--border-color)'
          }}
        />

        {cameraError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4af37', fontSize: '0.78rem' }}>
            <Camera size={15} />
            <span>{cameraError}</span>
          </div>
        )}

        {result && (
          <div style={{
            borderRadius: '14px',
            border: `1px solid ${resultColor}`,
            background: `${resultColor}18`,
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: resultColor, fontWeight: 800 }}>
              {result.status === 'valid' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{resultLabel}</span>
            </div>
            {result.billet && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {result.billet.evenement_nom} · {result.billet.code}
                {result.status === 'used' && result.billet.used_at
                  ? ` · ${new Date(result.billet.used_at).toLocaleString()}`
                  : ''}
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={handleScanNext} style={{ padding: '9px' }}>
              <RefreshCw size={15} />
              <span>{t('publications.event.scanTicket')}</span>
            </button>
          </div>
        )}

        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={manualCode}
            onChange={(inputEvent) => setManualCode(inputEvent.target.value)}
            className="form-input"
            placeholder={t('publications.event.manualCode')}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 12px' }} disabled={!manualCode.trim()}>
            <QrCode size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export const EventTicketSummary: React.FC<{ publication: Publication }> = ({ publication }) => {
  const { t } = useLanguage();
  const event = publication.event;
  if (!event) return null;
  return (
    <div style={{
      margin: '0 18px 14px',
      borderRadius: '14px',
      border: '1px solid var(--border-gold)',
      background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(139, 92, 246, 0.1))',
      padding: '12px 14px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: '10px'
    }}>
      <div>
        <div style={labelStyle}>{t('publications.event.date')}</div>
        <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{event.date || '—'}</div>
      </div>
      <div>
        <div style={labelStyle}>{t('publications.event.lieu')}</div>
        <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{event.lieu || '—'}</div>
      </div>
      <div>
        <div style={labelStyle}>{t('publications.event.prix')}</div>
        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#d4af37' }}>{money(event.prix_billet)}</div>
      </div>
    </div>
  );
};
