import type { TranslationDictionary } from '../types';

export const cotisations: TranslationDictionary = {
  'cotisations.title': {
    mg: 'Fitantanana ny Latsakemboka (Cotisations)',
    fr: 'Gestion des cotisations',
    en: 'Contribution management'
  },
  'cotisations.subtitle': {
    mg: "Fandoavana latsakemboka isam-bolana (Mensuel) na isan'andro (Journalier / Andohan'andro).",
    fr: 'Paiement des cotisations mensuelles ou journalières (Andohan’andro).',
    en: 'Payment of monthly or daily contributions (Andohan’andro).'
  },
  'cotisations.warning.title': { mg: 'Fampahafantarana:', fr: 'Information :', en: 'Notice:' },
  'cotisations.warning.body1': {
    mg: "Tsy afaka mampiditra na manao fandoavam-bola avy amin'ny kaontinao ianao. Ny",
    fr: "Vous ne pouvez pas saisir ni effectuer de paiement depuis votre compte. Seuls le",
    en: 'You cannot enter or make a payment from your account. Only the'
  },
  'cotisations.warning.roles': { mg: 'Chef na ny Admin', fr: "Chef ou l'Admin", en: 'Chef or Admin' },
  'cotisations.warning.body2': {
    mg: "ihany no afaka mandray sy manamarina ny latsakembokao. Eto ambany dia azonao jerena sy atonta (imprimer) ny reçun'ireo latsakemboka efa voaloanao.",
    fr: 'peuvent recevoir et valider votre cotisation. Ci-dessous, vous pouvez consulter et imprimer les reçus de vos cotisations déjà payées.',
    en: 'can receive and validate your contribution. Below, you can view and print the receipts for your contributions already paid.'
  },
  'cotisations.managerSelectLabel': {
    mg: 'Mpitantana (Admin / Chef) — Safidio ny mpikambana handray vola:',
    fr: 'Gestionnaire (Admin / Chef) — Sélectionnez le membre à créditer :',
    en: 'Manager (Admin / Chef) — Select the member to credit:'
  },
  'cotisations.memberCodeCategory': {
    mg: 'Kaody: {code} • Sokajy: {role}',
    fr: 'Code : {code} • Catégorie : {role}',
    en: 'Code: {code} • Category: {role}'
  },
  'cotisations.totalPaidAll': { mg: 'TOTALY VOALOA REHETRA', fr: 'TOTAL VERSÉ', en: 'TOTAL PAID' },
  'cotisations.monthlyTotal': { mg: 'ISAM-BOLANA', fr: 'MENSUEL', en: 'MONTHLY' },
  'cotisations.dailyTotal': { mg: "ISAN'ANDRO (JOURNALIER)", fr: 'JOURNALIER', en: 'DAILY' },
  'cotisations.paymentTitle': {
    mg: 'Fandoavana Latsakemboka',
    fr: 'Paiement de cotisation',
    en: 'Contribution payment'
  },
  'cotisations.paymentSubtitle': {
    mg: 'Fanamarihana fandoavana vaovao',
    fr: 'Nouvel enregistrement de paiement',
    en: 'New payment record'
  },
  'cotisations.typeMonthly': { mg: 'Isam-bolana (Mensuel)', fr: 'Mensuel', en: 'Monthly' },
  'cotisations.typeDaily': { mg: "Isan'andro (Journalier)", fr: 'Journalier', en: 'Daily' },
  'cotisations.amountLabel': { mg: 'Vola Alatsaka (Ariary):', fr: 'Montant à verser (Ariary) :', en: 'Amount to pay (Ariary):' },
  'cotisations.monthLabel': { mg: 'Volana:', fr: 'Mois :', en: 'Month:' },
  'cotisations.yearLabel': { mg: 'Taona:', fr: 'Année :', en: 'Year:' },
  'cotisations.dayDateLabel': { mg: "Daty Isan'andro (Date du jour):", fr: 'Date du jour :', en: 'Date:' },
  'cotisations.dayDateHint': {
    mg: "Ohatra: Fandoavana latsakemboka andohan'andro amin'ny fotoam-pivavahana na famerenana.",
    fr: 'Exemple : cotisation journalière lors d’un culte ou d’une répétition.',
    en: 'Example: daily contribution during a service or rehearsal.'
  },
  'cotisations.motifLabel': {
    mg: 'Antony / Fanamarihana (Tsy voatery):',
    fr: 'Motif / Remarque (optionnel) :',
    en: 'Reason / Note (optional):'
  },
  'cotisations.motifPlaceholderDaily': {
    mg: 'oh: Latsakemboka famerenana alahady...',
    fr: 'ex. : cotisation de la répétition du dimanche...',
    en: 'e.g.: Sunday rehearsal contribution...'
  },
  'cotisations.motifPlaceholderMonthly': {
    mg: 'oh: Latsakemboka mahazatra...',
    fr: 'ex. : cotisation habituelle...',
    en: 'e.g.: regular contribution...'
  },
  'cotisations.methodLabel': { mg: 'Fomba Fandoavana (Mode):', fr: 'Mode de paiement :', en: 'Payment method:' },
  'cotisations.method.mvola': { mg: 'MVola', fr: 'MVola', en: 'MVola' },
  'cotisations.method.airtel': { mg: 'Airtel', fr: 'Airtel', en: 'Airtel' },
  'cotisations.method.orange': { mg: 'Orange', fr: 'Orange', en: 'Orange' },
  'cotisations.method.bank': { mg: 'Banky', fr: 'Banque', en: 'Bank' },
  'cotisations.method.cash': { mg: 'Keesy', fr: 'Caisse', en: 'Cash' },
  'cotisations.method.fiaram': { mg: 'Fiaram', fr: 'Fiaram', en: 'Fiaram' },
  'cotisations.referenceLabel': {
    mg: 'Laharana Fanamarinana (Référence / Tsy voatery):',
    fr: 'Numéro de référence (optionnel) :',
    en: 'Reference number (optional):'
  },
  'cotisations.referencePlaceholder': { mg: 'oh: MV-987654...', fr: 'ex. : MV-987654...', en: 'e.g.: MV-987654...' },
  'cotisations.submitPayment': {
    mg: 'Hanamarina ny Fandoavana ({type})',
    fr: 'Valider le paiement ({type})',
    en: 'Confirm payment ({type})'
  },
  'cotisations.myAccountTitle': { mg: 'Ny Kaontinao Latsakemboka', fr: 'Votre compte de cotisation', en: 'Your contribution account' },
  'cotisations.myAccountMessage': {
    mg: "Mba handoavanao ny latsakembokao (isam-bolana na andohan'andro), manatona ny Chef de Chœur na ny Mpitantana (Admin).",
    fr: 'Pour régler votre cotisation (mensuelle ou journalière), adressez-vous au Chef de chœur ou au gestionnaire (Admin).',
    en: 'To pay your contribution (monthly or daily), contact the Choir Director or the manager (Admin).'
  },
  'cotisations.memberCodeLabel': { mg: 'Kaody mpikambana:', fr: 'Code membre :', en: 'Member code:' },
  'cotisations.calendarTitle': {
    mg: 'Kalandrie Isam-bolana {year}',
    fr: 'Calendrier mensuel {year}',
    en: 'Monthly calendar {year}'
  },
  'cotisations.calendarLegend': {
    mg: 'Maitso = Voaloa • Fotsy = Tsy mbola voaloa',
    fr: 'Vert = Payé • Blanc = Non payé',
    en: 'Green = Paid • White = Unpaid'
  },
  'cotisations.paid': { mg: 'Voaloa', fr: 'Payé', en: 'Paid' },
  'cotisations.unpaid': { mg: 'Mbola tsy voaloa', fr: 'Non payé', en: 'Unpaid' },
  'cotisations.calendarHintLabel': { mg: 'Fanamarihana:', fr: 'Remarque :', en: 'Note:' },
  'cotisations.calendarHint': {
    mg: "Azonao atao koa ny manatitra latsakemboka isan'andro (andohan'andro) amin'ny daty manokana. Ireo fandoavana rehetra dia mirakitra reçun'ny fandraisam-bola azo atonta printy.",
    fr: 'Vous pouvez également enregistrer une cotisation journalière (Andohan’andro) à une date précise. Tous les paiements incluent un reçu imprimable.',
    en: 'You can also record a daily contribution (Andohan’andro) for a specific date. Every payment includes a printable receipt.'
  },
  'cotisations.historyTitle': {
    mg: "Tantaran'ny Latsakemboka Voasoratra ({count})",
    fr: 'Historique des cotisations enregistrées ({count})',
    en: 'Recorded contribution history ({count})'
  },
  'cotisations.historySubtitle': {
    mg: "Isam-bolana sy Isan'andro",
    fr: 'Mensuel et journalier',
    en: 'Monthly and daily'
  },
  'cotisations.col.type': { mg: 'KARAZANY', fr: 'TYPE', en: 'TYPE' },
  'cotisations.col.periodDate': { mg: 'PERIODE / DATY', fr: 'PÉRIODE / DATE', en: 'PERIOD / DATE' },
  'cotisations.col.motif': { mg: 'ANTONY', fr: 'MOTIF', en: 'REASON' },
  'cotisations.col.amount': { mg: 'VOLA', fr: 'MONTANT', en: 'AMOUNT' },
  'cotisations.col.method': { mg: 'FOMBA', fr: 'MODE', en: 'METHOD' },
  'cotisations.col.reference': { mg: 'REF', fr: 'RÉF', en: 'REF' },
  'cotisations.col.paymentDate': { mg: 'DATY FANDOAVANA', fr: 'DATE DE PAIEMENT', en: 'PAYMENT DATE' },
  'cotisations.col.receipt': { mg: 'REÇU', fr: 'REÇU', en: 'RECEIPT' },
  'cotisations.emptyHistory': {
    mg: "Tsy mbola misy latsakemboka voasoratra ho an'ity mpikambana ity.",
    fr: 'Aucune cotisation enregistrée pour ce membre.',
    en: 'No contributions recorded for this member yet.'
  },
  'cotisations.defaultDailyMotif': { mg: "Latsakemboka Andohan'andro", fr: 'Cotisation journalière', en: 'Daily contribution' },
  'cotisations.defaultMonthlyMotif': { mg: 'Latsakemboka Mahazatra', fr: 'Cotisation habituelle', en: 'Regular contribution' },
  'cotisations.viewReceiptTitle': { mg: 'Hijery ny Reçu', fr: 'Voir le reçu', en: 'View receipt' },
  'cotisations.printReceiptTitle': {
    mg: "Hanonta ny Reçu amin'ny taratasy",
    fr: 'Imprimer le reçu sur papier',
    en: 'Print the receipt on paper'
  },
  'cotisations.receiptBrand': { mg: 'FIARAM NUMERIQUE', fr: 'FIARAM NUMERIQUE', en: 'FIARAM NUMERIQUE' },
  'cotisations.receiptSubtitle': { mg: 'Reçu de cotisation du groupe', fr: 'Reçu de cotisation du groupe', en: 'Group contribution receipt' },
  'cotisations.receiptTitle': {
    mg: 'TARATASY FANDRAISAM-BOLA NOMERIKA (REÇU)',
    fr: 'REÇU NUMÉRIQUE DE PAIEMENT',
    en: 'DIGITAL PAYMENT RECEIPT'
  },
  'cotisations.receiptNumber': { mg: 'Laharana Reçu:', fr: 'Numéro de reçu :', en: 'Receipt number:' },
  'cotisations.motif': { mg: 'Antony:', fr: 'Motif :', en: 'Reason:' },
  'cotisations.paidDate': { mg: 'Daty voaloa:', fr: 'Date payée :', en: 'Paid date:' },
  'cotisations.paidMonth': { mg: 'Volana Voaloa:', fr: 'Mois payé :', en: 'Paid month:' },
  'cotisations.paymentMethod': { mg: 'Fomba Fandoavana:', fr: 'Mode de paiement :', en: 'Payment method:' },
  'cotisations.paymentDate': { mg: 'Daty nandoavana:', fr: 'Date de paiement :', en: 'Payment date:' },
  'cotisations.totalPaid': { mg: 'TOTALY VOALOA:', fr: 'TOTAL VERSÉ :', en: 'TOTAL PAID:' },
  'cotisations.printReceipt': { mg: 'Atonta (Imprimer)', fr: 'Imprimer', en: 'Print' },
  'cotisations.error.noPermission': {
    mg: 'Tsy manana alalana handray latsakemboka ianao.',
    fr: 'Vous n’êtes pas autorisé à recevoir des cotisations.',
    en: 'You are not authorized to receive contributions.'
  },
  'cotisations.error.noPermissionMember': {
    mg: "Tsy manana alalana handray latsakemboka ho an'ity mpikambana ity ianao.",
    fr: 'Vous n’êtes pas autorisé à recevoir des cotisations pour ce membre.',
    en: 'You are not authorized to receive contributions for this member.'
  },
  'cotisations.error.monthAlreadyPaid': {
    mg: 'Efa voaloa ny latsakemboka isam-bolana ho an’ny {month}/{year} !',
    fr: 'La cotisation mensuelle de {month}/{year} est déjà payée !',
    en: 'The monthly contribution for {month}/{year} has already been paid!'
  },
  'cotisations.error.dayAlreadyPaid': {
    mg: "Efa voaloa ny latsakemboka isan'andro ho an'ny daty {date} !",
    fr: 'La cotisation journalière du {date} est déjà payée !',
    en: 'The daily contribution for {date} has already been paid!'
  },
  'cotisations.success.added': {
    mg: 'Tafiditra soa aman-tsara ny latsakemboka {type} mitentina {amount} Ar!',
    fr: 'La cotisation {type} de {amount} Ar a été enregistrée avec succès !',
    en: 'The {type} contribution of {amount} Ar was successfully recorded!'
  }
};
