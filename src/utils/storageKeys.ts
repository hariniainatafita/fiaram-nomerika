export const STORAGE_KEYS = {
  DATA_VERSION: 'fiaram_v2_clean',
  CURRENT_USER_ID: 'fiaram_current_user_id',
  THEME: 'fiaram_theme',
  MEMBRES: 'fiaram_membres_v2',
  MEMBRES_DELETED: 'fiaram_membres_deleted_v1',
  GROUPES: 'fiaram_groupes_v2',
  PRESENCES: 'fiaram_presences_v2',
  FINANCES: 'fiaram_finances_v2',
  COTISATIONS: 'fiaram_cotisations_v2',
  CHANSONS: 'fiaram_chansons_v2',
  MESSAGES: 'fiaram_messages_v2',
  PRESENCE_ONLINE: 'fiaram_presence_online_v1',
  EVENEMENTS: 'fiaram_evenements_v2',
  PUBLICATIONS: 'fiaram_publications_v1',
  CATEGORIES_RESSOURCES: 'fiaram_ressource_categories_v1',
  ADMIN_SETTINGS: 'fiaram_admin_settings_v2',
  GROUP_READS: 'fiaram_group_reads_v1'
};

// Keys that must be shared/synchronised between every device.
// CURRENT_USER_ID and THEME stay local (per-device session & preference).
// MEMBRES_DELETED is placed before MEMBRES so tombstones are known before
// the members list is merged during hydration.
export const SYNCED_KEYS: string[] = [
  STORAGE_KEYS.MEMBRES_DELETED,
  STORAGE_KEYS.MEMBRES,
  STORAGE_KEYS.GROUPES,
  STORAGE_KEYS.PRESENCES,
  STORAGE_KEYS.FINANCES,
  STORAGE_KEYS.COTISATIONS,
  STORAGE_KEYS.CHANSONS,
  STORAGE_KEYS.MESSAGES,
  STORAGE_KEYS.PRESENCE_ONLINE,
  STORAGE_KEYS.EVENEMENTS,
  STORAGE_KEYS.PUBLICATIONS,
  STORAGE_KEYS.CATEGORIES_RESSOURCES,
  STORAGE_KEYS.ADMIN_SETTINGS,
  STORAGE_KEYS.GROUP_READS
];
