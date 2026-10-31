import { Groupe, Membre, Role, SuperChefPermissions } from '../types';
import { StorageService } from './storage';

export type AccessLevel = 'admin' | 'chef' | 'membre';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  super_chef: 'Super Chef',
  chef: 'Chef Sokajy',
  membre: 'Mpikambana'
};

export const DEFAULT_SUPER_CHEF_PERMISSIONS: SuperChefPermissions = {
  view_all_members: true,
  manage_groups: true,
  manage_chefs: true,
  validate_presences: true,
  view_global_finance: true,
  manage_cotisations: true
};

export function getAccessLevel(user?: Membre | null): AccessLevel {
  if (!user) return 'membre';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'chef' || user.role === 'super_chef') return 'chef';
  return 'membre';
}

export function isAdmin(user?: Membre | null): boolean {
  return user?.role === 'admin';
}

export function isSuperChef(user?: Membre | null): boolean {
  return user?.role === 'super_chef';
}

export function isChef(user?: Membre | null): boolean {
  return user?.role === 'chef' || user?.role === 'super_chef';
}

export function isSimpleMember(user?: Membre | null): boolean {
  return !user || user.role === 'membre';
}

export function getSuperChefPermissions(user?: Membre | null): SuperChefPermissions {
  if (!isSuperChef(user)) return { ...DEFAULT_SUPER_CHEF_PERMISSIONS, view_all_members: false };
  const settings = StorageService.getAdminSettings();
  return { ...DEFAULT_SUPER_CHEF_PERMISSIONS, ...settings.super_chef_permissions };
}

export function superChefCan(
  user: Membre | null | undefined,
  permission: keyof SuperChefPermissions
): boolean {
  if (!isSuperChef(user)) return false;
  return getSuperChefPermissions(user)[permission];
}

export function canManageBadges(user?: Membre | null): boolean {
  return isAdmin(user);
}

export function canCreateEvenement(user?: Membre | null): boolean {
  return isAdmin(user) || isSuperChef(user) || user?.role === 'chef';
}

export function canAccessAdminPanel(user?: Membre | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return superChefCan(user, 'view_all_members');
}

export function canManageAllGroups(user?: Membre | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return superChefCan(user, 'manage_groups');
}

export function canManageChefs(user?: Membre | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return superChefCan(user, 'manage_chefs');
}

export function canManageGroup(
  user: Membre | null | undefined,
  groupe: Groupe | null | undefined
): boolean {
  if (!user || !groupe) return false;
  if (isAdmin(user)) return true;
  if (isSuperChef(user)) return superChefCan(user, 'manage_groups');
  return user.role === 'chef' && groupe.chef_id === user.id;
}

export function getManagedGroupIds(
  user: Membre | null | undefined,
  groupes: Groupe[]
): string[] {
  if (!user) return [];
  if (isAdmin(user)) return groupes.map((g) => g.id);
  if (isSuperChef(user)) {
    return superChefCan(user, 'manage_groups') ? groupes.map((g) => g.id) : [];
  }
  if (user.role === 'chef') {
    return groupes.filter((g) => g.chef_id === user.id).map((g) => g.id);
  }
  return [];
}

function canManageGroupMember(
  user: Membre,
  target: Membre,
  groupes: Groupe[],
  allAccess: boolean
): boolean {
  if (target.id === user.id) return true;
  if (allAccess) return true;
  if (user.role !== 'chef') return false;
  const managedIds = getManagedGroupIds(user, groupes);
  return !!target.groupe_id && managedIds.includes(target.groupe_id);
}

export function canManageMembre(
  user: Membre | null | undefined,
  target: Membre | null | undefined,
  groupes: Groupe[]
): boolean {
  if (!user || !target) return false;
  return canManageGroupMember(user, target, groupes, canManageAllGroups(user));
}

export function canValidatePresence(
  user: Membre | null | undefined,
  target: Membre | null | undefined,
  groupes: Groupe[]
): boolean {
  if (!user || !target) return false;
  if (isAdmin(user)) return true;
  return canManageGroupMember(
    user,
    target,
    groupes,
    isSuperChef(user) && superChefCan(user, 'validate_presences')
  );
}

