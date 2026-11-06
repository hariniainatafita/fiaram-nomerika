import type { TranslationDictionary } from '../types';

export const calls: TranslationDictionary = {
  'calls.title': { mg: 'Antso feo', fr: 'Appel vocal', en: 'Voice call' },
  'calls.start': { mg: 'Hantsoana antso feo', fr: 'Appeler en vocal', en: 'Start voice call' },
  'calls.incoming': {
    mg: 'Antso feo miditra…',
    fr: 'Appel vocal entrant…',
    en: 'Incoming voice call…'
  },
  'calls.ringing': {
    mg: 'Miantso…',
    fr: 'Appel en cours…',
    en: 'Calling…'
  },
  'calls.connecting': {
    mg: 'Mifandray…',
    fr: 'Connexion…',
    en: 'Connecting…'
  },
  'calls.ended': { mg: 'Vita ny antso', fr: 'Appel terminé', en: 'Call ended' },
  'calls.endedByPeer': {
    mg: 'Nofaranan’ny mpifanandrina ny antso.',
    fr: 'L’appel a été terminé par votre correspondant.',
    en: 'The call was ended by the other person.'
  },
  'calls.declined': {
    mg: 'Nolavina ny antso.',
    fr: 'Appel refusé.',
    en: 'Call declined.'
  },
  'calls.busy': {
    mg: 'Miasa amin’ny antso hafa izy.',
    fr: 'Votre correspondant est déjà en appel.',
    en: 'The person is already on another call.'
  },
  'calls.noAnswer': {
    mg: 'Tsy nisy valiny.',
    fr: 'Pas de réponse.',
    en: 'No answer.'
  },
  'calls.micDenied': {
    mg: 'Nolavina ny fidirana amin’ny mikrô.',
    fr: 'Accès au microphone refusé. Autorisez le microphone pour passer un appel.',
    en: 'Microphone access denied. Allow the microphone to make a call.'
  },
  'calls.updateApp': {
    mg: 'Havaozy ny application (APK) mba hahafahana manao antso feo.',
    fr: 'Installez la mise à jour de l’application pour passer des appels vocaux.',
    en: 'Install the app update to make voice calls.'
  },
  'calls.noMic': {
    mg: 'Tsy hita ny mikrô.',
    fr: 'Aucun microphone détecté.',
    en: 'No microphone found.'
  },
  'calls.micError': {
    mg: 'Tsy afaka nampiasa ny mikrô.',
    fr: 'Impossible d’utiliser le microphone.',
    en: 'Could not use the microphone.'
  },
  'calls.unsupported': {
    mg: 'Tsy tohanan’ity fitaovana ity ny antso feo.',
    fr: 'Les appels vocaux ne sont pas pris en charge sur cet appareil.',
    en: 'Voice calls are not supported on this device.'
  },
  'calls.notConfigured': {
    mg: 'Tsy voarindra ny fifandraisana amin’ny Internet.',
    fr: 'La synchronisation Internet n’est pas configurée.',
    en: 'Internet synchronization is not configured.'
  },
  'calls.connectionFailed': {
    mg: 'Tsy nahomby ny fifandraisana. Jereo ny Internet.',
    fr: 'La connexion a échoué. Vérifiez votre connexion Internet.',
    en: 'The connection failed. Check your Internet connection.'
  },
  'calls.failed': {
    mg: 'Tsy nahomby ny antso.',
    fr: 'L’appel a échoué.',
    en: 'The call failed.'
  },
  'calls.freeNote': {
    mg: 'Antso amin’ny Internet — tsy mandany crédit finday.',
    fr: 'Appel via Internet — ne consomme aucun crédit téléphonique.',
    en: 'Call over the Internet — uses no phone credit.'
  },
  'calls.accept': { mg: 'Valio', fr: 'Accepter', en: 'Accept' },
  'calls.decline': { mg: 'Lavina', fr: 'Refuser', en: 'Decline' },
  'calls.cancel': { mg: 'Ajanona', fr: 'Annuler', en: 'Cancel' },
  'calls.hangUp': { mg: 'Tapaho', fr: 'Raccrocher', en: 'Hang up' },
  'calls.mute': { mg: 'Mangina', fr: 'Sourdine', en: 'Mute' },
  'calls.unmute': { mg: 'Ampandreneso', fr: 'Réactiver', en: 'Unmute' },
  'calls.close': { mg: 'Hidio', fr: 'Fermer', en: 'Close' },
  'calls.tapToHear': {
    mg: 'Tsindrio raha handre',
    fr: 'Touchez pour entendre',
    en: 'Tap to hear'
  },
  'calls.unknownCaller': {
    mg: 'Mpifandray',
    fr: 'Correspondant',
    en: 'Caller'
  },
  'calls.startVideo': { mg: 'Hantsoana antso video', fr: 'Appeler en vidéo', en: 'Start video call' },
  'calls.incomingVideo': {
    mg: 'Antso video miditra…',
    fr: 'Appel vidéo entrant…',
    en: 'Incoming video call…'
  },
  'calls.noCamera': {
    mg: 'Tsy hita ny fakantsary.',
    fr: 'Aucune caméra détectée.',
    en: 'No camera found.'
  },
  'calls.cameraDenied': {
    mg: 'Nolavina ny fidirana amin’ny fakantsary.',
    fr: 'Accès à la caméra refusé. Autorisez la caméra pour un appel vidéo.',
    en: 'Camera access denied. Allow the camera for a video call.'
  },
  'calls.cameraOn': { mg: 'Alefaso ny fakantsary', fr: 'Allumer la caméra', en: 'Turn camera on' },
  'calls.cameraOff': { mg: 'Maty ny fakantsary', fr: 'Éteindre la caméra', en: 'Turn camera off' },
  'calls.enlargeVideo': { mg: 'Halefaso ny video hafa', fr: 'Agrandir la vidéo', en: 'Enlarge video' },
  'calls.minimizeVideo': { mg: 'Henao ny video hafa', fr: 'Réduire la vidéo', en: 'Shrink video' },
  'calls.switchCamera': { mg: 'Mifamadika fakantsary', fr: 'Basculer la caméra', en: 'Switch camera' },
  'calls.logEndedVoice': {
    mg: 'Antso feo vita ({duration})',
    fr: 'Appel vocal terminé ({duration})',
    en: 'Voice call ended ({duration})'
  },
  'calls.logEndedVideo': {
    mg: 'Antso video vita ({duration})',
    fr: 'Appel vidéo terminé ({duration})',
    en: 'Video call ended ({duration})'
  },
  'calls.logMissedVoice': { mg: 'Antso feo tsy nisy valiny', fr: 'Appel vocal manqué', en: 'Missed voice call' },
  'calls.logMissedVideo': { mg: 'Antso video tsy nisy valiny', fr: 'Appel vidéo manqué', en: 'Missed video call' }
};
