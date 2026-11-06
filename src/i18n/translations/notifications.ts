import type { TranslationDictionary } from '../types';

export const notifications: TranslationDictionary = {
  'nav.short.notifications': { mg: 'Famp.', fr: 'Notifs', en: 'Alerts' },
  'notifications.title': { mg: 'Fampandrenesana', fr: 'Notifications', en: 'Notifications' },
  'notifications.empty': {
    mg: 'Tsy misy fampandrenesana vaovao.',
    fr: 'Aucune notification pour le moment.',
    en: 'No notifications yet.'
  },
  'notifications.markAllRead': {
    mg: 'Vakio daholo',
    fr: 'Tout marquer comme lu',
    en: 'Mark all as read'
  },
  'notifications.clear': { mg: 'Fafao', fr: 'Effacer', en: 'Clear' },
  'notifications.publication.title': {
    mg: 'Namoaka lahatsoratra vaovao i {name}',
    fr: '{name} a publié une nouvelle publication',
    en: '{name} shared a new post'
  },
  'notifications.reaction.title': {
    mg: 'Nanao {emoji} tamin’ny lahatsoratrao i {name}',
    fr: '{name} a réagi {emoji} à votre publication',
    en: '{name} reacted {emoji} to your post'
  },
  'notifications.comment.title': {
    mg: 'Nandray hevitra tamin’ny lahatsoratrao i {name}',
    fr: '{name} a commenté votre publication',
    en: '{name} commented on your post'
  },
  'notifications.update.title': {
    mg: 'Misy fanavaozana',
    fr: 'Mise à jour disponible',
    en: 'Update available'
  },
  'notifications.update.body': {
    mg: 'Vonona ny version {version}. Tsindrio raha hijery.',
    fr: 'La version {version} est prête. Touchez pour voir.',
    en: 'Version {version} is ready. Tap to view.'
  },
  'notifications.ota.title': {
    mg: 'Vonona ny fanavaozana',
    fr: 'Mise à jour prête',
    en: 'Update ready'
  },
  'notifications.ota.body': {
    mg: 'Hampiharina amin’ny fanokafana manaraka ny application.',
    fr: 'Elle sera appliquée au prochain démarrage de l’application.',
    en: 'It will be applied the next time you open the app.'
  },
  'notifications.message.title': {
    mg: 'Hafatra vaovao avy amin’i {name}',
    fr: 'Nouveau message de {name}',
    en: 'New message from {name}'
  },
  'notifications.group.title': {
    mg: 'Hafatra vaovao ao amin’ny {group}',
    fr: 'Nouveau message dans {group}',
    en: 'New message in {group}'
  },
  'notifications.event.title': {
    mg: 'Hetsika vaovao: {name}',
    fr: 'Nouvel événement : {name}',
    en: 'New event: {name}'
  },
  'notifications.member.title': {
    mg: 'Fangatahana mpikambana vaovao',
    fr: 'Nouvelle demande de membre',
    en: 'New member request'
  },
  'notifications.member.body': {
    mg: 'Misy {count} fangatahana miandry fanamarinana.',
    fr: '{count} demande(s) en attente de validation.',
    en: '{count} request(s) awaiting approval.'
  },
  'notifications.time.now': { mg: 'Ankehitriny', fr: 'À l’instant', en: 'Just now' },
  'notifications.time.minutes': { mg: '{count} min', fr: 'Il y a {count} min', en: '{count} min ago' },
  'notifications.time.hours': { mg: '{count} ora', fr: 'Il y a {count} h', en: '{count} h ago' },
  'notifications.time.days': { mg: '{count} andro', fr: 'Il y a {count} j', en: '{count} d ago' }
};
