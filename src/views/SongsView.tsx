import React, { useState } from 'react';
import { Membre, Chanson, CategorieChanson } from '../types';
import { 
  Search, 
  Heart, 
  Play, 
  Pause, 
  Video, 
  Printer, 
  Share2, 
  Plus, 
  Eye, 
  Volume2,
  Trash2,
  FolderCog,
  Pencil,
  X
} from 'lucide-react';
import { StorageService } from '../utils/storage';
import { isAdmin, isChef } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface SongsViewProps {
  currentUser: Membre;
  chansons: Chanson[];
  onRefreshChansons: () => void;
}

const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  cat_doc: 'resources.category.documents',
  cat_formation: 'resources.category.formation',
  cat_media: 'resources.category.media',
  cat_annonce: 'resources.category.announcement',
  cat_autre: 'resources.category.other'
};

const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
  cat_doc: 'Documents',
  cat_formation: 'Formation',
  cat_media: 'Médias',
  cat_annonce: 'Annonces',
  cat_autre: 'Autres'
};

export const SongsView: React.FC<SongsViewProps> = ({
  currentUser,
  chansons,
  onRefreshChansons
}) => {
  const { t } = useLanguage();
  const isLeader = isChef(currentUser);
  const canManageCategories = isAdmin(currentUser);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Selected song for full lyrics modal
  const [activeSong, setActiveSong] = useState<Chanson | null>(null);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Categories
  const [categories, setCategories] = useState<CategorieChanson[]>(() => StorageService.getCategoriesRessources());
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Add song modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitre, setNewTitre] = useState('');
  const [newAuteur, setNewAuteur] = useState('');
  const [newParoles, setNewParoles] = useState('');
  const [newCatId, setNewCatId] = useState(() => StorageService.getCategoriesRessources()[0]?.id || '');

  const refreshCategories = () => {
    const updated = StorageService.getCategoriesRessources();
    setCategories(updated);
    return updated;
  };

  const getCategoryName = (categoryId?: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return t('resources.categoryFallback');
    const translationKey = CATEGORY_TRANSLATION_KEYS[category.id];
    const isDefaultName = category.nom === DEFAULT_CATEGORY_NAMES[category.id];
    return translationKey && isDefaultName ? t(translationKey) : category.nom;
  };

  const categoryAlreadyExists = (name: string, ignoredId?: string) => {
    const normalized = name.trim().toLowerCase();
    return categories.some(
      (category) =>
        category.id !== ignoredId &&
        (category.nom.trim().toLowerCase() === normalized ||
          getCategoryName(category.id).trim().toLowerCase() === normalized)
    );
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      alert(t('resources.categoryEmpty'));
      return;
    }
    if (categoryAlreadyExists(name)) {
      alert(t('resources.categoryDuplicate'));
      return;
    }
    const created = StorageService.addCategorieRessource(name);
    refreshCategories();
    setNewCategoryName('');
    if (!newCatId) setNewCatId(created.id);
  };

  const handleRenameCategory = (categoryId: string) => {
    const name = editingCategoryName.trim();
    if (!name) {
      alert(t('resources.categoryEmpty'));
      return;
    }
    if (categoryAlreadyExists(name, categoryId)) {
      alert(t('resources.categoryDuplicate'));
      return;
    }
    if (DEFAULT_CATEGORY_NAMES[categoryId] && name === getCategoryName(categoryId)) {
      setEditingCategoryId(null);
      setEditingCategoryName('');
      return;
    }
    StorageService.updateCategorieRessource(categoryId, name);
    refreshCategories();
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleDeleteCategory = (category: CategorieChanson) => {
    if (!window.confirm(t('resources.deleteCategoryConfirm', { name: getCategoryName(category.id) }))) return;
    StorageService.deleteCategorieRessource(category.id);
    const updated = refreshCategories();
    if (selectedCategory === category.id) setSelectedCategory('all');
    if (newCatId === category.id) setNewCatId(updated[0]?.id || '');
    if (editingCategoryId === category.id) {
      setEditingCategoryId(null);
      setEditingCategoryName('');
    }
    onRefreshChansons();
  };

  // Toggle Favorite
  const handleToggleFavorite = (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    StorageService.toggleFavoriChanson(songId);
    onRefreshChansons();
  };

  // Open Song Details
  const handleOpenSong = (song: Chanson) => {
    StorageService.incrementChansonViews(song.id);
    onRefreshChansons();
    setActiveSong(song);
  };

  // Delete song
  const handleDeleteSong = (songId: string, songTitre: string) => {
    if (window.confirm(t('resources.deleteConfirm', { name: songTitre }))) {
      StorageService.deleteChanson(songId);
      if (activeSong?.id === songId) {
        setActiveSong(null);
      }
      onRefreshChansons();
    }
  };

  // Audio play/pause simulation
  const handlePlayAudio = (url?: string) => {
    if (!url) {
      alert(t('resources.noAudio'));
      return;
    }
    if (audioUrl === url && isPlaying) {
      setIsPlaying(false);
    } else {
      setAudioUrl(url);
      setIsPlaying(true);
    }
  };

  // Add song submit
  const handleAddSongSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitre.trim() || !newParoles.trim()) return;

    StorageService.addChanson({
      titre: newTitre,
      auteur: newAuteur || t('common.group'),
      compositeur: 'Administration',
      categorie_id: newCatId,
      paroles: newParoles,
      is_active: true,
      is_favori: false
    });

    onRefreshChansons();
    setShowAddModal(false);
    setNewTitre('');
    setNewAuteur('');
    setNewParoles('');
  };

  // Filtered song list
  const filteredChansons = chansons.filter((s) => {
    const textMatch = 
      s.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.auteur && s.auteur.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.paroles && s.paroles.toLowerCase().includes(searchTerm.toLowerCase()));
    const catMatch = selectedCategory === 'all' || s.categorie_id === selectedCategory;
    const favMatch = !favoritesOnly || s.is_favori;
    return textMatch && catMatch && favMatch;
  });

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-gold">{t('resources.badge')}</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('resources.title')}</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('resources.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {canManageCategories && (
            <button
              onClick={() => setShowCategoriesModal(true)}
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FolderCog size={18} />
              <span>{t('resources.manageCategories')}</span>
            </button>
          )}

          {isLeader && (
            <button 
              onClick={() => setShowAddModal(true)} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} />
              <span>{t('resources.add')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Persistent Audio Mini-Player if playing */}
      {audioUrl && (
        <div style={{
          position: 'sticky',
          top: '74px',
          zIndex: 35,
          marginBottom: '20px',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(245, 158, 11, 0.2))',
          border: '1px solid var(--border-gold)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070d1e'
            }}>
              <Volume2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                {isPlaying ? t('resources.playing') : t('resources.paused')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {t('resources.playerSubtitle')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn btn-primary"
              style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%' }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={() => { setIsPlaying(false); setAudioUrl(null); }}
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', padding: '6px 10px' }}
            >
              {t('resources.stop')}
            </button>
          </div>
        </div>
      )}

      {/* Search & Categories Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder={t('resources.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`btn ${favoritesOnly ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.82rem', padding: '9px 16px' }}
          >
            <Heart size={16} style={{ fill: favoritesOnly ? '#070d1e' : 'none' }} />
            <span>{t('resources.favorites')}</span>
          </button>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[{ id: 'all', nom: t('common.all') }, ...categories].map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: selectedCategory === c.id ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                background: selectedCategory === c.id ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                color: selectedCategory === c.id ? 'var(--accent-gold)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {c.id === 'all' ? c.nom : getCategoryName(c.id)}
            </button>
          ))}
        </div>
      </div>

      {/* Song Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '18px'
      }}>
        {filteredChansons.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('resources.noMatch')}
          </div>
        ) : (
          filteredChansons.map((song) => (
            <div
              key={song.id}
              onClick={() => handleOpenSong(song)}
              className="glass-card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>
                    {getCategoryName(song.categorie_id)}
                  </span>
                  
                  <button
                    onClick={(e) => handleToggleFavorite(e, song.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: song.is_favori ? '#ef4444' : 'var(--text-dim)' }}
                    title={song.is_favori ? t('resources.unfavorite') : t('resources.favorite')}
                  >
                    <Heart size={18} style={{ fill: song.is_favori ? '#ef4444' : 'none' }} />
                  </button>
                </div>

                <h3 style={{ fontSize: '1.1rem', margin: '0 0 6px', lineHeight: 1.3 }}>
                  {song.titre}
                </h3>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  {t('resources.author')} : <strong style={{ color: 'var(--text-main)' }}>{song.auteur || t('common.group')}</strong>
                </div>

                {/* Lyrics snippet */}
                <div style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-dim)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  whiteSpace: 'pre-line',
                  maxHeight: '75px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.4,
                  fontFamily: 'serif'
                }}>
                  {song.paroles ? song.paroles.slice(0, 140) + '...' : t('resources.emptyContent')}
                </div>
              </div>

              {/* Card Footer: Views and Action Shortcuts */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={13} /> {song.vues || 0} {t('resources.views')}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {song.fichier_audio && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio(song.fichier_audio);
                      }}
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
                      title={t('resources.listen')}
                    >
                      <Play size={13} />
                      <span>{t('resources.listen')}</span>
                    </button>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
                  >
                    {t('resources.read')}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FULL LYRICS & MEDIA MODAL */}
      {activeSong && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-gold)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px'
            }}>
              <div>
                <span className="badge badge-gold" style={{ marginBottom: '6px' }}>
                  {getCategoryName(activeSong.categorie_id)}
                </span>
                <h2 style={{ fontSize: '1.4rem', margin: '4px 0 2px' }}>{activeSong.titre}</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('resources.author')} : {activeSong.auteur} · {t('resources.source')} : {activeSong.compositeur}
                </div>
              </div>

              <button
                onClick={() => setActiveSong(null)}
                className="btn btn-ghost"
                style={{ padding: '8px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Formatted Lyrics */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', whiteSpace: 'pre-line', fontSize: '0.95rem', lineHeight: 1.8, fontFamily: 'serif' }}>
              {activeSong.paroles}
            </div>

            {/* Modal Footer Controls */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeSong.fichier_audio && (
                  <button
                    onClick={() => handlePlayAudio(activeSong.fichier_audio)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <Play size={15} />
                    <span>{t('resources.listen')}</span>
                  </button>
                )}

                {activeSong.lien_youtube && (
                  <a
                    href={activeSong.lien_youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Video size={15} style={{ color: '#ef4444' }} />
                    <span>YouTube</span>
                  </a>
                )}

                <button
                  onClick={() => window.print()}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.82rem' }}
                >
                  <Printer size={15} />
                  <span>{t('common.print')}</span>
                </button>
              </div>

                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`${activeSong.titre}\n\n${activeSong.paroles}`);
                    alert(t('resources.copied'));
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.82rem' }}
                >
                  <Share2 size={15} />
                  <span>{t('common.share')}</span>
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => handleDeleteSong(activeSong.id, activeSong.titre)}
                    className="btn btn-danger"
                    style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={15} />
                    <span>{t('common.delete')}</span>
                  </button>
                )}
            </div>

          </div>
        </div>
      )}

      {/* CATEGORY MANAGEMENT MODAL */}
      {showCategoriesModal && canManageCategories && (
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
          <div className="glass-card" style={{ maxWidth: '620px', width: '100%', padding: '26px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{t('resources.categoriesTitle')}</h3>
                <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('resources.categoriesHint')}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCategoriesModal(false);
                  setEditingCategoryId(null);
                  setEditingCategoryName('');
                }}
                className="btn btn-ghost"
                style={{ padding: '6px' }}
                title={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px', margin: '20px 0' }}>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="form-input"
                placeholder={t('resources.newCategoryPlaceholder')}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                <Plus size={16} />
                {t('resources.addCategory')}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((category) => (
                <div
                  key={category.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)'
                  }}
                >
                  {editingCategoryId === category.id ? (
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                      autoFocus
                    />
                  ) : (
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem' }}>
                      {getCategoryName(category.id)}
                    </span>
                  )}

                  {editingCategoryId === category.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRenameCategory(category.id)}
                        className="btn btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      >
                        {t('common.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setEditingCategoryName('');
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      >
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditingCategoryName(getCategoryName(category.id));
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        title={t('common.rename')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category)}
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', color: '#ef4444' }}
                        title={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', margin: '10px 0' }}>
                  {t('common.noData')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD SONG MODAL */}
      {showAddModal && (
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
          <div className="glass-card" style={{ maxWidth: '600px', width: '100%', padding: '26px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
              {t('resources.addTitle')}
            </h3>

            <form onSubmit={handleAddSongSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('resources.resourceTitleLabel')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('resources.resourceTitlePlaceholder')}
                  value={newTitre}
                  onChange={(e) => setNewTitre(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('resources.authorLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('resources.authorPlaceholder')}
                    value={newAuteur}
                    onChange={(e) => setNewAuteur(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('resources.categoryLabel')}
                  </label>
                  <select
                    value={newCatId}
                    onChange={(e) => setNewCatId(e.target.value)}
                    className="form-select"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {getCategoryName(category.id)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('resources.contentLabel')}
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder={t('resources.contentPlaceholder')}
                  value={newParoles}
                  onChange={(e) => setNewParoles(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('resources.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
