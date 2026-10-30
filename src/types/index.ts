// ==================== ROLES ====================
export type Role = 'membre' | 'chef' | 'super_chef' | 'admin';

// ==================== UTILISATEUR ====================
export interface Membre {
  id: string;
  nom: string;
  prenom: string;
  username?: string;
  email: string;
  password?: string;
  role: Role;
  is_active: boolean;
  is_approved?: boolean;      // True: account is registered and usable
  dossier_verified?: boolean; // Admin reviewed the registration file
  is_blocked?: boolean;       // Admin can block an account
  photo_url?: string;
  code_unique: string;
  telephone?: string;
  solde: number;
  theme: 'light' | 'dark';
  fingerprint_registered: boolean;
  groupe_id?: string;
  derniere_connexion?: string;
  created_at: string;
  groupe?: Groupe;
  cin?: string;
  profession?: string;
  numero_badge?: string;
  registration_answers?: { question: string; answer: string }[];
  badge_style?: BadgeStyle;
  badge_colors?: BadgeColors;
  badge_generated?: boolean;
}

// ==================== BADGE STYLES ====================
export type BadgeStyle = 'gold_royal' | 'modern_emerald' | 'crimson_prestige' | 'ocean_cyber' | 'minimal_dark';

export interface BadgeColors {
  primary: string;
  accent: string;
  background: string;
  text: string;
}

// ==================== QUESTIONS INSCRIPTION ====================
export interface RegistrationQuestion {
  id: string;
  question: string;
  required: boolean;
}

// ==================== SUPER CHEF PERMISSIONS ====================
export interface SuperChefPermissions {
  view_all_members: boolean;
  manage_groups: boolean;
  manage_chefs: boolean;
  validate_presences: boolean;
  view_global_finance: boolean;
  manage_cotisations: boolean;
}

// ==================== APP & ADMIN SETTINGS ====================
export interface AppSettings {
  chorale_nom: string;
  chorale_sigle: string;
  cotisation_mensuelle_defaut: number;
  cotisation_journaliere_defaut: number;
  devise: string;
  registration_questions: RegistrationQuestion[];
  allow_self_registration: boolean;
  theme_default: 'dark' | 'light';
  notifications_sonores: boolean;
  titre_badge_defaut: string;
  super_chef_permissions: SuperChefPermissions;
}

export type AdminSettings = AppSettings;

// ==================== GROUPE ====================
export interface Groupe {
  id: string;
  nom_groupe: string;
  description?: string;
  chef_id: string;
  chef?: Membre;
  membres?: Membre[];
  solde?: number;
  created_at: string;
}

export interface GroupeMembre {
  id: string;
  groupe_id: string;
  membre_id: string;
  role: string;
  date_ajout: string;
  membre?: Membre;
}

// ==================== PRESENCE ====================
export type StatutPresence = 'present' | 'retard' | 'absent';
export type MethodePresence = 'qr_code' | 'empreinte' | 'manuel';

export interface Presence {
  id: string;
  membre_id: string;
  membre?: Membre;
  date_pointage: string;
  statut: StatutPresence;
  methode: MethodePresence;
}

// ==================== FINANCE ====================
export interface FinanceGroupe {
  id: string;
  groupe_id: string;
  membre_action_id: string;
  membre_action?: Membre;
  date_operation: string;
  motif: string;
  argent_entree: number;
  argent_sortie: number;
  reste: number;
}

// ==================== COTISATION ====================
export type TypeCotisation = 'mensuel' | 'journalier' | 'special';

export interface Cotisation {
  id: string;
  membre_id: string;
  membre?: Membre;
  montant: number;
  type_cotisation?: TypeCotisation; // 'mensuel' | 'journalier' | 'special'
  mois?: string;
  annee?: string;
  date_jour?: string;               // YYYY-MM-DD ho an'ny latsakemboka isan'andro
  motif?: string;                   // Antony na anaran'ny hetsika (ohatra: Latsakemboka Andavanandro)
  methode: string;
  reference?: string;
  date_paiement: string;
  statut: string;
}

// ==================== CHANSON ====================
export interface CategorieChanson {
  id: string;
  nom: string;
  couleur?: string;
}

export interface Chanson {
  id: string;
  titre: string;
  auteur?: string;
  compositeur?: string;
  paroles?: string;
  categorie_id?: string;
  categorie?: CategorieChanson;
  fichier_pdf?: string;
  fichier_audio?: string;
  lien_youtube?: string;
  vues: number;
  is_active: boolean;
  is_favori?: boolean;
  created_at: string;
}

// ==================== MESSAGE ====================
export interface Message {
  id: string;
  sender_id: string;
  sender?: Membre;
  receiver_id?: string;
  group_id?: string;
  message?: string;
  image_url?: string;
  audio_url?: string;
  file_url?: string;
  file_name?: string;
  file_type?: 'image' | 'audio' | 'document';
  status: 'sent' | 'read';
  is_deleted: boolean;
  is_edited: boolean;
  sent_at: string;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  nom?: string;
  avatar?: string;
  dernierMessage?: Message;
  nonLus: number;
  membre?: Membre;
  groupe?: Groupe;
}

// ==================== PUBLICATION ====================
export interface PublicationComment {
  id: string;
  publication_id: string;
  auteur_id: string;
  contenu: string;
  created_at: string;
}

export interface Publication {
  id: string;
  auteur_id: string;
  contenu: string;
  image_url?: string;
  audience?: 'all' | 'group';
  groupe_id?: string;
  created_at: string;
  liked_by: string[];
  commentaires: PublicationComment[];
  partages: number;
}

// ==================== EVENEMENT ====================
export interface Evenement {
  id: string;
  nom: string;
  notes?: string;
  groupe_id?: string;
  objectif_financier: number;
  collecte_actuelle: number;
  is_pinned: boolean;
  image_url?: string;
  date_evenement?: string;
  vues: number;
}

// ==================== AUTH ====================
export interface AuthState {
  membre: Membre | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ==================== STATS ====================
export interface StatsDashboard {
  totalPresent: number;
  totalRetard: number;
  totalAbsent: number;
  solde: number;
  cotisationsMois: number;
  messagesNonLus: number;
  prochainEvenement?: Evenement;
}
