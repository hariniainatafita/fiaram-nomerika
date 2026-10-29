import type { TranslationDictionary } from '../types';

export const resources: TranslationDictionary = {
  'resources.badge': { mg: 'Loharano', fr: 'Ressources', en: 'Resources' },
  'resources.title': { mg: 'Loharano & Antontan-taratasin’ny vondrona', fr: 'Ressources et documents du groupe', en: 'Group resources and documents' },
  'resources.subtitle': {
    mg: 'Antontan-taratasy, fanofanana, haino aman-jery ary loharano zarain’ny vondrona.',
    fr: 'Documents, supports de formation, médias et ressources partagées du groupe.',
    en: 'Documents, training materials, media and resources shared by the group.'
  },
  'resources.add': { mg: 'Hampiditra loharano', fr: 'Ajouter une ressource', en: 'Add a resource' },
  'resources.manageCategories': { mg: 'Fitantanana sokajy', fr: 'Gérer les catégories', en: 'Manage categories' },
  'resources.categoriesTitle': { mg: 'Sokajin’ny loharano', fr: 'Catégories de ressources', en: 'Resource categories' },
  'resources.categoriesHint': {
    mg: 'Ampio, ovay na fafao ny sokajy. Rehefa fafana ny sokajy iray dia afindra any amin’ny sokajy hafa ny loharano mifandraika aminy.',
    fr: 'Ajoutez, renommez ou supprimez une catégorie. Les ressources associées sont déplacées vers une autre catégorie en cas de suppression.',
    en: 'Add, rename or delete a category. Associated resources are moved to another category when a category is deleted.'
  },
  'resources.newCategoryPlaceholder': { mg: 'Anaran’ny sokajy vaovao...', fr: 'Nom de la nouvelle catégorie...', en: 'New category name...' },
  'resources.addCategory': { mg: 'Hanampy sokajy', fr: 'Ajouter la catégorie', en: 'Add category' },
  'resources.categoryEmpty': { mg: 'Fenoy ny anaran’ny sokajy.', fr: 'Saisissez le nom de la catégorie.', en: 'Enter the category name.' },
  'resources.categoryDuplicate': { mg: 'Efa misy io sokajy io.', fr: 'Cette catégorie existe déjà.', en: 'This category already exists.' },
  'resources.deleteCategoryConfirm': {
    mg: 'Hofafana ny sokajy « {name} » ? Ny loharano ao aminy dia hafindra amin’ny sokajy hafa.',
    fr: 'Supprimer la catégorie « {name} » ? Ses ressources seront déplacées vers une autre catégorie.',
    en: 'Delete the category “{name}”? Its resources will be moved to another category.'
  },
  'resources.categoryFallback': { mg: 'Loharano', fr: 'Ressource', en: 'Resource' },
  'resources.category.documents': { mg: 'Antontan-taratasy', fr: 'Documents', en: 'Documents' },
  'resources.category.formation': { mg: 'Fanofanana', fr: 'Formation', en: 'Training' },
  'resources.category.media': { mg: 'Haino aman-jery', fr: 'Médias', en: 'Media' },
  'resources.category.announcement': { mg: 'Filazana', fr: 'Annonces', en: 'Announcements' },
  'resources.category.other': { mg: 'Hafa', fr: 'Autres', en: 'Other' },
  'resources.searchPlaceholder': {
    mg: 'Karoka anarana, mpanoratra na votoaty...',
    fr: 'Rechercher un titre, un auteur ou un contenu...',
    en: 'Search a title, author or content...'
  },
  'resources.favorites': { mg: 'Ankafizo', fr: 'Favoris', en: 'Favorites' },
  'resources.favorite': { mg: 'Ankafizo', fr: 'Ajouter aux favoris', en: 'Add to favorites' },
  'resources.unfavorite': { mg: 'Esory amin’ny ankafizo', fr: 'Retirer des favoris', en: 'Remove from favorites' },
  'resources.playing': { mg: 'Eo am-pandrenesana ny haino aman-jery...', fr: 'Lecture du média en cours...', en: 'Playing media...' },
  'resources.paused': { mg: 'Najanona ny famakiana', fr: 'Lecture en pause', en: 'Playback paused' },
  'resources.playerSubtitle': { mg: 'Mpamaky loharano an’ny vondrona', fr: 'Lecteur de ressources du groupe', en: 'Group resource player' },
  'resources.stop': { mg: 'Atsaharo', fr: 'Arrêter', en: 'Stop' },
  'resources.noMatch': {
    mg: 'Tsy misy loharano mifanaraka amin’ny fikarohana na ny sivana.',
    fr: 'Aucune ressource ne correspond à votre recherche ou au filtre sélectionné.',
    en: 'No resource matches your search or selected filter.'
  },
  'resources.author': { mg: 'Mpanoratra', fr: 'Auteur', en: 'Author' },
  'resources.views': { mg: 'fijerena', fr: 'vues', en: 'views' },
  'resources.listen': { mg: 'Henoy', fr: 'Écouter', en: 'Listen' },
  'resources.read': { mg: 'Vakio', fr: 'Lire', en: 'Read' },
  'resources.emptyContent': { mg: 'Tsy misy votoaty', fr: 'Aucun contenu', en: 'No content' },
  'resources.source': { mg: 'Loharano', fr: 'Source', en: 'Source' },
  'resources.noAudio': { mg: 'Tsy misy rakitra feo mifandraika amin’ity loharano ity.', fr: 'Aucun fichier audio associé à cette ressource.', en: 'No audio file is associated with this resource.' },
  'resources.deleteConfirm': { mg: 'Hofafana tanteraka ny loharano « {name} » ?', fr: 'Supprimer définitivement la ressource « {name} » ?', en: 'Permanently delete the resource “{name}”?' },
  'resources.copied': { mg: 'Nadika tao amin’ny presse-papier ny votoaty.', fr: 'Contenu copié dans le presse-papiers.', en: 'Content copied to the clipboard.' },
  'resources.addTitle': { mg: 'Hampiditra loharano vaovao', fr: 'Ajouter une nouvelle ressource', en: 'Add a new resource' },
  'resources.resourceTitleLabel': { mg: 'Anaran’ny loharano :', fr: 'Titre de la ressource :', en: 'Resource title:' },
  'resources.resourceTitlePlaceholder': { mg: 'Ohatra: Fitsipiky ny vondrona', fr: 'Ex. : Charte du groupe', en: 'E.g.: Group charter' },
  'resources.authorLabel': { mg: 'Mpanoratra / Loharano :', fr: 'Auteur / Source :', en: 'Author / Source:' },
  'resources.authorPlaceholder': { mg: 'Ohatra: Fitantanana', fr: 'Ex. : Direction du groupe', en: 'E.g.: Group leadership' },
  'resources.categoryLabel': { mg: 'Sokajy :', fr: 'Catégorie :', en: 'Category:' },
  'resources.contentLabel': { mg: 'Votoaty / Famaritana :', fr: 'Contenu / Description :', en: 'Content / Description:' },
  'resources.contentPlaceholder': {
    mg: 'Votoatin’ny loharano, torolalana, fanamarihana na famaritana...',
    fr: 'Contenu de la ressource, consignes, notes ou description...',
    en: 'Resource content, instructions, notes or description...'
  },
  'resources.save': { mg: 'Tehirizo ny loharano', fr: 'Enregistrer la ressource', en: 'Save resource' }
};
