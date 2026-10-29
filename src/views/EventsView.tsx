import React, { useState } from 'react';
import { Membre, Evenement } from '../types';
import { 
  Pin, 
  Clock, 
  HeartHandshake,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StorageService } from '../utils/storage';
import { canCreateEvenement, isAdmin } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface EventsViewProps {
  currentUser: Membre;
  evenements: Evenement[];
  onRefreshEvents: () => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  currentUser,
  evenements,
  onRefreshEvents
}) => {
  const [donateEventId, setDonateEventId] = useState<string | null>(null);
  const [donateAmount, setDonateAmount] = useState(10000);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newObjectif, setNewObjectif] = useState(0);
  const [newDate, setNewDate] = useState('');
  const [newPinned, setNewPinned] = useState(false);
  const { t } = useLanguage();
  const canCreate = canCreateEvenement(currentUser);
  const canDelete = isAdmin(currentUser);

  const resetCreateForm = () => {
    setNewNom('');
    setNewNotes('');
    setNewObjectif(0);
    setNewDate('');
    setNewPinned(false);
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || !newNom.trim()) return;

    StorageService.addEvenement({
      nom: newNom.trim(),
      notes: newNotes.trim() || undefined,
      objectif_financier: Math.max(0, Number(newObjectif) || 0),
      is_pinned: newPinned,
      date_evenement: newDate ? newDate.replace('T', ' ') : undefined
    });

    onRefreshEvents();
    setShowCreateModal(false);
    resetCreateForm();
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 }
    });
  };

  const handleDonate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donateEventId) return;

    StorageService.contributeToEvenement(donateEventId, Number(donateAmount));
    onRefreshEvents();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });
    setDonateEventId(null);
  };

  const handleDeleteEvent = (event: Evenement) => {
    if (!canDelete) return;
    if (!window.confirm(t('events.deleteConfirm', { name: event.nom }))) return;
    StorageService.deleteEvenement(event.id);
    onRefreshEvents();
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-gold">{t('events.badge')}</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('events.title')}</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('events.subtitle')}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={18} />
            <span>{t('events.create')}</span>
          </button>
        )}
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {evenements.map((ev) => {
          const percent = ev.objectif_financier > 0
            ? Math.min(100, Math.round((ev.collecte_actuelle / ev.objectif_financier) * 100))
            : 0;

          return (
            <div
              key={ev.id}
              className="glass-card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                border: ev.is_pinned ? '1px solid var(--border-gold)' : '1px solid var(--border-color)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {ev.is_pinned && (
                      <span className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Pin size={12} /> {t('events.pinned')}
                      </span>
                    )}
                    {ev.date_evenement && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} /> {ev.date_evenement}
                      </span>
                    )}
                  </div>

                  <h2 style={{ fontSize: '1.35rem', margin: '0 0 8px' }}>{ev.nom}</h2>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {ev.notes}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setDonateEventId(ev.id)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <HeartHandshake size={18} />
                    <span>{t('events.donate')}</span>
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteEvent(ev)}
                      className="btn btn-danger"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      title={t('events.delete')}
                    >
                      <Trash2 size={17} />
                      <span>{t('common.delete')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Financial Progress Bar */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('events.collected')}: </span>
                    <strong style={{ fontSize: '1.15rem', color: '#10b981' }}>
                      {ev.collecte_actuelle.toLocaleString()} Ar
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('events.goal')}: </span>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                      {ev.objectif_financier.toLocaleString()} Ar ({percent}%)
                    </strong>
                  </div>
                </div>

                {/* Bar */}
                <div style={{ width: '100%', height: '10px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #f59e0b)',
                    borderRadius: '5px',
                    transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                  }} />
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* CREATE EVENT MODAL */}
      {showCreateModal && canCreate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '26px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{t('events.createTitle')}</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="btn btn-ghost"
                style={{ padding: '6px' }}
                title={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('events.nameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  className="form-input"
                  placeholder={t('events.namePlaceholder')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('events.notesLabel')}
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="form-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                  placeholder={t('events.notesPlaceholder')}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('events.dateLabel')}
                  </label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('events.goalLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newObjectif}
                    onChange={(e) => setNewObjectif(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newPinned}
                  onChange={(e) => setNewPinned(e.target.checked)}
                />
                {t('events.pinLabel')}
              </label>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('events.submitCreate')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="btn btn-ghost"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DONATE MODAL */}
      {donateEventId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '26px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px' }}>
              {t('events.donateTitle')}
            </h3>

            <form onSubmit={handleDonate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('events.amountLabel')}
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(Number(e.target.value))}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[5000, 10000, 20000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDonateAmount(amt)}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  >
                    {amt.toLocaleString()} Ar
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('events.submitDonate')}
                </button>
                <button
                  type="button"
                  onClick={() => setDonateEventId(null)}
                  className="btn btn-ghost"
                >
                  {t('events.keepOpen')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
