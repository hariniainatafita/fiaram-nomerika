import type { TranslationDictionary } from '../types';

export const finance: TranslationDictionary = {
  'finance.accessDeniedTitle': { mg: 'Fidirana voarara', fr: 'Accès refusé', en: 'Access denied' },
  'finance.accessDeniedMessage': {
    mg: "Ny fitantanana ny vola dia natokana ho an'ny Chef sy ny Admin ihany.",
    fr: 'La gestion des finances est réservée aux Chefs et aux Admins uniquement.',
    en: 'Financial management is reserved for Chefs and Admins only.'
  },
  'finance.badge': { mg: 'Modely F-FINANCE', fr: 'Modèle F-FINANCE', en: 'F-FINANCE model' },
  'finance.title': {
    mg: "Fitantanana ny Vola sy Tahirin'ny Sokajy",
    fr: 'Gestion des finances et de la trésorerie des groupes',
    en: 'Financial and group treasury management'
  },
  'finance.subtitle': {
    mg: "Fidiram-bola, fandaniana ary fanarahan-dalàna ny ambim-bolan'ny sokajy tsirairay.",
    fr: 'Recettes, dépenses et suivi du solde de chaque groupe.',
    en: 'Income, expenses and balance tracking for each group.'
  },
  'finance.exportCsv': { mg: 'Hamoaka CSV', fr: 'Exporter en CSV', en: 'Export CSV' },
  'finance.addTransaction': {
    mg: 'Hampiditra Hetsika Ara-bola',
    fr: 'Ajouter une transaction',
    en: 'Add a transaction'
  },
  'finance.kpi.balance': {
    mg: 'AMBIM-BOLA ANKEHITRINY (SOLDE)',
    fr: 'SOLDE ACTUEL',
    en: 'CURRENT BALANCE'
  },
  'finance.kpi.balanceSubtitle': {
    mg: "Tahirin'ny {group}",
    fr: 'Trésorerie de {group}',
    en: 'Treasury of {group}'
  },
  'finance.kpi.income': {
    mg: 'FIDIRAM-BOLA (TOTAL ENTRÉES)',
    fr: 'RECETTES (TOTAL ENTRÉES)',
    en: 'INCOME (TOTAL RECEIPTS)'
  },
  'finance.kpi.incomeSubtitle': {
    mg: 'Latsakemboka, fanomezana, sns.',
    fr: 'Cotisations, dons, etc.',
    en: 'Contributions, donations, etc.'
  },
  'finance.kpi.expense': {
    mg: 'FANDANIANA (TOTAL SORTIES)',
    fr: 'DÉPENSES (TOTAL SORTIES)',
    en: 'EXPENSES (TOTAL OUTGOINGS)'
  },
  'finance.kpi.expenseSubtitle': {
    mg: 'Fitaovana, fotokopia, lojistika',
    fr: 'Fournitures, photocopies, logistique',
    en: 'Supplies, photocopies, logistics'
  },
  'finance.searchPlaceholder': {
    mg: "Mitady anton'asa (motif)...",
    fr: 'Rechercher un motif...',
    en: 'Search a reason...'
  },
  'finance.filter.all': { mg: 'Karazany rehetra', fr: 'Tous les types', en: 'All types' },
  'finance.filter.income': { mg: 'Fidiram-bola ihany', fr: 'Recettes uniquement', en: 'Income only' },
  'finance.filter.expense': { mg: 'Fandaniana ihany', fr: 'Dépenses uniquement', en: 'Expenses only' },
  'finance.col.motif': { mg: "ANTON'ASA (MOTIF)", fr: 'MOTIF', en: 'REASON' },
  'finance.col.balance': { mg: 'AMBINA (SOLDE)', fr: 'SOLDE', en: 'BALANCE' },
  'finance.col.responsible': {
    mg: "TOMPON'ANDRAIKITRA",
    fr: 'RESPONSABLE',
    en: 'RESPONSIBLE'
  },
  'finance.empty': {
    mg: "Tsy misy hetsika ara-bola mifanaraka amin'ny sivana.",
    fr: 'Aucune transaction financière ne correspond au filtre.',
    en: 'No financial transaction matches the filter.'
  },
  'finance.incomeBadge': { mg: 'Miditra', fr: 'Entrée', en: 'Income' },
  'finance.expenseBadge': { mg: 'Mivoaka', fr: 'Sortie', en: 'Expense' },
  'finance.manager': { mg: 'Mpitantana', fr: 'Gestionnaire', en: 'Manager' },
  'finance.addModalTitle': {
    mg: 'Hampiditra Hetsika Ara-bola ({group})',
    fr: 'Ajouter une transaction ({group})',
    en: 'Add a transaction ({group})'
  },
  'finance.txTypeLabel': { mg: "Karazan'ny Hetsika:", fr: "Type d'opération :", en: 'Transaction type:' },
  'finance.incomeButton': { mg: 'Fidiram-bola (+)', fr: 'Recette (+)', en: 'Income (+)' },
  'finance.expenseButton': { mg: 'Fandaniana (-)', fr: 'Dépense (-)', en: 'Expense (-)' },
  'finance.amountLabel': { mg: 'Vola (Ariary):', fr: 'Montant (Ariary) :', en: 'Amount (Ariary):' },
  'finance.motifLabel': { mg: "Anton'asa (Motif):", fr: 'Motif :', en: 'Reason:' },
  'finance.motifPlaceholder': {
    mg: 'oh: Fividianana fitaovam-panoratana, tsakitsaky...',
    fr: 'ex. : achat de fournitures, photocopies...',
    en: 'e.g.: purchase of stationery, photocopies...'
  },
  'finance.submit': {
    mg: "Ampidiro ao amin'ny Bokin'ny Vola",
    fr: 'Enregistrer dans le livre de caisse',
    en: 'Record in the cash book'
  },
  'finance.csv.id': { mg: 'ID', fr: 'ID', en: 'ID' },
  'finance.csv.group': { mg: 'Sokajy', fr: 'Groupe', en: 'Group' },
  'finance.csv.motif': { mg: "Anton'asa", fr: 'Motif', en: 'Reason' },
  'finance.csv.income': { mg: 'Fidiram-bola', fr: 'Recettes', en: 'Income' },
  'finance.csv.expense': { mg: 'Fandaniana', fr: 'Dépenses', en: 'Expenses' },
  'finance.csv.balance': { mg: 'Ambina (Solde)', fr: 'Solde', en: 'Balance' },
  'finance.csv.fileName': {
    mg: 'Finances_{group}_{date}.csv',
    fr: 'Finances_{group}_{date}.csv',
    en: 'Finances_{group}_{date}.csv'
  }
};
