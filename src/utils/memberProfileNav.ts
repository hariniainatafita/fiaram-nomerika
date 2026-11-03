export const OPEN_MEMBER_PROFILE_EVENT = 'fiaram:open-member-profile';

/**
 * Opens the read-only profile card of any member, from anywhere in the app
 * (feed, comments, stories, chat, directory...). App listens for the event and
 * renders the profile modal, so views don't need extra prop drilling.
 */
export function openMemberProfile(memberId: string): void {
  if (!memberId) return;
  window.dispatchEvent(
    new CustomEvent(OPEN_MEMBER_PROFILE_EVENT, { detail: { memberId } })
  );
}
