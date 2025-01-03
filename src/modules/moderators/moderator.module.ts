export function checkForModeratorMessages(message: HTMLElement) {

    if (message.dataset.moderatorChecked === 'true') {
        return;
    }
    message.dataset.moderatorChecked = 'true';

    // Get parent with role="listitem"
    const parent = message.closest('[role="listitem"]') as HTMLElement;

    // Look for moderator avatar
    const moderatorAvatar = parent.querySelector('[data-test="moderatorAvatar"]');
    if (moderatorAvatar) {
        addClassModerator(parent);
    }
}

export function addClassModerator(message: HTMLElement) {
    // Add special styling class
    message.classList.add('moderator-message');

    // Add MOD badge
    const username = message.querySelector('.sc-lmONJn span');
    if (username && !username.querySelector('.moderator-badge')) {
        const badge = document.createElement('span');
        badge.className = 'moderator-badge';
        badge.textContent = 'MOD';
        username.appendChild(badge);
    }
}