import type { ReactionType } from '../types';

export interface ReactionOption {
  type: ReactionType;
  emoji: string;
  labelKey: string;
  color: string;
}

export const REACTION_OPTIONS: ReactionOption[] = [
  { type: 'like', emoji: '\u{1F44D}', labelKey: 'publications.reaction.like', color: '#3b82f6' },
  { type: 'love', emoji: '\u2764\uFE0F', labelKey: 'publications.reaction.love', color: '#ef4444' },
  { type: 'haha', emoji: '\u{1F602}', labelKey: 'publications.reaction.haha', color: '#f59e0b' },
  { type: 'wow', emoji: '\u{1F62E}', labelKey: 'publications.reaction.wow', color: '#f59e0b' },
  { type: 'sad', emoji: '\u{1F622}', labelKey: 'publications.reaction.sad', color: '#f59e0b' },
  { type: 'angry', emoji: '\u{1F621}', labelKey: 'publications.reaction.angry', color: '#dc2626' }
];

export function getReactionOption(type?: ReactionType): ReactionOption | undefined {
  return REACTION_OPTIONS.find((option) => option.type === type);
}

export function getReactionType(
  reactions: Record<string, ReactionType> | undefined,
  likedBy: string[] | undefined,
  membreId: string
): ReactionType | undefined {
  const explicit = reactions?.[membreId];
  if (explicit) return explicit;
  return likedBy?.includes(membreId) ? 'like' : undefined;
}

export interface ReactionEntry {
  membreId: string;
  type: ReactionType;
}

export function getReactionEntries(
  likedBy: string[] | undefined,
  reactions: Record<string, ReactionType> | undefined
): ReactionEntry[] {
  const ids = new Set<string>([...(likedBy || []), ...Object.keys(reactions || {})]);
  const entries: ReactionEntry[] = [];
  ids.forEach((membreId) => {
    const type = getReactionType(reactions, likedBy, membreId);
    if (type) entries.push({ membreId, type });
  });
  return entries;
}

export function getReactionCounts(
  likedBy: string[] | undefined,
  reactions: Record<string, ReactionType> | undefined
): { total: number; counts: Record<ReactionType, number> } {
  const counts: Record<ReactionType, number> = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
  const entries = getReactionEntries(likedBy, reactions);
  entries.forEach((entry) => {
    counts[entry.type] += 1;
  });
  return { total: entries.length, counts };
}
