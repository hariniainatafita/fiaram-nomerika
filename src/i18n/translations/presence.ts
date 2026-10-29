import type { TranslationDictionary } from '../types';

export const presence: TranslationDictionary = {
  'presence.badge': { mg: 'Modely F-PRESENCE', fr: 'Modèle F-PRESENCE', en: 'F-PRESENCE model' },
  'presence.title': { mg: 'Fitantanana ny Fahatongavana', fr: 'Gestion des présences', en: 'Attendance Management' },
  'presence.subtitle.manager': {
    mg: "Fanamarihana fahatongavana amin'ny alalan'ny Kaody QR, Dian-tanana (Biométrie), ary Tantara feno.",
    fr: 'Enregistrement des présences par QR Code, empreinte digitale (biométrie) et historique complet.',
    en: 'Attendance recording via QR Code, fingerprint (biometrics) and full history.'
  },
  'presence.subtitle.member': {
    mg: "Ity ny tantaran'ny fahatongavanao. Ny Chef na ny Admin no manamarina ny fahatongavana.",
    fr: "Voici votre historique de présence. Le Chef ou l'Admin valide les présences.",
    en: 'This is your attendance history. The Chef or Admin validates attendance.'
  },
  'presence.exportCsv': { mg: 'Hamoaka CSV (Excel)', fr: 'Exporter CSV (Excel)', en: 'Export CSV (Excel)' },
  'presence.tabs.scanner': { mg: 'Scan Kaody QR', fr: 'Scanner QR Code', en: 'Scan QR Code' },
  'presence.tabs.biometrics': { mg: 'Dian-tanana (Biométrie)', fr: 'Empreinte (Biométrie)', en: 'Fingerprint (Biometrics)' },
  'presence.tabs.manual': { mg: 'Fanamarihana Tanana', fr: 'Pointage manuel', en: 'Manual entry' },
  'presence.tabs.history': {
    mg: "Tantaran'ny Fahatongavana ({count})",
    fr: 'Historique des présences ({count})',
    en: 'Attendance history ({count})'
  },
  'presence.scanner.title': { mg: 'Fakan-tsary & Scanner QR', fr: 'Caméra & Scanner QR', en: 'Camera & QR Scanner' },
  'presence.scanner.subtitle': {
    mg: 'Atodiho manatrika ny karatra na ny QR code ny fakan-tsary.',
    fr: 'Dirigez la caméra vers la carte ou le QR code.',
    en: 'Point the camera at the card or QR code.'
  },
  'presence.scanner.startCamera': { mg: 'Alefaso ny Caméra', fr: 'Activer la caméra', en: 'Start camera' },
  'presence.scanner.readyTitle': { mg: 'Vonona handray ny fakan-tsary', fr: 'Caméra prête', en: 'Camera ready' },
  'presence.scanner.readySubtitle': {
    mg: 'Tsindrio ny bokotra eto ambany mba hanombohana ny scanner mivantana',
    fr: 'Cliquez sur le bouton ci-dessous pour démarrer le scanner en direct',
    en: 'Click the button below to start the live scanner'
  },
  'presence.scanner.startScanner': { mg: 'Hanomboka Scanner', fr: 'Démarrer le scanner', en: 'Start scanner' },
  'presence.scanner.flip': {
    mg: 'Avadika ny fakan-tsary ({side})',
    fr: 'Changer de caméra ({side})',
    en: 'Switch camera ({side})'
  },
  'presence.scanner.side.back': { mg: 'Aoriana', fr: 'Arrière', en: 'Back' },
  'presence.scanner.side.front': { mg: 'Aloha', fr: 'Avant', en: 'Front' },
  'presence.scanner.uploadImage': { mg: 'Hampiditra sary QR', fr: 'Importer une image QR', en: 'Upload QR image' },
  'presence.scanner.verifiedAt': {
    mg: "✓ VOAMARINA TAMIN'NY {time}",
    fr: '✓ VALIDÉ À {time}',
    en: '✓ VERIFIED AT {time}'
  },
  'presence.scanner.badgeNumber': { mg: 'N° : {number}', fr: 'N° : {number}', en: 'No.: {number}' },
  'presence.scanner.statusSelectLabel': {
    mg: 'SAFIDIO NY SATA HAMPIDIRINA:',
    fr: 'CHOISIR LE STATUT À APPLIQUER :',
    en: 'SELECT THE STATUS TO APPLY:'
  },
  'presence.scanner.codePlaceholder': {
    mg: 'Ampidiro ny kaody (ohatra: GRP-MBR-007)...',
    fr: 'Saisissez le code (ex. : GRP-MBR-007)...',
    en: 'Enter the code (e.g. GRP-MBR-007)...'
  },
  'presence.scanner.submitCode': { mg: 'Mariho', fr: 'Valider', en: 'Validate' },
  'presence.statusOption.present': { mg: '✓ Tonga (Présent)', fr: '✓ Présent', en: '✓ Present' },
  'presence.statusOption.late': { mg: '⏱ Tara (Retard)', fr: '⏱ En retard', en: '⏱ Late' },
  'presence.statusOption.absent': { mg: '✕ Tsy teo (Absent)', fr: '✕ Absent', en: '✕ Absent' },
  'presence.quick.title': { mg: "Pointage Haingana amin'ny Tsindry", fr: 'Pointage rapide en un clic', en: 'Quick one-click check-in' },
  'presence.quick.subtitle': {
    mg: 'Tsindrio mivantana ny bokotra "Point" eo anilan\'ny mpikambana mba hanamarihana azy.',
    fr: 'Cliquez directement sur le bouton « Pointer » à côté du membre pour valider sa présence.',
    en: 'Click the “Check in” button next to a member to validate their attendance.'
  },
  'presence.quick.markPresent': { mg: 'Mariho ho Tonga', fr: 'Marquer présent', en: 'Mark present' },
  'presence.quick.markLate': { mg: 'Mariho ho Tara', fr: 'Marquer en retard', en: 'Mark late' },
  'presence.biometrics.title': {
    mg: "Fanamarihana amin'ny Dian-tanana",
    fr: 'Pointage par empreinte digitale',
    en: 'Fingerprint check-in'
  },
  'presence.biometrics.subtitle': {
    mg: "Apetraho eo amin'ny mpamaky dian-tanana (capteur biométrique) ny rantsan-tanana voasoratra mba hanamarina ny fahatongavana haingana.",
    fr: 'Placez le doigt enregistré sur le lecteur d’empreintes (capteur biométrique) pour valider rapidement la présence.',
    en: 'Place the registered finger on the fingerprint reader (biometric sensor) to validate attendance quickly.'
  },
  'presence.biometrics.tapTitle': {
    mg: 'Tsindrio hanamarina ny dian-tananao',
    fr: 'Cliquez pour valider votre empreinte',
    en: 'Click to validate your fingerprint'
  },
  'presence.biometrics.memberLabel': { mg: "Mpikambana amperin'asa :", fr: 'Membre concerné :', en: 'Member concerned:' },
  'presence.biometrics.fingerprintRegistered': {
    mg: 'Dian-tanana efa voasoratra',
    fr: 'Empreinte déjà enregistrée',
    en: 'Fingerprint registered'
  },
  'presence.biometrics.fingerprintNotRegistered': {
    mg: 'Tsy mbola voasoratra',
    fr: 'Pas encore enregistrée',
    en: 'Not yet registered'
  },
  'presence.biometrics.confirm': {
    mg: 'Tsindrio hanamarina ny dian-tanana',
    fr: "Cliquez pour valider l'empreinte",
    en: 'Click to validate the fingerprint'
  },
  'presence.manual.title': {
    mg: 'Fanamarihana Tanana (Validation Manuelle)',
    fr: 'Pointage manuel (validation manuelle)',
    en: 'Manual entry (manual validation)'
  },
  'presence.manual.subtitle': {
    mg: 'Fomba famenoana fahatongavana raha toa ka sendra tsy afaka mampiasa QR na dian-tanana ny mpikambana.',
    fr: "Méthode de saisie des présences si un membre ne peut pas utiliser le QR code ou l'empreinte digitale.",
    en: 'Method for recording attendance if a member cannot use the QR code or fingerprint.'
  },
  'presence.manual.memberLabel': { mg: 'Safidio ny Mpikambana :', fr: 'Sélectionnez le membre :', en: 'Select the member:' },
  'presence.manual.statusLabel': { mg: "Satan'ny Fahatongavana :", fr: 'Statut de la présence :', en: 'Attendance status:' },
  'presence.manual.submit': {
    mg: "Ampidiro ao amin'ny Lisitry ny Fahatongavana",
    fr: 'Ajouter à la liste des présences',
    en: 'Add to the attendance list'
  },
  'presence.history.searchPlaceholder': {
    mg: 'Mitady anarana na kaody...',
    fr: 'Rechercher un nom ou un code...',
    en: 'Search a name or code...'
  },
  'presence.history.allStatuses': { mg: 'Sata rehetra', fr: 'Tous les statuts', en: 'All statuses' },
  'presence.history.presentOnly': { mg: 'Tonga ihany', fr: 'Présents uniquement', en: 'Present only' },
  'presence.history.lateOnly': { mg: 'Tara ihany', fr: 'En retard uniquement', en: 'Late only' },
  'presence.history.absentOnly': { mg: 'Tsy teo ihany', fr: 'Absents uniquement', en: 'Absent only' },
  'presence.history.allMonths': { mg: 'Volana rehetra', fr: 'Tous les mois', en: 'All months' },
  'presence.history.monthOption': { mg: '{month} ({number})', fr: '{month} ({number})', en: '{month} ({number})' },
  'presence.history.empty': {
    mg: "Tsy misy fahatongavana voasoratra mifanaraka amin'ny sivana.",
    fr: 'Aucune présence enregistrée ne correspond aux filtres.',
    en: 'No attendance record matches the filters.'
  },
  'presence.table.member': { mg: 'MPIKAMBANA', fr: 'MEMBRE', en: 'MEMBER' },
  'presence.table.dateTime': { mg: 'DATY SY ORA', fr: 'DATE ET HEURE', en: 'DATE AND TIME' },
  'presence.table.status': { mg: 'SATA', fr: 'STATUT', en: 'STATUS' },
  'presence.table.method': { mg: 'FOMBA', fr: 'MÉTHODE', en: 'METHOD' },
  'presence.error.memberNotFound': {
    mg: 'Tsy hita io mpikambana io !',
    fr: 'Ce membre est introuvable !',
    en: 'This member could not be found!'
  },
  'presence.error.noPermission': {
    mg: 'Tsy manana alalana hanamarina fahatongavana ianao.',
    fr: "Vous n'avez pas l'autorisation de valider les présences.",
    en: 'You do not have permission to validate attendance.'
  },
  'presence.error.outsideScope': {
    mg: "Tsy ao anatin'ny sokajy tantananao io mpikambana io.",
    fr: 'Ce membre ne fait pas partie de votre groupe.',
    en: 'This member is not part of your group.'
  },
  'presence.error.qrImageUnreadable': {
    mg: "Tsy nahitana kaody QR azo vakiana tao anatin'io sary io.",
    fr: 'Aucun QR code lisible n’a été trouvé dans cette image.',
    en: 'No readable QR code was found in this image.'
  },
  'presence.error.codeNotFound': {
    mg: 'Tsy misy mpikambana mifanaraka amin\'ny kaody "{code}" !',
    fr: 'Aucun membre ne correspond au code « {code} » !',
    en: 'No member matches the code “{code}”!'
  },
  'presence.success.pointage': {
    mg: "Voamarina soa aman-tsara: {name} ({status}) tamin'ny alalan'ny {method}.",
    fr: 'Présence validée avec succès : {name} ({status}) via {method}.',
    en: 'Attendance successfully validated: {name} ({status}) via {method}.'
  },
  'presence.camera.permissionError': {
    mg: "Tsy nahazo alalana hampiasa ny fakan-tsary (Permission refusée). Ekeo ny fampiasana fakan-tsary ao amin'ny navigateur.",
    fr: "Accès à la caméra refusé. Autorisez l'utilisation de la caméra dans votre navigateur.",
    en: 'Camera access denied. Allow camera usage in your browser.'
  },
  'presence.camera.startError': {
    mg: 'Tsy afaka nanomboka ny fakan-tsary. Hamarino raha misy fampiharana hafa mampiasa azy.',
    fr: 'Impossible de démarrer la caméra. Vérifiez qu’une autre application ne l’utilise pas.',
    en: 'Unable to start the camera. Check that no other application is using it.'
  },
  'presence.export.filePrefix': { mg: 'Fahatongavana_FIARAM', fr: 'Presences_FIARAM', en: 'Attendance_FIARAM' },
  'presence.csv.id': { mg: 'ID', fr: 'ID', en: 'ID' },
  'presence.csv.fullName': { mg: "Anarana sy Fanampin'anarana", fr: 'Nom et prénom', en: 'Full name' },
  'presence.csv.code': { mg: 'Kaody', fr: 'Code', en: 'Code' },
  'presence.csv.dateTime': { mg: 'Daty sy Ora', fr: 'Date et heure', en: 'Date and time' },
  'presence.csv.status': { mg: 'Sata', fr: 'Statut', en: 'Status' },
  'presence.csv.method': { mg: 'Fomba', fr: 'Méthode', en: 'Method' }
};
