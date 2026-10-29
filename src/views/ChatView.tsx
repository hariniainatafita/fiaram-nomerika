import React, { useState, useEffect, useRef } from 'react';
import { Membre, Groupe, Message } from '../types';
import { 
  Send, 
  Image as ImageIcon, 
  Search, 
  Users, 
  CheckCheck, 
  X,
  Maximize2,
  Download,
  ArrowLeft
} from 'lucide-react';
import { StorageService } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { useLanguage } from '../i18n';

interface ChatViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  allGroupes: Groupe[];
  messages: Message[];
  onRefreshMessages: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  allMembres,
  allGroupes,
  messages,
  onRefreshMessages
}) => {
  // Active conversation target: either a group id or a member id
  const [activeChannelType, setActiveChannelType] = useState<'group' | 'direct'>('group');
  const [activeChannelId, setActiveChannelId] = useState(allGroupes[0]?.id || 'g1');

  // New message input
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchContact, setSearchContact] = useState('');

  // Staged image attachment state
  const [stagedImage, setStagedImage] = useState<{
    dataUrl: string;
    fileName: string;
    fileSizeKb: number;
  } | null>(null);

  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Lightbox modal for viewing image full-screen
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // On phones, show either the contact list or the active conversation
  const [isMobileConversation, setIsMobileConversation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { t } = useLanguage();

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChannelId, stagedImage]);

  // Current conversation details
  const activeGroup = activeChannelType === 'group' 
    ? allGroupes.find((g) => g.id === activeChannelId) 
    : null;
  const activePeer = activeChannelType === 'direct' 
    ? allMembres.find((m) => m.id === activeChannelId) 
    : null;

  // Filter messages for current channel
  const channelMessages = messages.filter((m) => {
    if (activeChannelType === 'group') {
      return m.group_id === activeChannelId;
    } else {
      return (
        (m.sender_id === currentUser.id && m.receiver_id === activeChannelId) ||
        (m.sender_id === activeChannelId && m.receiver_id === currentUser.id)
      );
    }
  });

  // Handle local image file selection with canvas compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const compressedDataUrl = await compressImage(file, 900, 900, 0.8);
      const sizeKb = Math.round(compressedDataUrl.length / 1024);

      setStagedImage({
        dataUrl: compressedDataUrl,
        fileName: file.name,
        fileSizeKb: sizeKb
      });
    } catch (err) {
      console.error('Erreur compression image:', err);
      alert(t('chat.imageProcessError'));
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  // Remove staged image
  const handleRemoveStagedImage = () => {
    setStagedImage(null);
  };

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !stagedImage) return;

    const imageUrlToSend = stagedImage?.dataUrl;
    const attachmentPayload = stagedImage ? {
      file_url: stagedImage.dataUrl,
      file_name: stagedImage.fileName,
      file_type: 'image' as const
    } : undefined;

    if (activeChannelType === 'group') {
      StorageService.sendMessage(
        currentUser.id, 
        inputText.trim(), 
        undefined, 
        activeChannelId, 
        imageUrlToSend, 
        attachmentPayload
      );
    } else {
      StorageService.sendMessage(
        currentUser.id, 
        inputText.trim(), 
        activeChannelId, 
        undefined, 
        imageUrlToSend, 
        attachmentPayload
      );
    }

    setInputText('');
    setStagedImage(null);
    onRefreshMessages();

    // Trigger simulated reply if private chat
    if (activeChannelType === 'direct') {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        StorageService.sendMessage(
          activeChannelId,
          imageUrlToSend 
            ? t('chat.autoReplyImage')
            : t('chat.autoReplyText'),
          currentUser.id,
          undefined
        );
        onRefreshMessages();
      }, 1500);
    }
  };

  return (
    <div className={`animate-fade-in chat-container-wrapper${isMobileConversation ? ' chat-mobile-conversation' : ''}`} style={{
      padding: '16px 20px',
      maxWidth: '1240px',
      margin: '0 auto',
      height: 'calc(100dvh - 130px)',
      minHeight: '480px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Container Card */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        
        {/* LEFT CONTACTS / CHANNELS COLUMN */}
        <div className="chat-sidebar" style={{
          width: '310px',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(0, 0, 0, 0.12)',
          flexShrink: 0
        }}>
          {/* Header search */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>{t('chat.title')}</h3>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder={t('chat.searchPlaceholder')}
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                className="form-input"
                style={{ padding: '7px 12px 7px 30px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Channels & Contacts List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            
            {/* Groups section */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', padding: '6px 10px', textTransform: 'uppercase' }}>
              {t('chat.groupsSection', { count: allGroupes.length })}
            </div>

            {allGroupes.map((g) => {
              const isSelected = activeChannelType === 'group' && activeChannelId === g.id;
              const chef = allMembres.find((m) => m.id === g.chef_id);

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setActiveChannelType('group');
                    setActiveChannelId(g.id);
                    setIsMobileConversation(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid var(--border-gold)' : '1px solid transparent',
                    background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: 'var(--text-main)',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6',
                    flexShrink: 0
                  }}>
                    <Users size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: isSelected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.nom_groupe}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {t('chat.chefLabel', { name: chef ? chef.prenom : t('chat.designated') })}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Direct Messages Section */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', padding: '12px 10px 6px', textTransform: 'uppercase' }}>
              {t('chat.directMessages')}
            </div>

            {allMembres.filter((m) => m.id !== currentUser.id).map((m) => {
              const isSelected = activeChannelType === 'direct' && activeChannelId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActiveChannelType('direct');
                    setActiveChannelId(m.id);
                    setIsMobileConversation(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid var(--border-gold)' : '1px solid transparent',
                    background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: 'var(--text-main)',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={m.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
                      alt={m.prenom}
                      style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: '#10b981',
                      border: '2px solid var(--bg-secondary)'
                    }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: isSelected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.prenom} {m.nom}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {m.role === 'chef' ? t('common.role.chef') : m.role === 'super_chef' ? t('common.role.superChef') : m.role === 'admin' ? t('common.role.admin') : t('common.role.member')}
                    </div>
                  </div>
                </button>
              );
            })}

          </div>
        </div>

        {/* RIGHT ACTIVE CHAT CONVERSATION */}
        <div className="chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          
          {/* Channel Header */}
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setIsMobileConversation(false)}
                className="btn btn-ghost chat-back-btn"
                style={{ padding: '6px', flexShrink: 0 }}
                title={t('chat.title')}
              >
                <ArrowLeft size={18} />
              </button>

              {activeChannelType === 'group' ? (
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3b82f6',
                  flexShrink: 0
                }}>
                  <Users size={20} />
                </div>
              ) : (
                <img
                  src={activePeer?.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
                  alt=""
                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              )}

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeChannelType === 'group' ? activeGroup?.nom_groupe : `${activePeer?.prenom} ${activePeer?.nom}`}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#10b981' }}>
                  {activeChannelType === 'group' ? t('chat.groupSubtitle') : t('chat.onlineStatus')}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>{t('chat.groupBadge')}</span>
            </div>
          </div>

          {/* Messages Feed */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {channelMessages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
                <div style={{ fontWeight: 600 }}>{t('chat.emptyTitle')}</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                  {t('chat.emptySubtitle')}
                </div>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                const sender = allMembres.find((m) => m.id === msg.sender_id);
                const hasImage = Boolean(msg.image_url || (msg.file_type === 'image' && msg.file_url));
                const imageUrl = msg.image_url || msg.file_url;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: '8px'
                    }}
                  >
                    {!isMe && (
                      <img
                        src={sender?.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
                        alt=""
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', marginBottom: '4px', flexShrink: 0 }}
                      />
                    )}

                    <div style={{
                      maxWidth: '75%',
                      minWidth: '120px',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      borderBottomRightRadius: isMe ? '2px' : '14px',
                      borderBottomLeftRadius: !isMe ? '2px' : '14px',
                      background: isMe 
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
                        : 'rgba(255, 255, 255, 0.08)',
                      color: isMe ? '#070d1e' : 'var(--text-main)',
                      fontSize: '0.88rem',
                      lineHeight: 1.4,
                      boxShadow: 'var(--shadow-sm)',
                      wordBreak: 'break-word'
                    }}>
                      {!isMe && (
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '4px' }}>
                          {sender?.prenom} {sender?.nom}
                        </div>
                      )}

                      {/* Display image with lightbox zoom */}
                      {hasImage && imageUrl && (
                        <div style={{ position: 'relative', marginBottom: '8px', overflow: 'hidden', borderRadius: '10px' }}>
                          <img
                            src={imageUrl}
                            alt={t('chat.sentImageAlt')}
                            onClick={() => setLightboxImageUrl(imageUrl)}
                            style={{
                              width: '100%',
                              maxHeight: '260px',
                              objectFit: 'cover',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              display: 'block',
                              transition: 'transform 0.2s ease',
                              border: isMe ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setLightboxImageUrl(imageUrl)}
                            style={{
                              position: 'absolute',
                              bottom: '6px',
                              right: '6px',
                              background: 'rgba(0, 0, 0, 0.65)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem'
                            }}
                            title={t('chat.viewFullscreenTitle')}
                          >
                            <Maximize2 size={12} />
                            <span>{t('chat.fullscreen')}</span>
                          </button>
                        </div>
                      )}

                      {/* Text content if present */}
                      {msg.message && (
                        <div style={{ whiteSpace: 'pre-wrap', fontWeight: isMe ? 500 : 400 }}>
                          {msg.message}
                        </div>
                      )}

                      {/* Footer time & read checkmark */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '4px',
                        fontSize: '0.65rem',
                        color: isMe ? 'rgba(7, 13, 30, 0.7)' : 'var(--text-dim)',
                        marginTop: '4px'
                      }}>
                        <span>{msg.sent_at ? msg.sent_at.slice(-5) : ''}</span>
                        {isMe && <CheckCheck size={12} />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="animate-pulse-glow">●</span>
                <span>{t('chat.typing', { name: activePeer?.prenom ?? '' })}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Staged Attachment Preview Banner */}
          {stagedImage && (
            <div style={{
              padding: '10px 18px',
              background: 'rgba(245, 158, 11, 0.12)',
              borderTop: '1px solid var(--border-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={stagedImage.dataUrl}
                    alt={t('chat.stagedImageAlt')}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '2px solid var(--accent-gold)'
                    }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('chat.stagedImageLabel', { name: stagedImage.fileName })}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {t('chat.stagedImageMeta', { size: stagedImage.fileSizeKb })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRemoveStagedImage}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%', color: '#ef4444' }}
                title={t('chat.removeImageTitle')}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Processing image indicator */}
          {isProcessingImage && (
            <div style={{
              padding: '8px 18px',
              background: 'rgba(59, 130, 246, 0.1)',
              fontSize: '0.78rem',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="animate-pulse-glow">⏳</span>
              <span>{t('chat.optimizingImage')}</span>
            </div>
          )}

          {/* Bottom message input form */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(0, 0, 0, 0.2)'
            }}
          >
            {/* Hidden file input for images */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageFileChange}
              style={{ display: 'none' }}
              accept="image/*"
            />

            {/* Prominent Image Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-ghost"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: stagedImage ? 'var(--accent-gold)' : 'var(--text-main)',
                border: stagedImage ? '1px solid var(--border-gold)' : '1px solid var(--border-color)'
              }}
              title={t('chat.addImageTitle')}
            >
              <ImageIcon size={18} />
              <span style={{ fontSize: '0.8rem', display: 'none' }} className="image-btn-text">{t('chat.imageButton')}</span>
            </button>

            {/* Input message text */}
            <input
              type="text"
              placeholder={
                stagedImage 
                  ? t('chat.imageCaptionPlaceholder')
                  : t('chat.messagePlaceholder', { name: activeChannelType === 'group' ? activeGroup?.nom_groupe ?? '' : activePeer?.prenom ?? '' })
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="form-input"
              style={{ flex: 1, fontSize: '0.88rem' }}
            />

            {/* Send button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isProcessingImage || (!inputText.trim() && !stagedImage)}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-full)',
                opacity: (!inputText.trim() && !stagedImage) ? 0.6 : 1
              }}
            >
              <Send size={16} />
              <span>{t('chat.send')}</span>
            </button>
          </form>

        </div>

      </div>

      {/* LIGHTBOX MODAL FOR FULL SCREEN IMAGE VIEW */}
      {lightboxImageUrl && (
        <div 
          onClick={() => setLightboxImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-45px',
              right: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <a
                href={lightboxImageUrl}
                download="image_chat_groupe.jpg"
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: '0.78rem', color: '#ffffff' }}
                title={t('chat.downloadImageTitle')}
              >
                <Download size={16} />
                <span>{t('common.download')}</span>
              </a>

              <button
                type="button"
                onClick={() => setLightboxImageUrl(null)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%', color: '#ffffff' }}
                title={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <img
              src={lightboxImageUrl}
              alt={t('chat.fullImageAlt')}
              style={{
                maxWidth: '90vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        .chat-back-btn {
          display: none !important;
        }
        @media (max-width: 768px) {
          .chat-container-wrapper {
            height: calc(100dvh - 150px) !important;
            min-height: 420px !important;
            padding: 10px 8px !important;
          }
          .chat-sidebar {
            width: 100% !important;
            border-right: none !important;
          }
          .chat-main {
            display: none !important;
          }
          .chat-container-wrapper.chat-mobile-conversation .chat-sidebar {
            display: none !important;
          }
          .chat-container-wrapper.chat-mobile-conversation .chat-main {
            display: flex !important;
          }
          .chat-container-wrapper.chat-mobile-conversation .chat-back-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
};
