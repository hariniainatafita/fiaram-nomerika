export const PENDING_IMAGE_UPLOADS = 'pronumtld_pending_image_uploads_v1';

export const STORAGE_KEYS = {
  DATA_VERSION: 'pronumtld_v2_clean',
  CURRENT_USER_ID: 'pronumtld_current_user_id',
  THEME: 'pronumtld_theme',
  MEMBRES: 'pronumtld_membres_v2',
  MEMBRES_DELETED: 'pronumtld_membres_deleted_v1',
  GROUPES: 'pronumtld_groupes_v2',
  PRESENCES: 'pronumtld_presences_v2',
  FINANCES: 'pronumtld_finances_v2',
  COTISATIONS: 'pronumtld_cotisations_v2',
  CHANSONS: 'pronumtld_chansons_v2',
  MESSAGES: 'pronumtld_messages_v2',
  PRESENCE_ONLINE: 'pronumtld_presence_online_v1',
  EVENEMENTS: 'pronumtld_evenements_v2',
  PUBLICATIONS: 'pronumtld_publications_v1',
  PUBLICATIONS_SEEN: 'pronumtld_publications_seen_v1',
  NOTIFICATIONS: 'pronumtld_notifications_v1',
  PUBLICATIONS_DELETED: 'pronumtld_publications_deleted_v1',
  GROUPES_DELETED: 'pronumtld_groupes_deleted_v1',
  CHANSONS_DELETED: 'pronumtld_chansons_deleted_v1',
  EVENEMENTS_DELETED: 'pronumtld_evenements_deleted_v1',
  QUIZZES_DELETED: 'pronumtld_quizzes_deleted_v1',
  CATEGORIES_DELETED: 'pronumtld_ressource_categories_deleted_v1',
  STORIES_DELETED: 'pronumtld_stories_deleted_v1',
  STORIES: 'pronumtld_stories_v1',
  BILLETS_COMMANDES: 'pronumtld_billets_commandes_v1',
  BILLETS: 'pronumtld_billets_v1',
  QUIZZES: 'pronumtld_quizzes_v1',
  QUIZ_RESULTS: 'pronumtld_quiz_results_v1',
  CATEGORIES_RESSOURCES: 'pronumtld_ressource_categories_v1',
  ADMIN_SETTINGS: 'pronumtld_admin_settings_v2',
  GROUP_READS: 'pronumtld_group_reads_v1',
  PASSWORD_HASHES: 'pronumtld_password_hashes_v1'
};

// Tombstones record hard deletions so the union-merge synchronisation cannot
// resurrect an item deleted on another device. Each value maps item id to the
// deletion timestamp (ms).
export const TOMBSTONE_FOR: Record<string, string> = {
  [STORAGE_KEYS.GROUPES]: STORAGE_KEYS.GROUPES_DELETED,
  [STORAGE_KEYS.CHANSONS]: STORAGE_KEYS.CHANSONS_DELETED,
  [STORAGE_KEYS.EVENEMENTS]: STORAGE_KEYS.EVENEMENTS_DELETED,
  [STORAGE_KEYS.PUBLICATIONS]: STORAGE_KEYS.PUBLICATIONS_DELETED,
  [STORAGE_KEYS.QUIZZES]: STORAGE_KEYS.QUIZZES_DELETED,
  [STORAGE_KEYS.CATEGORIES_RESSOURCES]: STORAGE_KEYS.CATEGORIES_DELETED
};

