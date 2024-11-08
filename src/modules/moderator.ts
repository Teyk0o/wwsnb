/**
 * Initialize the moderator message highlighting system
 */
function setupModerator() {
    console.log('[WWSNB] Initializing moderator/teacher message highlighting module');

    // Create observer for new messages
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                checkModeratorMessages();
            }
        }
    });

    // Start observing document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Check existing messages
    checkModeratorMessages();
}

/**
 * Check for moderator messages and apply styling
 */
function checkModeratorMessages() {
    // Target all message containers
    const messages = document.querySelectorAll('.sc-leYdVB');

    for (const messageContainer of Array.from(messages)) {
        // Skip already processed messages
        if (messageContainer.hasAttribute('moderator-checked')) {
            continue;
        }
        messageContainer.setAttribute('moderator-checked', 'true');

        // Look for moderator avatar
        const moderatorAvatar = messageContainer.querySelector('[data-test="moderatorAvatar"]');

        if (moderatorAvatar) {
            // Add special styling class
            messageContainer.classList.add('moderator-message');

            // Add MOD badge
            const username = messageContainer.querySelector('.sc-lmONJn span');
            if (username && !username.querySelector('.moderator-badge')) {
                const badge = document.createElement('span');
                badge.className = 'moderator-badge';
                badge.textContent = 'MOD';
                username.appendChild(badge);
            }
        }
    }
}

// Initialize module
setupModerator();