export function canValidateAnyPresence(user?: Membre | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isSuperChef(user)) return superChefCan(user, 'validate_presences');
  return user.role === 'chef';
}

export function canManageCotisation(
  user: Membre | null | undefined,
  target: Membre | null | undefined,
  groupes: Groupe[]
): boolean {
  if (!user || !target) return false;
  if (isAdmin(user)) return true;
  return canManageGroupMember(
    user,
    target,
    groupes,
    isSuperChef(user) && superChefCan(user, 'manage_cotisations')
  );
}

export function canManageAnyCotisation(user?: Membre | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isSuperChef(user)) return superChefCan(user, 'manage_cotisations');
  return user.role === 'chef';
}

export function canViewAllFinances(user?: Membre | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return superChefCan(user, 'view_global_finance');
}

export function canAccessFinance(user?: Membre | null): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isSuperChef(user)) {
    return superChefCan(user, 'view_global_finance');
  }
  return user.role === 'chef';
}

export function canManageFinanceForGroup(
  user: Membre | null | undefined,
  groupe: Groupe | null | undefined
): boolean {
  if (!user || !groupe) return false;
  if (isAdmin(user)) return true;
  if (isSuperChef(user)) return superChefCan(user, 'manage_groups');
  return user.role === 'chef' && groupe.chef_id === user.id;
}

export const GROUP_SCOPED_VIEWS = ['dashboard', 'presence', 'cotisations', 'groups', 'events'];

export function canAccessGroupData(user?: Membre | null): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'super_chef' || user.role === 'chef') return true;
  return Boolean(user.groupe_id);
}

export function getMemberGroup(
  user: Membre | null | undefined,
  groupes: Groupe[]
): Groupe | undefined {
  if (!user) return undefined;
  if (user.groupe_id) {
    const ownGroup = groupes.find((g) => g.id === user.groupe_id);
    if (ownGroup) return ownGroup;
  }
  return groupes.find((g) => g.chef_id === user.id);
}

export function getVisibleGroupIds(
  user: Membre | null | undefined,
  groupes: Groupe[]
): string[] {
  if (!user) return [];
  if (isAdmin(user) || isSuperChef(user)) return groupes.map((g) => g.id);

  const ids = new Set<string>();
  if (user.role === 'chef') {
    groupes.filter((g) => g.chef_id === user.id).forEach((g) => ids.add(g.id));
  }
  if (user.groupe_id) ids.add(user.groupe_id);
  // Groupes Messenger : visibles uniquement par leurs participants.
  groupes
    .filter((g) => g.is_messenger && (g.membre_ids || []).includes(user.id))
    .forEach((g) => ids.add(g.id));
  return [...ids];
}

export function canViewEvenement(
  user: Membre | null | undefined,
  evenement: { groupe_id?: string },
  groupes: Groupe[]
): boolean {
  if (!user) return false;
  if (isAdmin(user) || isSuperChef(user)) return true;
  if (!evenement.groupe_id) return true;
  return getVisibleGroupIds(user, groupes).includes(evenement.groupe_id);
}

export function canViewPublication(
  user: Membre | null | undefined,
  publication: { auteur_id: string; audience?: 'all' | 'group'; groupe_id?: string },
  groupes: Groupe[]
): boolean {
  if (!user) return false;
  if (isAdmin(user) || isSuperChef(user)) return true;
  if (publication.audience !== 'group' || !publication.groupe_id) return true;
  if (publication.auteur_id === user.id) return true;
  return getVisibleGroupIds(user, groupes).includes(publication.groupe_id);
}

export function canAccessView(
  user: Membre | null | undefined,
  view: string
): boolean {
  if (!user) return false;
  if (view === 'admin') return canAccessAdminPanel(user);
  if (view === 'finance') return canAccessFinance(user);
  if (GROUP_SCOPED_VIEWS.includes(view)) return canAccessGroupData(user);
  return true;
}