// Keys that must be shared/synchronised between every device.
// CURRENT_USER_ID and THEME stay local (per-device session & preference).
// MEMBRES_DELETED is placed before MEMBRES so tombstones are known before
// the members list is merged during hydration.
export const SYNCED_KEYS: string[] = [
  STORAGE_KEYS.MEMBRES_DELETED,
  STORAGE_KEYS.MEMBRES,
  STORAGE_KEYS.GROUPES_DELETED,
  STORAGE_KEYS.GROUPES,
  STORAGE_KEYS.PRESENCES,
  STORAGE_KEYS.FINANCES,
  STORAGE_KEYS.COTISATIONS,
  STORAGE_KEYS.CHANSONS_DELETED,
  STORAGE_KEYS.CHANSONS,
  STORAGE_KEYS.MESSAGES,
  STORAGE_KEYS.PRESENCE_ONLINE,
  STORAGE_KEYS.EVENEMENTS_DELETED,
  STORAGE_KEYS.EVENEMENTS,
  STORAGE_KEYS.PUBLICATIONS_DELETED,
  STORAGE_KEYS.PUBLICATIONS,
  STORAGE_KEYS.STORIES_DELETED,
  STORAGE_KEYS.STORIES,
  STORAGE_KEYS.BILLETS_COMMANDES,
  STORAGE_KEYS.BILLETS,
  STORAGE_KEYS.QUIZZES_DELETED,
  STORAGE_KEYS.QUIZZES,
  STORAGE_KEYS.QUIZ_RESULTS,
  STORAGE_KEYS.CATEGORIES_DELETED,
  STORAGE_KEYS.CATEGORIES_RESSOURCES,
  STORAGE_KEYS.ADMIN_SETTINGS,
  STORAGE_KEYS.GROUP_READS,
  // Password hashes (PBKDF2, salted) are synced so a member can sign in from
  // any phone, not only the device where the account was created.
  STORAGE_KEYS.PASSWORD_HASHES
];

// Inline chat images are synced too, but each message gets its own row
// (one base64 image per row) so no collection ever crosses the ~1MB
// Supabase Realtime payload limit that silently drops "value".
export const MESSAGE_IMAGE_PREFIX = 'pronumtld_msgimg_';

export const messageImageKey = (messageId: string): string =>
  `${MESSAGE_IMAGE_PREFIX}${messageId}`;

// Story pictures are stored the same way: the STORIES collection only keeps
// light metadata (id, author, dates) while each picture has its own synced
// row. This keeps stories visible for every member even when the Supabase
// media bucket is unavailable and the picture is kept as a base64 data URL.
export const STORY_IMAGE_PREFIX = 'pronumtld_storyimg_';

export const storyImageKey = (storyId: string): string =>
  `${STORY_IMAGE_PREFIX}${storyId}`;

// Publication pictures follow the same pattern: the PUBLICATIONS collection
// only keeps light metadata (author, text, dates) while each picture has its
// own synced row. This keeps the feed small enough for Supabase Realtime and
// lets pictures reach every device even without the media bucket.
export const PUBLICATION_IMAGE_PREFIX = 'pronumtld_pubimg_';

export const publicationImageKey = (publicationId: string): string =>
  `${PUBLICATION_IMAGE_PREFIX}${publicationId}`;

// Profile and cover photos used to be inlined in the members collection, which
// made that single row grow to several megabytes and slow every profile edit.
// They now live in their own rows; the member record keeps a tiny reference.
export const MEMBER_IMAGE_PREFIX = 'pronumtld_memberimg_';

export const MEMBER_AVATAR_REF = 'pronumtld-image-ref:avatar';
export const MEMBER_COVER_REF = 'pronumtld-image-ref:cover';

export const memberAvatarKey = (memberId: string): string =>
  `${MEMBER_IMAGE_PREFIX}${memberId}_avatar`;

export const memberCoverKey = (memberId: string): string =>
  `${MEMBER_IMAGE_PREFIX}${memberId}_cover`;

// Feed/chat/story pictures use the shared in-memory row cache; member pictures
// keep their own dedicated cache in StorageService.
export const isFeedImageKey = (key: string): boolean =>
  key.startsWith(MESSAGE_IMAGE_PREFIX) ||
  key.startsWith(STORY_IMAGE_PREFIX) ||
  key.startsWith(PUBLICATION_IMAGE_PREFIX);

export const isImageKey = (key: string): boolean =>
  isFeedImageKey(key) || key.startsWith(MEMBER_IMAGE_PREFIX);

export const isSyncedKey = (key: string): boolean =>
  SYNCED_KEYS.includes(key) || isImageKey(key);
