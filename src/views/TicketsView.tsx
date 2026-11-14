import React, { useMemo, useState } from 'react';
import { Groupe, Membre, Publication } from '../types';
import { StorageService } from '../utils/storage';
import { canViewPublication, isAdmin, isChef } from '../utils/permissions';
import { useLanguage } from '../i18n';
import { MyTicketsSection } from '../components/MyTicketsSection';
import { ManageEventTicketsModal } from '../components/EventTicketModals';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  Settings2,
  Ticket,
  Users,
  Wand2
} from 'lucide-react';

interface TicketsViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  allGroupes: Groupe[];
  publications: Publication[];
  onRefreshPublications: () => void;
}

const money = (value: number): string => `${Math.round(value).toLocaleString('fr-FR')} Ar`;

export const TicketsView: React.FC<TicketsViewProps> = ({
  currentUser,
  allMembres,
  allGroupes,
  publications,
  onRefreshPublications
}) => {
  const { t } = useLanguage();
  const [tick, setTick] = useState(0);
  const [manageId, setManageId] = useState<string | null>(null);
  const canManage = isAdmin(currentUser) || isChef(currentUser);

  const events = useMemo(
    () => {
      void tick;
      return publications
        .filter((publication) => publication.event && canViewPublication(currentUser, publication, allGroupes))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    [publications, currentUser, allGroupes, tick]
  );

  const buyerName = (id: string): string => {
    const membre = allMembres.find((item) => item.id === id);
    return membre ? `${membre.prenom} ${membre.nom}` : t('common.unknown');
  };

  const statsFor = (publicationId: string) => {
    const commandes = StorageService.getCommandesForPublication(publicationId);
    const billets = StorageService.getBilletsForPublication(publicationId);
    const waiting = commandes.filter(
      (commande) => commande.statut === 'paiement_declare' || commande.statut === 'en_attente'
    );
    const validated = commandes.filter((commande) => commande.statut === 'valide');
    const sold = validated.reduce((total, commande) => total + commande.quantite, 0);
    const revenue = validated.reduce((total, commande) => total + commande.montant_total, 0);
    const used = billets.filter((billet) => billet.statut === 'utilise').length;
    return { commandes, billets, waiting, validated, sold, revenue, used };
  };

  const generateMissing = (publicationId: string) => {
    const { validated, billets } = statsFor(publicationId);
    validated.forEach((commande) => {
      if (!billets.some((billet) => billet.commande_id === commande.id)) {
        StorageService.validateBilletCommande(commande.id, currentUser.id);
      }
    });
    setTick((value) => value + 1);
    onRefreshPublications();
  };

  const activeManage = manageId ? publications.find((item) => item.id === manageId) : undefined;

  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-card" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Ticket size={22} style={{ color: '#d4af37' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('publications.event.ticketsSpace')}</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {t('publications.event.ticketsSpaceSubtitle')}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Ticket size={18} style={{ color: '#10b981' }} />
          <strong style={{ fontSize: '0.92rem' }}>{t('publications.event.myTickets')}</strong>
        </div>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          {t('publications.event.myTicketsSubtitle')}
        </div>
        <MyTicketsSection currentUser={currentUser} />
      </div>

      {canManage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{t('publications.event.ticketsSold')}</h3>
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

          {events.length === 0 ? (
            <div className="glass-card" style={{ padding: '22px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              {t('publications.event.noEventsWithTickets')}
            </div>
          ) : (
            events.map((publication) => {
              const { waiting, validated, sold, revenue, used, billets } = statsFor(publication.id);
              const missing = validated.some(
                (commande) => !billets.some((billet) => billet.commande_id === commande.id)
              );
              return (
                <div key={publication.id} className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{publication.event?.nom}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {publication.event?.date} · {publication.event?.lieu} · {money(publication.event?.prix_billet || 0)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '8px 12px', fontSize: '0.76rem' }}
                      onClick={() => setManageId(publication.id)}
                    >
                      <Settings2 size={14} />
                      <span>{t('publications.event.manage')}</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <div className="glass-card" style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#d4af37' }}>{sold}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('publications.event.ticketsSold')}</div>
                    </div>
                    <div className="glass-card" style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>{used}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('publications.event.ticketsUsed')}</div>
                    </div>
                    <div className="glass-card" style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#a78bfa' }}>{billets.length}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        {t('publications.event.generatedCount', { count: billets.length })}
                      </div>
                    </div>
                    <div className="glass-card" style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#d4af37' }}>{money(revenue)}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('common.total')}</div>
                    </div>
                  </div>

                  {missing && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '8px 12px', fontSize: '0.76rem', alignSelf: 'flex-start', color: '#d4af37' }}
                      onClick={() => generateMissing(publication.id)}
                    >
                      <Wand2 size={14} />
                      <span>{t('publications.event.generateMissing')}</span>
                    </button>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                      <Clock size={14} style={{ color: '#d4af37' }} />
                      <span>{t('publications.event.waitingList')} ({waiting.length})</span>
                    </div>
                    {waiting.length === 0 ? (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{t('publications.event.noWaiting')}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {waiting.map((commande) => (
                          <div key={commande.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.76rem', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Users size={13} style={{ color: 'var(--text-dim)' }} />
                              {buyerName(commande.acheteur_id)}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {t('publications.event.ticketCount', { count: commande.quantite })} · {commande.reference}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                      <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                      <span>{t('publications.event.soldOrders')} ({validated.length})</span>
                    </div>
                    {validated.length === 0 ? (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{t('publications.event.noSoldOrders')}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {validated.map((commande) => {
                          const codes = billets
                            .filter((billet) => billet.commande_id === commande.id)
                            .map((billet) => billet.code);
                          return (
                            <div key={commande.id} className="glass-card" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.76rem', fontWeight: 700, flexWrap: 'wrap' }}>
                                <span>{buyerName(commande.acheteur_id)}</span>
                                <span style={{ color: '#10b981' }}>{money(commande.montant_total)}</span>
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {t('publications.event.ticketCount', { count: commande.quantite })} · {commande.reference}
                              </div>
                              {codes.length > 0 && (
                                <div style={{ fontFamily: 'monospace', fontSize: '0.66rem', color: '#d4af37', wordBreak: 'break-all' }}>
                                  {codes.join(' · ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeManage && (
        <ManageEventTicketsModal
          publication={activeManage}
          currentUser={currentUser}
          allMembres={allMembres}
          onClose={() => setManageId(null)}
          onRefresh={() => {
            setTick((value) => value + 1);
            onRefreshPublications();
          }}
        />
      )}
    </div>
  );
};
