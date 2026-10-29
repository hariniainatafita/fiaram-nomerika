import type { TranslationDictionary } from '../types';

export const groups: TranslationDictionary = {
  'groups.badge': { mg: 'Modely F-GROUPE', fr: 'Modèle F-GROUPE', en: 'F-GROUP Model' },
  'groups.title': { mg: 'Fitantanana ny Sokajy sy Tarika', fr: 'Gestion des groupes et chorales', en: 'Group & Choir Management' },
  'groups.subtitle': {
    mg: "Fandrindrana ny anaran'ny sokajy, ny mpitarika (Chef), ary ny mpikambana isaky ny feo sy tarika.",
    fr: 'Gestion des noms de groupes, des chefs et des membres par voix et par chorale.',
    en: 'Manage group names, leaders (Chef), and members by voice and choir.'
  },
  'groups.create': { mg: 'Hanorina Sokajy Vaovao', fr: 'Créer un nouveau groupe', en: 'Create new group' },
  'groups.editGroupTitle': { mg: 'Hanova ny sokajy', fr: 'Modifier le groupe', en: 'Edit group' },
  'groups.noDescription': {
    mg: "Vondron'ny mpikambana ao amin'ny fikambanana.",
    fr: "Groupe de membres de l'organisation.",
    en: 'Group of members of the organization.'
  },
  'groups.noDescriptionDetail': {
    mg: 'Tsy misy famaritana fanampiny.',
    fr: 'Aucune description supplémentaire.',
    en: 'No additional description.'
  },
  'groups.chefLabel': { mg: 'Chef :', fr: 'Chef :', en: 'Chef:' },
  'groups.unassigned': { mg: 'Tsy voatondro', fr: 'Non assigné', en: 'Unassigned' },
  'groups.selected': { mg: 'Voafidy ✓', fr: 'Sélectionné ✓', en: 'Selected ✓' },
  'groups.clickToView': { mg: 'Tsindrio hijerena', fr: 'Cliquez pour voir', en: 'Click to view' },
  'groups.chefDeGroupe': { mg: 'Chef de groupe :', fr: 'Chef de groupe :', en: 'Group leader:' },
  'groups.balance': { mg: 'Tahiry :', fr: 'Solde :', en: 'Balance:' },
  'groups.editNameChef': { mg: 'Hanova Anarana / Chef', fr: 'Modifier nom / chef', en: 'Edit name / chef' },
  'groups.addMembers': { mg: 'Hampiditra Mpikambana', fr: 'Ajouter des membres', en: 'Add members' },
  'groups.membersListTitle': {
    mg: "Lisitry ny Mpikambana ao amin'ny sokajy ({count})",
    fr: 'Liste des membres du groupe ({count})',
    en: 'Group members list ({count})'
  },
  'groups.searchMemberPlaceholder': {
    mg: 'Mitady mpikambana...',
    fr: 'Rechercher un membre...',
    en: 'Search for a member...'
  },
  'groups.emptyMembers': {
    mg: "Tsy misy mpikambana ao amin'ity sokajy ity.",
    fr: 'Aucun membre dans ce groupe.',
    en: 'No members in this group.'
  },
  'groups.emptyMembersHint': {
    mg: 'Tsindrio ny bokotra "Hampiditra Mpikambana" eo ambony mba hanampiana mpihira.',
    fr: 'Cliquez sur le bouton « Ajouter des membres » ci-dessus pour ajouter des choristes.',
    en: 'Click the "Add members" button above to add singers.'
  },
  'groups.chefBadge': { mg: 'Chef Sokajy', fr: 'Chef de groupe', en: 'Group leader' },
  'groups.promoteTitle': {
    mg: "Tendrena ho Chef amin'ity sokajy ity",
    fr: 'Nommer chef de ce groupe',
    en: 'Promote to group leader'
  },
  'groups.promoteAction': { mg: 'Atao Chef', fr: 'Nommer chef', en: 'Make leader' },
  'groups.moveTitle': {
    mg: 'Afindra sokajy hafa',
    fr: 'Déplacer vers un autre groupe',
    en: 'Move to another group'
  },
  'groups.moveAction': { mg: 'Afindra', fr: 'Déplacer', en: 'Move' },
  'groups.removeTitle': {
    mg: "Esory amin'ity sokajy ity",
    fr: 'Retirer de ce groupe',
    en: 'Remove from this group'
  },
  'groups.editGroupModalTitle': {
    mg: 'Paramètre & Fanovana ny Sokajy',
    fr: 'Paramètres et modification du groupe',
    en: 'Group settings & edit'
  },
  'groups.nameLabel': {
    mg: "Anaran'ny Sokajy (Nom du groupe) :",
    fr: 'Nom du groupe :',
    en: 'Group name:'
  },
  'groups.nameLabelPlain': { mg: "Anaran'ny Sokajy :", fr: 'Nom du groupe :', en: 'Group name:' },
  'groups.namePlaceholder': {
    mg: 'oh: Soprano, Alto, Ténor, Basse, Mpitendry...',
    fr: 'ex. : Soprano, Alto, Ténor, Basse, Mpitendry...',
    en: 'e.g. Soprano, Alto, Tenor, Bass, Mpitendry...'
  },
  'groups.descriptionLabel': {
    mg: 'Famaritana (Description) :',
    fr: 'Description :',
    en: 'Description:'
  },
  'groups.descriptionPlaceholder': {
    mg: 'Mombamomba ny sokajy...',
    fr: 'À propos du groupe...',
    en: 'About the group...'
  },
  'groups.chefLabelForm': {
    mg: "Lehiben'ny Sokajy (Chef de Groupe) :",
    fr: 'Chef de groupe :',
    en: 'Group leader:'
  },
  'groups.chefHintAllowed': {
    mg: "Azonao fidiany amin'ny mpikambana rehetra ny Chef de Groupe.",
    fr: 'Vous pouvez choisir le chef de groupe parmi tous les membres.',
    en: 'You can choose the group leader from all members.'
  },
  'groups.chefHintDenied': {
    mg: 'Ny Admin na ny Super Chef manana alalana ihany no afaka manendry Chef de Groupe.',
    fr: "Seul l'Admin ou le Super Chef autorisé peut désigner un chef de groupe.",
    en: 'Only an authorized Admin or Super Chef can assign a group leader.'
  },
  'groups.deleteGroup': { mg: 'Fafao ny Sokajy', fr: 'Supprimer le groupe', en: 'Delete group' },
  'groups.saveChanges': {
    mg: 'Tehirizo ny Fanovana',
    fr: 'Enregistrer les modifications',
    en: 'Save changes'
  },
  'groups.inGroup': { mg: "Ao amin'ny :", fr: 'Dans :', en: 'In:' },
  'groups.searchCandidatePlaceholder': {
    mg: 'Mitady anarana na kaody...',
    fr: 'Rechercher un nom ou un code...',
    en: 'Search by name or code...'
  },
  'groups.noCandidates': {
    mg: "Efa tafiditra ao amin'ity sokajy ity avokoa ny mpikambana rehetra, na tsy misy mifanaraka amin'ny fikarohana.",
    fr: 'Tous les membres sont déjà dans ce groupe, ou aucun ne correspond à la recherche.',
    en: 'All members are already in this group, or none match the search.'
  },
  'groups.currentGroupLabel': { mg: 'Sokajy misy azy :', fr: 'Groupe actuel :', en: 'Current group:' },
  'groups.addAction': { mg: 'Ampidiro', fr: 'Ajouter', en: 'Add' },
  'groups.done': { mg: 'Vita', fr: 'Terminé', en: 'Done' },
  'groups.moveMemberTitle': { mg: 'Hamindra Mpikambana', fr: 'Déplacer un membre', en: 'Move member' },
  'groups.moveMemberIntroPrefix': { mg: "Hamindra an'i", fr: 'Déplacer', en: 'Move' },
  'groups.moveMemberIntroSuffix': {
    mg: "ho amin'ny sokajy hafa :",
    fr: 'vers un autre groupe :',
    en: 'to another group:'
  },
  'groups.selectNewGroup': {
    mg: 'Fidio ny sokajy vaovao :',
    fr: 'Choisissez le nouveau groupe :',
    en: 'Choose the new group:'
  },
  'groups.confirmMove': {
    mg: 'Hamarino ny Famindrana',
    fr: 'Confirmer le déplacement',
    en: 'Confirm move'
  },
  'groups.createTitle': { mg: 'Hanorina Sokajy Vaovao', fr: 'Créer un nouveau groupe', en: 'Create new group' },
  'groups.createNamePlaceholder': {
    mg: 'oh: Feo 5, Tarika Zokiny, sns...',
    fr: 'ex. : Voix 5, Chorale des aînés, etc...',
    en: 'e.g. Voice 5, Senior choir, etc...'
  },
  'groups.createSubmit': { mg: 'Hanorina Sokajy', fr: 'Créer le groupe', en: 'Create group' },
  'groups.otherGroup': { mg: 'sokajy hafa', fr: 'un autre groupe', en: 'another group' },
  'groups.noPermissionCreate': {
    mg: 'Tsy manana alalana hamorona sokajy vaovao ianao.',
    fr: "Vous n'avez pas la permission de créer un nouveau groupe.",
    en: 'You do not have permission to create a new group.'
  },
  'groups.createSuccess': {
    mg: 'Voaforona soa aman-tsara ny sokajy "{name}" !',
    fr: 'Le groupe « {name} » a été créé avec succès !',
    en: 'The group "{name}" was created successfully!'
  },
  'groups.noPermissionEdit': {
    mg: 'Tsy manana alalana hanova ity sokajy ity ianao.',
    fr: "Vous n'avez pas la permission de modifier ce groupe.",
    en: 'You do not have permission to edit this group.'
  },
  'groups.editSuccess': {
    mg: 'Voaova soa aman-tsara ny fandrindrana ny sokajy "{name}" !',
    fr: 'Les paramètres du groupe « {name} » ont été mis à jour avec succès !',
    en: 'The settings of the group "{name}" were updated successfully!'
  },
  'groups.noPermissionDelete': {
    mg: 'Tsy manana alalana hamafa sokajy ianao.',
    fr: "Vous n'avez pas la permission de supprimer un groupe.",
    en: 'You do not have permission to delete a group.'
  },
  'groups.cannotDeleteLast': {
    mg: 'Tsy azo fafana ny sokajy farany.',
    fr: 'Le dernier groupe ne peut pas être supprimé.',
    en: 'The last group cannot be deleted.'
  },
  'groups.deleteConfirm': {
    mg: 'Tena hofafana tokoa ve ny sokajy "{name}" ? Hatao tsy manana sokajy ireo mpikambana ao anatiny.',
    fr: "Voulez-vous vraiment supprimer le groupe « {name} » ? Ses membres n'auront plus de groupe.",
    en: 'Do you really want to delete the group "{name}"? Its members will no longer have a group.'
  },
  'groups.deleteSuccess': {
    mg: 'Voafafa ny sokajy.',
    fr: 'Le groupe a été supprimé.',
    en: 'The group was deleted.'
  },
  'groups.noPermissionAddMember': {
    mg: "Tsy manana alalana hampiditra mpikambana ao amin'ity sokajy ity ianao.",
    fr: "Vous n'avez pas la permission d'ajouter des membres à ce groupe.",
    en: 'You do not have permission to add members to this group.'
  },
  'groups.addMemberSuccess': {
    mg: "Tafiditra soa aman-tsara ao amin'ny sokajy ny mpikambana !",
    fr: 'Le membre a été ajouté au groupe avec succès !',
    en: 'The member was added to the group successfully!'
  },
  'groups.noPermissionRemoveMember': {
    mg: "Tsy manana alalana manala mpikambana amin'ity sokajy ity ianao.",
    fr: "Vous n'avez pas la permission de retirer des membres de ce groupe.",
    en: 'You do not have permission to remove members from this group.'
  },
  'groups.removeMemberConfirm': {
    mg: 'Hesorina ao amin\'ny "{group}" tokoa ve i {name} ?',
    fr: 'Retirer vraiment {name} du groupe « {group} » ?',
    en: 'Really remove {name} from the group "{group}"?'
  },
  'groups.removeMemberSuccess': {
    mg: "Nalana tao amin'ny sokajy i {name}.",
    fr: '{name} a été retiré du groupe.',
    en: '{name} was removed from the group.'
  },
  'groups.noPermissionMoveMember': {
    mg: "Ny Admin na ny Super Chef ihany no afaka mamindra mpikambana ho amin'ny sokajy hafa.",
    fr: "Seul l'Admin ou le Super Chef peut déplacer un membre vers un autre groupe.",
    en: 'Only an Admin or Super Chef can move a member to another group.'
  },
  'groups.moveMemberSuccess': {
    mg: 'Naferina ho ao amin\'ny "{group}" i {name}.',
    fr: '{name} a été déplacé vers « {group} ».',
    en: '{name} was moved to "{group}".'
  },
  'groups.noPermissionAssignChef': {
    mg: 'Tsy manana alalana manendry Chef vaovao ianao.',
    fr: "Vous n'avez pas la permission de désigner un nouveau chef.",
    en: 'You do not have permission to assign a new leader.'
  },
  'groups.promoteConfirm': {
    mg: 'Tendrena ho Chef amin\'ny "{group}" tokoa ve i {name} ?',
    fr: 'Nommer vraiment {name} chef du groupe « {group} » ?',
    en: 'Really make {name} the leader of "{group}"?'
  },
  'groups.promoteSuccess': {
    mg: "I {name} izao no Lehiben'ny {group} !",
    fr: '{name} est désormais le chef de « {group} » !',
    en: '{name} is now the leader of "{group}"!'
  }
};
