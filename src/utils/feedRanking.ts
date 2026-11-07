import { Publication } from '../types';

export type FeedTopic =
  | 'music'
  | 'sale'
  | 'event'
  | 'announcement'
  | 'prayer'
  | 'sport'
  | 'job';

const TOPIC_KEYWORDS: Record<FeedTopic, string[]> = {
  music: ['musique', 'chanson', 'chorale', 'hira', 'concert', 'repetition', 'chant', 'album', 'clip', 'karaoke'],
  sale: ['vente', 'vendre', 'achat', 'acheter', 'prix', 'promo', 'promotion', 'boutique', 'solde', 'livraison', 'produit', 'mora'],
  event: ['evenement', 'reunion', 'fete', 'sortie', 'programme', 'horaire', 'lieu', 'tetikasa', 'hetsika'],
  announcement: ['annonce', 'information', 'info', 'important', 'urgent', 'officiel', 'communique', 'admin', 'rappel', 'fanambarana'],
  prayer: ['priere', 'vavaka', 'dieu', 'seigneur', 'verset', 'bible', 'spirituel', 'louange', 'adoration'],
  sport: ['sport', 'match', 'football', 'foot', 'basket', 'tournoi', 'entrainement', 'equipe', 'baolina'],
  job: ['emploi', 'recrutement', 'travail', 'stage', 'offre', 'candidature', 'poste', 'embauche', 'asa']
};

const NORMALIZED_KEYWORDS: Record<FeedTopic, string[]> = Object.fromEntries(
  (Object.keys(TOPIC_KEYWORDS) as FeedTopic[]).map((topic) => [
    topic,
    TOPIC_KEYWORDS[topic].map((keyword) => normalizeText(keyword))
  ])
) as Record<FeedTopic, string[]>;

const INTEREST_STORAGE_KEY = 'fiaram_feed_interests_v1';
const MAX_INTEREST_WEIGHT = 8;
const INTEREST_DECAY = 0.96;
const TOPIC_CACHE_LIMIT = 500;

const topicCache = new Map<string, { contenu: string; topics: FeedTopic[] }>();

export type InterestWeights = Partial<Record<FeedTopic, number>>;

type InterestStore = Record<string, InterestWeights>;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function readInterestStore(): InterestStore {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(INTEREST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as InterestStore;
  } catch {
    return {};
  }
}

function writeInterestStore(store: InterestStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // The feed still works without persistence if storage is full or blocked.
  }
}

export function detectPublicationTopics(publication: Publication): FeedTopic[] {
  const contenu = publication.contenu || '';
  const cached = topicCache.get(publication.id);
  if (cached && cached.contenu === contenu) return cached.topics;

  const haystack = normalizeText(contenu);
  const topics = haystack
    ? (Object.keys(NORMALIZED_KEYWORDS) as FeedTopic[]).filter((topic) =>
        NORMALIZED_KEYWORDS[topic].some((keyword) => haystack.includes(keyword))
      )
    : [];

  if (topicCache.size >= TOPIC_CACHE_LIMIT) {
    const oldestKey = topicCache.keys().next().value;
    if (oldestKey !== undefined) topicCache.delete(oldestKey);
  }
  topicCache.set(publication.id, { contenu, topics });
  return topics;
}

export function getInterestWeights(userId: string): InterestWeights {
  if (!userId) return {};
  const store = readInterestStore();
  return store[userId] || {};
}

export function recordTopicInterest(
  userId: string,
  topics: FeedTopic[],
  amount = 1
): InterestWeights {
  if (!userId || topics.length === 0) return {};
  const store = readInterestStore();
  const current: InterestWeights = { ...(store[userId] || {}) };

  (Object.keys(current) as FeedTopic[]).forEach((topic) => {
    const decayed = (current[topic] || 0) * INTEREST_DECAY;
    if (decayed < 0.05) {
      delete current[topic];
    } else {
      current[topic] = decayed;
    }
  });

  topics.forEach((topic) => {
    current[topic] = Math.min(MAX_INTEREST_WEIGHT, (current[topic] || 0) + amount);
  });

  store[userId] = current;
  writeInterestStore(store);
  return current;
}

export function getInterestScore(
  publication: Publication,
  weights: InterestWeights
): number {
  const topics = detectPublicationTopics(publication);
  if (topics.length === 0) return 0;
  return topics.reduce((total, topic) => total + (weights[topic] || 0), 0);
}
