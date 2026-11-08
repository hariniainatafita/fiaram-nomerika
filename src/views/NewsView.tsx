import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n';
import { resolveServerUrl } from '../lib/appConfig';
import {
  AlertCircle,
  CalendarDays,
  ExternalLink,
  Loader2,
  Newspaper,
  PlayCircle,
  RefreshCw,
  Search
} from 'lucide-react';

const FRANCE24_CHANNEL_ID = 'UCCCPCZNChQdGa9EkATeye4g';
const FRANCE24_LIVE_URL = 'https://www.france24.com/fr/direct';

interface NewsItem {
  title: string;
  link: string;
  description: string;
  category: string;
  pubDate: string;
  image?: string;
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const NewsView: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'articles' | 'videos'>('articles');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const endpoint = new URL(resolveServerUrl('/api/france24'));
        if (debouncedQuery) endpoint.searchParams.set('q', debouncedQuery);
        endpoint.searchParams.set('limit', '30');
        const response = await fetch(endpoint.toString(), { signal: controller.signal });
        if (!response.ok) throw new Error('http');
        const payload = (await response.json()) as { items?: NewsItem[] };
        if (!cancelled) setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setError(true);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, tick]);

  const liveSrc = useMemo(
    () =>
      `https://www.youtube-nocookie.com/embed/live_stream?channel=${FRANCE24_CHANNEL_ID}&playsinline=1&rel=0`,
    []
  );

  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-card" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Newspaper size={22} style={{ color: '#0ea5e9' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('news.title')}</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {t('news.subtitle')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={tab === 'articles' ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ padding: '9px 14px', fontSize: '0.82rem' }}
          onClick={() => setTab('articles')}
        >
          <Newspaper size={16} />
          <span>{t('news.tab.articles')}</span>
        </button>
        <button
          type="button"
          className={tab === 'videos' ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ padding: '9px 14px', fontSize: '0.82rem' }}
          onClick={() => setTab('videos')}
        >
          <PlayCircle size={16} />
          <span>{t('news.tab.videos')}</span>
        </button>
      </div>

      {tab === 'articles' ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setDebouncedQuery(query.trim());
              setTick((value) => value + 1);
            }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="form-input"
                placeholder={t('news.searchPlaceholder')}
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }}>
              <Search size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '10px 12px' }}
              onClick={() => setTick((value) => value + 1)}
            >
              <RefreshCw size={16} />
            </button>
          </form>

          {loading ? (
            <div className="glass-card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={26} className="animate-pulse-glow" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '0.84rem' }}>{t('news.loading')}</div>
            </div>
          ) : error ? (
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
              <AlertCircle size={26} style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '0.84rem', marginBottom: '10px' }}>{t('news.error')}</div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                onClick={() => setTick((value) => value + 1)}
              >
                <RefreshCw size={14} />
                <span>{t('news.retry')}</span>
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="glass-card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              {t('news.empty')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {items.map((item) => (
                <a
                  key={item.link}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card"
                  style={{ padding: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }}
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '7px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {item.category && (
                        <span className="badge badge-gold" style={{ fontSize: '0.62rem', padding: '2px 7px' }}>
                          {item.category}
                        </span>
                      )}
                      {item.pubDate && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.66rem', color: 'var(--text-dim)' }}>
                          <CalendarDays size={11} />
                          {formatDate(item.pubDate)}
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: '0.9rem', lineHeight: 1.35 }}>{item.title}</strong>
                    {item.description && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                        {item.description}
                      </div>
                    )}
                    <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#0ea5e9', fontWeight: 700 }}>
                      <ExternalLink size={13} />
                      {t('news.readOnFrance24')}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {t('news.source')}
          </div>
        </>
      ) : (
        <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800 }}>{t('news.liveTitle')}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t('news.liveHint')}</div>
          </div>
          <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <iframe
              src={liveSrc}
              title={t('news.liveTitle')}
              style={{ width: '100%', height: '100%', border: 0 }}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <a
            href={FRANCE24_LIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', padding: '8px 12px', fontSize: '0.78rem', textDecoration: 'none' }}
          >
            <ExternalLink size={14} />
            <span>{t('news.openLive')}</span>
          </a>
        </div>
      )}
    </div>
  );
};
