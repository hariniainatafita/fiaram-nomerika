import type { TranslationDictionary } from '../types';

export const scanner: TranslationDictionary = {
  'scanner.title': { mg: 'Fakan-tsary & Scanner QR', fr: 'Caméra & Scanner QR', en: 'Camera & QR Scanner' },
  'scanner.subtitle': {
    mg: 'Pointage Fahatongavana Aotomatika',
    fr: 'Pointage automatique des arrivées',
    en: 'Automatic arrival check-in'
  },
  'scanner.statusSelectLabel': {
    mg: 'SATA HAMPIDIRINA (STATUT) :',
    fr: 'STATUT À APPLIQUER :',
    en: 'STATUS TO APPLY:'
  },
  'scanner.verified': {
    mg: '✓ Voamarina soa aman-tsara',
    fr: '✓ Présence validée',
    en: '✓ Successfully verified'
  },
  'scanner.badgeNumber': { mg: 'N° : {number}', fr: 'N° : {number}', en: 'No.: {number}' },
  'scanner.codeLabel': { mg: 'Kaody :', fr: 'Code :', en: 'Code:' },
  'scanner.entryTime': { mg: 'Ora nidirana :', fr: "Heure d'entrée :", en: 'Entry time:' },
  'scanner.resultStatusLabel': { mg: 'Sata :', fr: 'Statut :', en: 'Status:' },
  'scanner.scanNext': {
    mg: 'Manaraka (Scanner hafa)',
    fr: 'Suivant (autre scan)',
    en: 'Next (scan another)'
  },
  'scanner.done': { mg: 'Vita', fr: 'Terminé', en: 'Done' },
  'scanner.retry': { mg: 'Andramo indray', fr: 'Réessayer', en: 'Retry' },
  'scanner.changeCameraTitle': {
    mg: 'Hanova ny fakan-tsary (Avant/Arrière)',
    fr: 'Changer de caméra (Avant/Arrière)',
    en: 'Switch camera (Front/Back)'
  },
  'scanner.flip': {
    mg: 'Avadika ny fakan-tsary ({side})',
    fr: 'Changer de caméra ({side})',
    en: 'Switch camera ({side})'
  },
  'scanner.side.back': { mg: 'Aoriana', fr: 'Arrière', en: 'Back' },
  'scanner.side.front': { mg: 'Aloha', fr: 'Avant', en: 'Front' },
  'scanner.uploadImageTitle': {
    mg: "Haka sary QR avy amin'ny fitaovana",
    fr: "Choisir une image QR depuis l'appareil",
    en: 'Pick a QR image from the device'
  },
  'scanner.uploadImage': { mg: 'Hampiditra sary', fr: 'Importer une image', en: 'Upload image' },
  'scanner.manualCodeLabel': {
    mg: 'NA AMPIDIRO TANANA NY KAODY :',
    fr: 'OU SAISIR LE CODE MANUELLEMENT :',
    en: 'OR ENTER THE CODE MANUALLY:'
  },
  'scanner.manualPlaceholder': {
    mg: 'ohatra : GRP-MBR-007 na GRP-ADM-001...',
    fr: 'ex. : GRP-MBR-007 ou GRP-ADM-001...',
    en: 'e.g. GRP-MBR-007 or GRP-ADM-001...'
  },
  'scanner.camera.notice': {
    mg: 'Fanamarihana fakan-tsary',
    fr: 'Note sur la caméra',
    en: 'Camera notice'
  },
  'scanner.camera.permissionError': {
    mg: "Tsy nahazo alalana hampiasa ny fakan-tsary (Permission refusée). Mba ekeo ny fampiasana fakan-tsary ao amin'ny navigateur-nao.",
    fr: "Accès à la caméra refusé (Permission refusée). Veuillez autoriser l'utilisation de la caméra dans votre navigateur.",
    en: 'Camera access denied (Permission denied). Please allow camera access in your browser.'
  },
  'scanner.camera.notFound': {
    mg: "Tsy nahitana fakan-tsary (Aucune caméra détectée) amin'ity fitaovana ity.",
    fr: 'Aucune caméra détectée sur cet appareil.',
    en: 'No camera was detected on this device.'
  },
  'scanner.camera.startError': {
    mg: 'Tsy afaka nanomboka ny fakan-tsary. Mety efa mampiasa azy ny fampiharana hafa.',
    fr: "Impossible de démarrer la caméra. Une autre application l'utilise peut-être déjà.",
    en: 'Unable to start the camera. Another application may already be using it.'
  },
  'scanner.error.noPermission': {
    mg: "Tsy manana alalana hanamarina ny fahatongavan'ity mpikambana ity ianao.",
    fr: "Vous n'avez pas l'autorisation de valider la présence de ce membre.",
    en: "You do not have permission to validate this member's attendance."
  },
  'scanner.error.codeNotFound': {
    mg: 'Tsy hita ao amin\'ny lisitry ny mpikambana ny kaody "{code}".',
    fr: 'Le code « {code} » est introuvable dans la liste des membres.',
    en: 'The code “{code}” was not found in the member list.'
  },
  'scanner.error.qrImageUnreadable': {
    mg: "Tsy nahitana kaody QR azo vakiana tao anatin'io sary io.",
    fr: "Aucun QR code lisible n'a été trouvé dans cette image.",
    en: 'No readable QR code was found in this image.'
  }
};
