import { Membre, Groupe, Presence, FinanceGroupe, Cotisation, Chanson, Message, Evenement, Publication } from '../types';

export const INITIAL_MEMBRES: Membre[] = [
  {
    id: 'm_admin',
    nom: 'RAKOTOARISOA',
    prenom: 'Jean',
    username: 'admin',
    email: 'admin@fiaram.mg',
    password: 'admin',
    role: 'admin',
    is_active: true,
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    code_unique: 'GRP-ADM-001',
    numero_badge: '001',
    cin: '101 234 015 678',
    profession: 'ADMINISTRATEUR',
    telephone: '+261 34 00 000 01',
    solde: 0,
    theme: 'dark',
    fingerprint_registered: true,
    derniere_connexion: '',
    created_at: '2026-01-01'
  },
  {
    id: 'm_tafita',
    nom: 'RANDRIAMANANTSOA',
    prenom: 'Tafita Hariniaina',
    username: 'tafita',
    email: 'tafita@fiaram.mg',
    password: 'admin',
    role: 'super_chef',
    is_active: true,
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    code_unique: 'GRP-MBR-007',
    numero_badge: '007',
    cin: '117 431 010 933',
    profession: 'SUPERVISEUR',
    telephone: '+261 34 11 222 33',
    groupe_id: 'g2',
    solde: 5000,
    theme: 'dark',
    fingerprint_registered: true,
    derniere_connexion: '',
    created_at: '2026-01-01'
  }
];

export const INITIAL_GROUPES: Groupe[] = [
  {
    id: 'g1',
    nom_groupe: 'Direction',
    description: 'Coordination générale et décisions stratégiques du groupe',
    chef_id: 'm_admin',
    solde: 0,
    created_at: '2026-01-01'
  },
  {
    id: 'g2',
    nom_groupe: 'Administration',
    description: 'Gestion des membres, des présences et des cotisations',
    chef_id: 'm_admin',
    solde: 0,
    created_at: '2026-01-01'
  },
  {
    id: 'g3',
    nom_groupe: 'Commission activités',
    description: 'Organisation des activités, réunions et événements',
    chef_id: 'm_admin',
    solde: 0,
    created_at: '2026-01-01'
  },
  {
    id: 'g4',
    nom_groupe: 'Communication',
    description: 'Information, communication interne et communication externe',
    chef_id: 'm_admin',
    solde: 0,
    created_at: '2026-01-01'
  },
  {
    id: 'g5',
    nom_groupe: 'Support & logistique',
    description: 'Matériel, logistique et appui aux activités du groupe',
    chef_id: 'm_admin',
    solde: 0,
    created_at: '2026-01-01'
  }
];

export const INITIAL_PRESENCES: Presence[] = [];

export const INITIAL_FINANCES: FinanceGroupe[] = [];

export const INITIAL_COTISATIONS: Cotisation[] = [];

export const INITIAL_CHANSONS: Chanson[] = [
  {
    id: 's1',
    titre: 'Charte du groupe',
    auteur: 'Direction générale',
    compositeur: 'Bureau exécutif',
    categorie_id: 'cat_doc',
    paroles: `Article 1 — Objet
La présente charte définit les règles de fonctionnement, les valeurs et les engagements communs des membres du groupe.

Article 2 — Engagement
Chaque membre s'engage à respecter les décisions collectives, à participer aux activités et à contribuer au bon fonctionnement du groupe.

Article 3 — Respect
Les échanges doivent rester respectueux, inclusifs et constructifs. Toute forme de discrimination est exclue.`,
    fichier_pdf: '/docs/charte_du_groupe.pdf',
    vues: 0,
    is_active: true,
    is_favori: false,
    created_at: '2026-01-01'
  },
  {
    id: 's2',
    titre: 'Guide du nouveau membre',
    auteur: 'Commission accueil',
    compositeur: 'Administration',
    categorie_id: 'cat_formation',
    paroles: `Bienvenue dans le groupe.

1. Présentez-vous auprès de votre responsable de groupe.
2. Consultez le calendrier des activités et des réunions.
3. Vérifiez vos informations de profil et votre code membre.
4. Contactez l'administration pour toute question sur les cotisations ou les badges.`,
    fichier_pdf: '/docs/guide_nouveau_membre.pdf',
    vues: 0,
    is_active: true,
    is_favori: false,
    created_at: '2026-01-01'
  }
];

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_EVENEMENTS: Evenement[] = [
  {
    id: 'ev1',
    nom: 'AssemblAce gAcnAcrale 2026',
    notes: 'Rencontre annuelle des membres : bilan des activitAcs, orientation et Acchanges ouverts.',
    objectif_financier: 3000000,
    collecte_actuelle: 0,
    is_pinned: true,
    image_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600',
    date_evenement: '2026-12-20 15:00',
    vues: 0
  }
];

export const INITIAL_PUBLICATIONS: Publication[] = [
  {
    id: 'pub_1',
    auteur_id: 'm_admin',
    contenu: "Bienvenue dans notre espace de publications. Partagez les moments forts, les annonces et les photos de la vie du groupe.",
    image_url: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80&auto=format&fit=crop',
    created_at: '2026-10-29T07:30:00.000Z',
    liked_by: ['m_tafita'],
    commentaires: [
      {
        id: 'pc_1',
        publication_id: 'pub_1',
        auteur_id: 'm_tafita',
        contenu: 'Excellente initiative. Hâte de voir les prochaines publications.',
        created_at: '2026-10-29T08:05:00.000Z'
      }
    ],
    partages: 2
  },
  {
    id: 'pub_2',
    auteur_id: 'm_tafita',
    contenu: "Retour sur notre dernière rencontre de coordination. Merci à toutes les équipes pour leur implication et leur énergie.",
    image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop',
    created_at: '2026-10-28T16:45:00.000Z',
    liked_by: ['m_admin', 'm_tafita'],
    commentaires: [],
    partages: 4
  },
  {
    id: 'pub_3',
    auteur_id: 'm_admin',
    contenu: "Les informations pratiques et les prochains rendez-vous du groupe sont disponibles dans la rubrique Événements. Pensez à consulter régulièrement le fil.",
    created_at: '2026-10-27T10:20:00.000Z',
    liked_by: ['m_tafita'],
    commentaires: [
      {
        id: 'pc_2',
        publication_id: 'pub_3',
        auteur_id: 'm_tafita',
        contenu: 'Bien noté, je partage avec mon équipe.',
        created_at: '2026-10-27T11:00:00.000Z'
      }
    ],
    partages: 1
  },
  {
    id: 'pub_4',
    auteur_id: 'm_tafita',
    contenu: "Un grand merci aux membres présents lors de l'activité de la semaine. Chaque contribution fait avancer le collectif.",
    image_url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1200&q=80&auto=format&fit=crop',
    created_at: '2026-10-25T14:05:00.000Z',
    liked_by: ['m_admin'],
    commentaires: [],
    partages: 0
  }
];
