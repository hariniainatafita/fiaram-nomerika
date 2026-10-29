import type { TranslationDictionary } from '../types';

export const settings: TranslationDictionary = {
  'settings.accessDeniedTitle': {
    mg: 'Fikirana voafetra',
    fr: 'Paramètres restreints',
    en: 'Restricted settings'
  },
  'settings.accessDeniedDescription': {
    mg: "Ny Admin ihany no afaka manova ny fikirana ankapoben'ny rafitra.",
    fr: "Seul l'Admin peut modifier les paramètres généraux de la plateforme.",
    en: "Only the Admin can change the platform's general settings."
  },
  'settings.title': {
    mg: 'Fikirana & Paramètres azo ovaina',
    fr: 'Paramètres modifiables',
    en: 'Editable settings'
  },
  'settings.subtitle': {
    mg: "Paramètres ankapoben'ny sehatra sy ny vondrona",
    fr: 'Paramètres généraux de la plateforme et du groupe',
    en: 'General platform and group settings'
  },
  'settings.category.general': {
    mg: 'Ankapobeny',
    fr: 'Général',
    en: 'General'
  },
  'settings.category.cotisations': {
    mg: 'Latsakemboka',
    fr: 'Cotisations',
    en: 'Contributions'
  },
  'settings.category.questions': {
    mg: 'Fisoratana anarana',
    fr: "Questions d'inscription",
    en: 'Registration questions'
  },
  'settings.category.badges': {
    mg: 'Karatra',
    fr: 'Badges',
    en: 'Badges'
  },
  'settings.category.system': {
    mg: 'Rafitra & Feo',
    fr: 'Système & Son',
    en: 'System & Sound'
  },
  'settings.savedSuccess': {
    mg: 'Voatahiry soa aman-tsara ny fanovana nataonao!',
    fr: 'Vos modifications ont été enregistrées avec succès !',
    en: 'Your changes have been saved successfully!'
  },
  'settings.general.title': {
    mg: 'Mombamomba ny vondrona',
    fr: 'Informations du groupe',
    en: 'Group information'
  },
  'settings.general.groupName': {
    mg: "Anaran'ny vondrona",
    fr: 'Nom du groupe',
    en: 'Group name'
  },
  'settings.general.acronym': {
    mg: 'Fanafohezana (Sigle)',
    fr: 'Sigle',
    en: 'Acronym'
  },
  'settings.general.currency': {
    mg: 'Vola ampiasaina (Devise)',
    fr: 'Devise',
    en: 'Currency'
  },
  'settings.general.allowRegistration': {
    mg: 'Avela hisoratra anarana mivantana ny mpikambana vaovao (Inscription ouverte)',
    fr: "Autoriser l'inscription directe des nouveaux membres (inscription ouverte)",
    en: 'Allow new members to register directly (open registration)'
  },
  'settings.general.allowRegistrationHint': {
    mg: "Mila fankatoavana avy amin'ny Admin foana izy ireo alohan'ny hahafahana miditra.",
    fr: "Ils doivent toujours être approuvés par l'Admin avant de pouvoir se connecter.",
    en: 'They must always be approved by the Admin before they can log in.'
  },
  'settings.cotisations.title': {
    mg: "Saran'ny latsakemboka",
    fr: 'Taux des cotisations',
    en: 'Contribution rates'
  },
  'settings.cotisations.monthlyDefault': {
    mg: 'Latsakemboka isam-bolana fototra',
    fr: 'Cotisation mensuelle par défaut',
    en: 'Default monthly contribution'
  },
  'settings.cotisations.dailyDefault': {
    mg: "Latsakemboka isan'andro fototra",
    fr: 'Cotisation journalière par défaut',
    en: 'Default daily contribution'
  },
  'settings.cotisations.hint': {
    mg: "💡 Ireo sanda ireo no hiseho avy hatrany rehefa manao fandoavana latsakemboka ny Chef na ny Admin.",
    fr: "💡 Ces valeurs s'affichent automatiquement lorsque le Chef ou l'Admin effectue un paiement de cotisation.",
    en: '💡 These values appear automatically when the Chef or Admin makes a contribution payment.'
  },
  'settings.questions.title': {
    mg: 'Fanontaniana fisoratana anarana ({count})',
    fr: "Questions d'inscription ({count})",
    en: 'Registration questions ({count})'
  },
  'settings.questions.description': {
    mg: "Ireo fanontaniana tsy maintsy valian'ny mpikambana vaovao rehefa misoratra anarana.",
    fr: "Questions auxquelles les nouveaux membres doivent répondre lors de leur inscription.",
    en: 'Questions new members must answer when registering.'
  },
  'settings.questions.placeholder': {
    mg: 'Ampidiro eto ny fanontaniana vaovao...',
    fr: 'Saisissez la nouvelle question ici...',
    en: 'Enter the new question here...'
  },
  'settings.questions.required': {
    mg: 'Tsy maintsy (Obligatoire)',
    fr: 'Obligatoire',
    en: 'Required'
  },
  'settings.questions.requiredBadge': {
    mg: 'Tsy maintsy',
    fr: 'Obligatoire',
    en: 'Required'
  },
  'settings.questions.deleteTitle': {
    mg: 'Fafao ity fanontaniana ity',
    fr: 'Supprimer cette question',
    en: 'Delete this question'
  },
  'settings.badges.title': {
    mg: 'Fikirana ny karatra (Badges)',
    fr: 'Paramètres des badges',
    en: 'Badge settings'
  },
  'settings.badges.headerTitle': {
    mg: "Soratra ambony amin'ny karatra (Titre de l'en-tête du badge)",
    fr: "Titre de l'en-tête du badge",
    en: 'Badge header title'
  },
  'settings.badges.info': {
    mg: 'Misy modely karatra dimy azo ampiasaina (Classique, Moderne, Prestige, Techno, Minimal). Azo ovaina foana ny loko rehefa mamorona.',
    fr: "Cinq modèles de badge sont disponibles (Classique, Moderne, Prestige, Techno, Minimal). Les couleurs restent personnalisables lors de la génération.",
    en: 'Five badge templates are available (Classic, Modern, Prestige, Techno, Minimal). Colors remain customizable when generating.'
  },
  'settings.system.title': {
    mg: 'Rafitra & Feo',
    fr: 'Système & Son',
    en: 'System & Sound'
  },
  'settings.system.soundEffects': {
    mg: 'Ampandehano ny feo rehefa manao scan QR sy fandoavana vola (Effets sonores)',
    fr: 'Activer les effets sonores lors du scan QR et des paiements',
    en: 'Enable sound effects for QR scanning and payments'
  },
  'settings.system.dangerTitle': {
    mg: 'Famerenana ho madio (Zone de danger)',
    fr: 'Zone de danger',
    en: 'Danger zone'
  },
  'settings.system.dangerDescription': {
    mg: 'Fafao ny angon-drakitra voatahiry rehetra raha hanomboka tanana madio tanteraka.',
    fr: 'Supprimez toutes les données enregistrées pour repartir de zéro.',
    en: 'Delete all stored data to start completely from scratch.'
  },
  'settings.system.resetConfirm': {
    mg: 'Hamafa ny angon-drakitra rehetra tokoa ve ianao? Tsy azo averina intsony izany.',
    fr: 'Voulez-vous vraiment supprimer toutes les données ? Cette action est irréversible.',
    en: 'Are you sure you want to delete all data? This cannot be undone.'
  },
  'settings.system.resetButton': {
    mg: 'Fafao ny angon-drakitra rehetra (Reset Clean)',
    fr: 'Supprimer toutes les données (réinitialisation complète)',
    en: 'Delete all data (full reset)'
  },
  'settings.saveChanges': {
    mg: 'Tehirizo ny fanovana',
    fr: 'Enregistrer les modifications',
    en: 'Save changes'
  }
};
