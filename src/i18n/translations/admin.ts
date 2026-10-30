import type { TranslationDictionary } from '../types';

export const admin: TranslationDictionary = {
  'admin.accessDeniedTitle': {
    mg: 'Fidirana voarara',
    fr: 'Accès refusé',
    en: 'Access denied'
  },
  'admin.accessDeniedMessage': {
    mg: "Tsy manana alalana hiditra amin'ity panneau ity ianao.",
    fr: "Vous n'avez pas l'autorisation d'accéder à ce panneau.",
    en: 'You do not have permission to access this panel.'
  },
  'admin.roleChangeAdminOnly': {
    mg: 'Ny Admin ihany no afaka manova andraikitra.',
    fr: "Seul l'Admin peut modifier les rôles.",
    en: 'Only Admins can change roles.'
  },

  'admin.titleAdmin': {
    mg: 'Fitantanana ny Mpikambana sy ny Rafitra',
    fr: 'Gestion des membres et du système',
    en: 'Member & System Management'
  },
  'admin.titleSuperChef': {
    mg: 'Panneau Super Chef',
    fr: 'Panneau Super Chef',
    en: 'Super Chef Panel'
  },
  'admin.subtitleAdmin': {
    mg: 'Fitantanana ny mpikambana, fanamarinana dosie, fanakanana, ary fanontaniana fisoratana anarana.',
    fr: 'Gestion des membres, vérification des dossiers, blocages et questions d’inscription.',
    en: 'Manage members, file verification, blocking, and registration questions.'
  },
  'admin.subtitleSuperChef': {
    mg: 'Lisitry ny mpikambana rehetra sy ny fanaraha-maso. Ny fanovana kaonty sy ny fikirana dia Admin ihany.',
    fr: 'Liste de tous les membres et suivi. La modification des comptes et les réglages sont réservés à l’Admin.',
    en: 'List of all members and monitoring. Account changes and settings are Admin-only.'
  },

  'admin.batchBadges': {
    mg: 'Fanontana Karatra A4 (Badges A4)',
    fr: 'Impression des badges A4',
    en: 'Batch A4 Badge Printing'
  },
  'admin.addMember': {
    mg: 'Hampiditra Mpikambana Vaovao',
    fr: 'Ajouter un nouveau membre',
    en: 'Add New Member'
  },
  'admin.resetConfirm': {
    mg: 'Hamafa ny angon-drakitra rehetra tokoa ve ianao mba hanombohana tanana madio?',
    fr: 'Voulez-vous vraiment supprimer toutes les données pour repartir de zéro ?',
    en: 'Do you really want to delete all data to start fresh?'
  },
  'admin.resetTitle': {
    mg: 'Fafao ny votoaty rehetra ary manomboha indray amin’ny tanana',
    fr: 'Vider tous les contenus et recommencer manuellement',
    en: 'Clear all content and start over manually'
  },
  'admin.resetButton': {
    mg: 'Fafao ny Rehetra (Vider)',
    fr: 'Tout supprimer (Vider)',
    en: 'Delete Everything (Clear)'
  },

  'admin.totalMembers': {
    mg: "TOTALIN'NY MPIKAMBANA",
    fr: 'TOTAL DES MEMBRES',
    en: 'TOTAL MEMBERS'
  },
  'admin.activeMembers': {
    mg: '{count} mavitrika',
    fr: '{count} actif(s)',
    en: '{count} active'
  },
  'admin.dossiersKpi': {
    mg: 'DOSIE TSY VOAMARINA',
    fr: 'DOSSIERS À VÉRIFIER',
    en: 'FILES TO VERIFY'
  },
  'admin.dossiersKpiSub': {
    mg: 'Mpisoratra anarana vaovao',
    fr: 'Nouvelles inscriptions',
    en: 'New registrations'
  },
  'admin.blocked': {
    mg: 'VOASAKANA',
    fr: 'BLOQUÉS',
    en: 'BLOCKED'
  },
  'admin.blockedAccounts': {
    mg: 'Kaonty voasakana',
    fr: 'Comptes bloqués',
    en: 'Blocked accounts'
  },
  'admin.totalBalance': {
    mg: "TOTALIN'NY TAHIRIM-BOLA",
    fr: 'TRÉSORERIE TOTALE',
    en: 'TOTAL BALANCE'
  },
  'admin.consolidatedTreasury': {
    mg: "Tahiry mitambatra ao amin'ny vondrona",
    fr: 'Trésorerie consolidée du groupe',
    en: 'Consolidated group treasury'
  },

  'admin.tabMembers': {
    mg: 'Mpikambana Rehetra',
    fr: 'Tous les membres',
    en: 'All Members'
  },
  'admin.tabDossiers': {
    mg: 'Dosie Hamarina',
    fr: 'Dossiers à vérifier',
    en: 'Files to verify'
  },
  'admin.tabSettings': {
    mg: 'Fanontaniana & Fikirana',
    fr: 'Questions & réglages',
    en: 'Questions & Settings'
  },

  'admin.dossiersTitle': {
    mg: 'Dosie mbola tsy voamarina ({count})',
    fr: 'Dossiers à vérifier ({count})',
    en: 'Files to verify ({count})'
  },
  'admin.dossiersDesc': {
    mg: 'Afaka miditra avy hatrany ireo mpisoratra anarana ireo; jereo ny valinteniny dia amario hoe voamarina.',
    fr: 'Ces inscrits peuvent déjà se connecter ; vérifiez leurs réponses d’inscription, puis marquez-les vérifiés.',
    en: 'These registrants can already sign in; check their registration answers, then mark them verified.'
  },
  'admin.noDossiers': {
    mg: 'Tsy misy dosie hamarina ankehitriny.',
    fr: 'Aucun dossier à vérifier pour le moment.',
    en: 'No files to verify at the moment.'
  },
  'admin.noPhone': {
    mg: 'Tsy misy finday',
    fr: 'Aucun téléphone',
    en: 'No phone'
  },
  'admin.codeAndDate': {
    mg: 'Kaody: {code} • Nosoratana: {date}',
    fr: 'Code : {code} • Inscrit le : {date}',
    en: 'Code: {code} • Registered: {date}'
  },
  'admin.registrationAnswers': {
    mg: "Valinteny amin'ny fanontaniana:",
    fr: 'Réponses aux questions :',
    en: 'Answers to questions:'
  },
  'admin.verify': {
    mg: 'Voamarina',
    fr: 'Marquer vérifié',
    en: 'Mark verified'
  },
  'admin.reject': {
    mg: 'Lavina',
    fr: 'Rejeter',
    en: 'Reject'
  },
  'admin.dossierToVerifyBadge': {
    mg: 'Dosie hamarina',
    fr: 'Dossier à vérifier',
    en: 'File to verify'
  },
  'admin.dossierVerifiedBadge': {
    mg: 'Dosie voamarina',
    fr: 'Dossier vérifié',
    en: 'File verified'
  },

  'admin.registrationQuestionsTitle': {
    mg: "Fanontaniana ho an'ny Fisoratana Anarana",
    fr: 'Questions d’inscription',
    en: 'Registration Questions'
  },
  'admin.registrationQuestionsDesc': {
    mg: "Ireto fanontaniana ireto dia hiseho rehefa misy olona mamorona kaonty vaovao. Ny valinteniny dia hiseho eo amin'ny dossier-ny.",
    fr: 'Ces questions apparaissent lorsqu’une personne crée un nouveau compte. Ses réponses sont affichées dans son dossier.',
    en: 'These questions appear when someone creates a new account. Their answers are shown in their file.'
  },
  'admin.superChefPermissionsTitle': {
    mg: "Alalana ho an'ny Super Chef",
    fr: 'Autorisations du Super Chef',
    en: 'Super Chef Permissions'
  },
  'admin.superChefPermissionsDesc': {
    mg: "Safidio izay azon'ny Super Chef atao. Ny fanovana andraikitra, fananganana kaonty ary fikirana ankapobeny dia mijanona ho an'ny Admin.",
    fr: 'Choisissez ce que le Super Chef peut faire. Le changement de rôle, la création de comptes et les réglages généraux restent réservés à l’Admin.',
    en: 'Choose what the Super Chef can do. Role changes, account creation, and general settings remain Admin-only.'
  },
  'admin.permissionViewAllMembers': {
    mg: 'Hijery ny mpikambana rehetra',
    fr: 'Voir tous les membres',
    en: 'View all members'
  },
  'admin.permissionManageGroups': {
    mg: 'Hitantana sokajy sy mpikambana',
    fr: 'Gérer les groupes et les membres',
    en: 'Manage groups and members'
  },
  'admin.permissionManageChefs': {
    mg: 'Hanendry Chef de Groupe',
    fr: 'Nommer les chefs de groupe',
    en: 'Assign group leaders'
  },
  'admin.permissionValidatePresences': {
    mg: 'Hanamarina fahatongavana',
    fr: 'Valider les présences',
    en: 'Validate attendance'
  },
  'admin.permissionViewGlobalFinance': {
    mg: 'Hijery ny vola sy tahiry',
    fr: 'Voir les finances et la trésorerie',
    en: 'View finances and treasury'
  },
  'admin.permissionManageCotisations': {
    mg: 'Handray latsakemboka',
    fr: 'Gérer les cotisations',
    en: 'Manage contributions'
  },
  'admin.requiredObligatory': {
    mg: 'Takiana (obligatoire)',
    fr: 'Obligatoire',
    en: 'Required'
  },
  'admin.optionalFacultative': {
    mg: 'Tsy voatery (facultatif)',
    fr: 'Facultatif',
    en: 'Optional'
  },
  'admin.addQuestionTitle': {
    mg: 'Hanampy fanontaniana vaovao:',
    fr: 'Ajouter une nouvelle question :',
    en: 'Add a new question:'
  },
  'admin.questionPlaceholder': {
    mg: "ohatra: Inona no traikefa azonao entina ho an'ny vondrona?",
    fr: 'Ex. : Quelle expérience pouvez-vous apporter au groupe ?',
    en: 'E.g.: What experience can you bring to the group?'
  },
  'admin.requiredLabel': {
    mg: 'Takiana',
    fr: 'Obligatoire',
    en: 'Required'
  },

  'admin.membersListTitle': {
    mg: 'Lisitry ny Mpikambana Rehetra ({count})',
    fr: 'Liste de tous les membres ({count})',
    en: 'All Members List ({count})'
  },
  'admin.searchPlaceholder': {
    mg: 'Mitady anarana na kaody...',
    fr: 'Rechercher un nom ou un code...',
    en: 'Search a name or code...'
  },
  'admin.allRoles': {
    mg: 'Andraikitra rehetra',
    fr: 'Tous les rôles',
    en: 'All roles'
  },
  'admin.colMember': {
    mg: 'MPIKAMBANA',
    fr: 'MEMBRE',
    en: 'MEMBER'
  },
  'admin.colCode': {
    mg: 'KAODY',
    fr: 'CODE',
    en: 'CODE'
  },
  'admin.colUsernameEmail': {
    mg: 'SOLONANARANA / MAILAKA',
    fr: 'NOM D’UTILISATEUR / EMAIL',
    en: 'USERNAME / EMAIL'
  },
  'admin.colRole': {
    mg: 'ANDRAIKITRA',
    fr: 'RÔLE',
    en: 'ROLE'
  },
  'admin.colStatus': {
    mg: 'SATA',
    fr: 'STATUT',
    en: 'STATUS'
  },
  'admin.colActions': {
    mg: 'HETSIKA',
    fr: 'ACTIONS',
    en: 'ACTIONS'
  },
  'admin.fieldBalance': {
    mg: 'Solde',
    fr: 'Solde',
    en: 'Balance'
  },
  'admin.viewFileTitle': {
    mg: 'Hijery ny dosie',
    fr: 'Voir le dossier',
    en: 'View file'
  },
  'admin.badgeGeneratedTitle': {
    mg: 'Karatra efa voatonta (Jereo)',
    fr: 'Badge déjà généré (Voir)',
    en: 'Badge already generated (View)'
  },
  'admin.badgeTitle': {
    mg: 'Karatra (Badge)',
    fr: 'Badge',
    en: 'Badge'
  },
  'admin.unblockTitle': {
    mg: 'Vahao',
    fr: 'Débloquer',
    en: 'Unblock'
  },
  'admin.blockTitle': {
    mg: 'Sakano',
    fr: 'Bloquer',
    en: 'Block'
  },
  'admin.actionDeactivate': {
    mg: 'Vonoy',
    fr: 'Désactiver',
    en: 'Off'
  },
  'admin.actionActivate': {
    mg: 'Velomy',
    fr: 'Activer',
    en: 'On'
  },
  'admin.deleteTitle': {
    mg: 'Fafao',
    fr: 'Supprimer',
    en: 'Delete'
  },

  'admin.dossierTitle': {
    mg: 'Dosie Manokana',
    fr: 'Dossier personnel',
    en: 'Personal File'
  },
  'admin.blockedUpper': {
    mg: 'VOASAKANA',
    fr: 'BLOQUÉ',
    en: 'BLOCKED'
  },
  'admin.fieldUsername': {
    mg: 'Solonanarana',
    fr: 'Nom d’utilisateur',
    en: 'Username'
  },
  'admin.fieldEmail': {
    mg: 'Mailaka',
    fr: 'Email',
    en: 'Email'
  },
  'admin.fieldPhone': {
    mg: 'Finday',
    fr: 'Téléphone',
    en: 'Phone'
  },
  'admin.fieldCin': {
    mg: 'CIN',
    fr: 'CIN',
    en: 'CIN'
  },
  'admin.fieldJob': {
    mg: 'Asa',
    fr: 'Profession',
    en: 'Occupation'
  },
  'admin.fieldRegistered': {
    mg: 'Nosoratana',
    fr: 'Inscrit le',
    en: 'Registered'
  },
  'admin.fieldGroup': {
    mg: 'Sokajy',
    fr: 'Groupe',
    en: 'Group'
  },
  'admin.registrationAnswersDossier': {
    mg: "Valinteny tamin'ny fisoratana anarana",
    fr: 'Réponses à l’inscription',
    en: 'Registration answers'
  },

  'admin.confirmReject': {
    mg: "Tena hanala ny fisoratana anaran'i {name} tokoa ve ianao?",
    fr: 'Voulez-vous vraiment supprimer l’inscription de {name} ?',
    en: 'Do you really want to delete the registration of {name}?'
  },
  'admin.confirmBlock': {
    mg: "Tena hanasakana ny kaontin'i {name} tokoa ve ianao?",
    fr: 'Voulez-vous vraiment bloquer le compte de {name} ?',
    en: 'Do you really want to block the account of {name}?'
  },
  'admin.confirmDelete': {
    mg: "FAFAO TANTERAKA: Tena hamafa ny kaontin'i {name} tokoa ve ianao? Tsy azo averina intsony izany.",
    fr: 'SUPPRESSION DÉFINITIVE : Voulez-vous vraiment supprimer le compte de {name} ? Cette action est irréversible.',
    en: 'PERMANENT DELETE: Do you really want to delete the account of {name}? This cannot be undone.'
  },
  'admin.confirmationTitle': {
    mg: 'Fanamarinana',
    fr: 'Confirmation',
    en: 'Confirmation'
  },
  'admin.confirmYes': {
    mg: 'Eny, Ekena',
    fr: 'Oui, confirmer',
    en: 'Yes, confirm'
  },

  'admin.firstNameLabel': {
    mg: "Fanampin'anarana (Prénom):",
    fr: 'Prénom :',
    en: 'First name:'
  },
  'admin.lastNameLabel': {
    mg: 'Anarana (Nom):',
    fr: 'Nom :',
    en: 'Last name:'
  },
  'admin.usernameLabel': {
    mg: 'Solonanarana (Username):',
    fr: 'Nom d’utilisateur :',
    en: 'Username:'
  },
  'admin.passwordLabel': {
    mg: 'Tenimiafina (Mot de passe):',
    fr: 'Mot de passe :',
    en: 'Password:'
  },
  'admin.emailLabel': {
    mg: 'Adiresy Mailaka (Email):',
    fr: 'Adresse email :',
    en: 'Email address:'
  },
  'admin.phoneLabel': {
    mg: 'Finday:',
    fr: 'Téléphone :',
    en: 'Phone:'
  },
  'admin.groupVoiceLabel': {
    mg: 'Sokajy / Feo:',
    fr: 'Groupe / Voix :',
    en: 'Group / Voice:'
  },
  'admin.roleLabel': {
    mg: 'Andraikitra (Rôle):',
    fr: 'Rôle :',
    en: 'Role:'
  },
  'admin.firstNamePlaceholder': {
    mg: 'oh: Hasina...',
    fr: 'ex. : Hasina...',
    en: 'e.g.: Hasina...'
  },
  'admin.lastNamePlaceholder': {
    mg: 'oh: RAZAFY...',
    fr: 'ex. : RAZAFY...',
    en: 'e.g.: RAZAFY...'
  },
  'admin.usernamePlaceholder': {
    mg: 'oh: hasina...',
    fr: 'ex. : hasina...',
    en: 'e.g.: hasina...'
  },
  'admin.passwordPlaceholder': {
    mg: 'oh: 123456...',
    fr: 'ex. : 123456...',
    en: 'e.g.: 123456...'
  },
  'admin.emailPlaceholder': {
    mg: 'oh: hasina@fiaram.mg',
    fr: 'ex. : hasina@fiaram.mg',
    en: 'e.g.: hasina@fiaram.mg'
  },
  'admin.phonePlaceholder': {
    mg: 'oh: +261 34 00 000 00',
    fr: 'ex. : +261 34 00 000 00',
    en: 'e.g.: +261 34 00 000 00'
  },
  'admin.addAndGenerateBadge': {
    mg: 'Ampidiro & Hamorona Karatra (Badge)',
    fr: 'Ajouter et générer le badge',
    en: 'Add & Generate Badge'
  }
};
