export const STORAGE_KEYS = {
  DATA_VERSION: 'fiaram_v2_clean',
  CURRENT_USER_ID: 'fiaram_current_user_id',
  THEME: 'fiaram_theme',
  MEMBRES: 'fiaram_membres_v2',
  GROUPES: 'fiaram_groupes_v2',
  PRESENCES: 'fiaram_presences_v2',
  FINANCES: 'fiaram_finances_v2',
  COTISATIONS: 'fiaram_cotisations_v2',
  CHANSONS: 'fiaram_chansons_v2',
  MESSAGES: 'fiaram_messages_v2',
  EVENEMENTS: 'fiaram_evenements_v2',
  PUBLICATIONS: 'fiaram_publications_v1',
  CATEGORIES_RESSOURCES: 'fiaram_ressource_categories_v1',
  ADMIN_SETTINGS: 'fiaram_admin_settings_v2'
};

// Keys that must be shared/synchronised between every device.
// CURRENT_USER_ID and THEME stay local (per-device session & preference).
export const SYNCED_KEYS: string[] = [
  STORAGE_KEYS.MEMBRES,
  STORAGE_KEYS.GROUPES,
  STORAGE_KEYS.PRESENCES,
  STORAGE_KEYS.FINANCES,
  STORAGE_KEYS.COTISATIONS,
  STORAGE_KEYS.CHANSONS,
  STORAGE_KEYS.MESSAGES,
  STORAGE_KEYS.EVENEMENTS,
  STORAGE_KEYS.PUBLICATIONS,
  STORAGE_KEYS.CATEGORIES_RESSOURCES,
  STORAGE_KEYS.ADMIN_SETTINGS
];
