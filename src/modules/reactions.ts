import { getActualUserName } from "../user/get";

// Global variables for reactions system
let messageReactions = new Map();
let reactionChannel: BroadcastChannel;

// Available reaction emojis
const availableReactions = [
    '👍', '❤️', '😂', '😮', '😢', '😡',
    '🎉', '🤔', '👀', '🔥', '✨', '👎'
];

// Helper function to safely create text node
function createSafeTextNode(text :string) {
    return document.createTextNode(text);
}

// Helper function to safely create emoji element
function createEmojiElement(emoji:string, count:number) {
    const span = document.createElement('span');
    span.appendChild(createSafeTextNode(emoji));
    span.appendChild(createSafeTextNode(` ${count}`));
    return span;
}

/**
 * Initialize the reactions system
 */
export function setupReactions() {
    console.log('[WWSNB] Initializing message reactions module');

    // Configure mutation observer
    const config = {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
    };

    // Create observer for new messages
    const messagesObserver = new MutationObserver((mutations) => {
        let shouldCheckMessages = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList' ||
                mutation.type === 'characterData' ||
                (mutation.type === 'attributes' && mutation.attributeName === 'style')) {
                shouldCheckMessages = true;
            }
        }

        if (shouldCheckMessages) {
            setTimeout(checkAndAddReactionButtons, 100);
        }
    });

    // Start observing the main containers
    const virtualizedGrid = document.querySelector('.ReactVirtualized__Grid__innerScrollContainer');
    const chatContainer = document.querySelector('[data-test="conversation-turns-container"]');
    const virtualGrid = document.querySelector('.ReactVirtualized__Grid');

    if (virtualizedGrid) {
        messagesObserver.observe(virtualizedGrid, config);
    }

    if (chatContainer) {
        messagesObserver.observe(chatContainer, config);
    }

    if (virtualGrid) {
        window.wwsnbVirtualGrid = virtualGrid;
    }

    // Observe body for structure changes
    messagesObserver.observe(document.body, config);
    

    // Set up periodic check for new messages
    setInterval(checkAndAddReactionButtons, 1000);

    // Initial setup
    checkAndAddReactionButtons();

    // Initialize reactions with current session
    initializeReactions(getSessionToken());
}

/**
 * Add reaction buttons to new messages
 */
function checkAndAddReactionButtons() {
    const containers = document.querySelectorAll('.sc-leYdVB');
    for (const messageContainer of containers) {
        const container = messageContainer as HTMLElement;
        if (!container.dataset.hasReactions) {
            addReactionButton(container);
        }
    }
}

/**
 * Generate a unique ID for a message using content, username and timestamp
 * @param {HTMLElement} messageContainer The message container element
 * @returns {string} A unique message ID
 */
function generateMessageId(messageContainer: HTMLElement) {
    // Get message text
    const messageText = messageContainer.querySelector('[data-test="chatUserMessageText"]')?.textContent || '';

    // Get username (full path to ensure we get the correct element)
    const userNameElement = messageContainer.querySelector('[data-test="chatUserName"]');
    const userName = userNameElement?.textContent || '';

    // Get timestamp and parse it
    const timestampElement = messageContainer.querySelector('[data-test="chatMessageTimestamp"]');
    const timestamp = timestampElement?.textContent || '';

    // Create a string combining all elements
    const uniqueString = `${userName}-${messageText}-${timestamp}`;

    // Create a hash of the combined string
    const hash = btoa(encodeURIComponent(uniqueString))
        .replace(/[^a-zA-Z0-9]/g, '')  // Remove non-alphanumeric characters
        .substring(0, 32);              // Limit length

    return `msg-${hash}`;
}

/**
 * Get current session token from URL
 * @returns {string} Session token or default value
 */
function getSessionToken() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionToken') || 'default-session';
}

/**
 * Initialize reactions system for current session
 * @param {string} sessionToken Current session token
 */
function initializeReactions(sessionToken:string) {
    const channelId = `wwsnb_reactions_${sessionToken}`;

    if (reactionChannel) {
        reactionChannel.close();
    }

    reactionChannel = new BroadcastChannel(channelId);
    reactionChannel.onmessage = handleReactionUpdate;

    loadReactionsFromStorage(sessionToken);
}

/**
 * Handle reaction updates from broadcast channel
 * @param {MessageEvent} event Broadcast channel message event
 */
function handleReactionUpdate(event:MessageEvent) {
    if (event.data.type === 'update_reactions') {
        try {
            const parsedReactions: [string, any][] = JSON.parse(event.data.reactions);
            messageReactions = new Map(
                parsedReactions.map(([key, value]) => [
                    key,
                    new Map(Object.entries(value))
                ])
            );
            updateAllReactionDisplays();
        } catch (error) {
            console.error('[WWSNB] Error updating reactions:', error);
        }
    }
}

/**
 * Save reactions to localStorage and broadcast update
 */
function saveReactionsToStorage() {
    const sessionToken = getSessionToken();
    try {
        // Clean up reactions for non-existent messages
        const existingMessageIds = new Set(
            Array.from(document.querySelectorAll('.sc-leYdVB'))
                .map(container => container.dataset.messageId)
                .filter(Boolean)
        );

        const cleanedReactions = new Map();
        messageReactions.forEach((reactions, messageId) => {
            if (existingMessageIds.has(messageId)) {
                cleanedReactions.set(messageId, reactions);
            }
        });

        messageReactions = cleanedReactions;

        // Convert and save
        const reactionsObj: { [key: string]: Record<string, string[]> } = {};
        for (const [messageId, reactions] of messageReactions) {
            reactionsObj[messageId] = Object.fromEntries(reactions);
        }

        const storageKey = `wwsnb_reactions_${sessionToken}`;
        localStorage.setItem(storageKey, JSON.stringify(reactionsObj));

        // Broadcast to other users
        if (reactionChannel) {
            reactionChannel.postMessage({
                type: 'update_reactions',
                reactions: JSON.stringify(Array.from(messageReactions.entries()))
            });
        }
    } catch (error) {
        console.error('[WWSNB] Error saving reactions:', error);
    }
}

/**
 * Load reactions from localStorage
 * @param {string} sessionToken Current session token
 */
function loadReactionsFromStorage(sessionToken:string) {
    try {
        const storageKey = `wwsnb_reactions_${sessionToken}`;
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            const reactionsObj = JSON.parse(saved);
            messageReactions = new Map();

            for (const [messageId, reactions] of Object.entries(reactionsObj)) {
                const messageReactionMap = new Map<string, string[]>();
                for (const [emoji, users] of Object.entries(reactions as { [key: string]: string[] })) {
                    messageReactionMap.set(emoji, Array.isArray(users) ? users : []);
                }
                messageReactions.set(messageId, messageReactionMap);
            };
        } else {
            messageReactions = new Map();
        }

        updateAllReactionDisplays();
    } catch (error) {
        console.error('[WWSNB] Error loading reactions:', error);
        messageReactions = new Map();
    }
}

/**
 * Update all reaction displays in the UI
 */
function updateAllReactionDisplays() {
    const containers = document.querySelectorAll('.sc-leYdVB');

    for (const messageContainer of containers) {
        const container = messageContainer as HTMLElement;
        const messageId = container.dataset.messageId || generateMessageId(container);
        container.dataset.messageId = messageId;
    
        if (messageReactions.has(messageId)) {
            const reactionsContainer = container.querySelector('.reactions-container');
            if (!reactionsContainer) {
                const newReactionsContainer = document.createElement('div');
                newReactionsContainer.className = 'reactions-container';
                container.appendChild(newReactionsContainer);
            }
    
            updateReactionDisplay(messageId, reactionsContainer);
            container.dataset.hasReactions = 'true';
        }
    }
}

/**
 * Add or remove a reaction from a message
 * @param {string} messageId Message ID
 * @param {string} emoji Reaction emoji
 */
function addReaction(messageId:string, emoji:string) {
    const reactions = messageReactions.get(messageId) || new Map();
    const userName = getActualUserName();

    if (reactions.has(emoji) && reactions.get(emoji).includes(userName)) {
        const users = reactions.get(emoji).filter((user:string) => user !== userName);
        if (users.length === 0) {
            reactions.delete(emoji);
        } else {
            reactions.set(emoji, users);
        }
    } else {
        if (!reactions.has(emoji)) {
            reactions.set(emoji, []);
        }
        reactions.get(emoji).push(userName);
    }

    messageReactions.set(messageId, reactions);

    // Immediately update the display for this specific message
    const messageContainer = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
    if (messageContainer) {
        const reactionsContainer = messageContainer.querySelector('.reactions-container') as HTMLElement ;
        if (reactionsContainer) {
            updateReactionDisplay(messageId, reactionsContainer);
        }
    }

    // Then save and broadcast
    saveReactionsToStorage();
}

/**
 * Update the reaction display for a specific message
 * @param {string} messageId Message ID
 * @param {HTMLElement} container Reactions container element
 */
function updateReactionDisplay(messageId:string, container:HTMLElement) {
    // Clear existing content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const reactions = messageReactions.get(messageId) || new Map();
    const userName = getActualUserName() as string;

    reactions.forEach((users:string[], emoji:string) => {
        const badge = document.createElement('div');
        badge.className = 'reaction-badge';

        if (users.includes(userName)) {
            badge.style.backgroundColor = '#bbdefb';
        }

        const emojiElement = createEmojiElement(emoji, users.length);
        badge.appendChild(emojiElement);
        badge.setAttribute('title', users.join(', '));
        badge.addEventListener('click', () => addReaction(messageId, emoji));
        container.appendChild(badge);
    });
}

/**
 * Add reaction button to a message container
 * @param {HTMLElement} messageContainer The message container element
 */
function addReactionButton(messageContainer: HTMLElement) {
    if (messageContainer.dataset.hasReactions === 'true') {
        return;
    }

    const messageId = generateMessageId(messageContainer);
    messageContainer.dataset.messageId = messageId;
    messageContainer.dataset.hasReactions = 'true';

    // Create reactions wrapper and container
    const reactionsWrapper = document.createElement('div');
    reactionsWrapper.className = 'reactions-wrapper';

    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'reactions-container';
    reactionsWrapper.appendChild(reactionsContainer);

    // Create and add reaction button
    const reactionButton = document.createElement('button');
    reactionButton.className = 'reaction-button';
    // Safely add emoji
    reactionButton.appendChild(createSafeTextNode('😀'));
    reactionButton.setAttribute('title', 'Add reaction');
    messageContainer.appendChild(reactionButton);

    // Add reactions wrapper
    messageContainer.appendChild(reactionsWrapper);

    // Initialize reactions for this message
    if (!messageReactions.has(messageId)) {
        messageReactions.set(messageId, new Map());
    }

    updateReactionDisplay(messageId, reactionsContainer);

    // Add click handler for reaction button
    reactionButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showReactionPicker(messageId, reactionButton);
    });
}

/**
 * Show reaction picker menu
 * @param {string} messageId The ID of the message
 * @param {HTMLButtonElement} buttonElement The button that triggered the picker
 */
function showReactionPicker(messageId:string, buttonElement: HTMLButtonElement) {
    // Remove any existing picker
    const existingPicker = document.querySelector('.reaction-picker');
    if (existingPicker) {
        existingPicker.remove();
    }

    // Create new picker
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';

    // Add available reactions
    for (const emoji of availableReactions) {
        const button = document.createElement('button');
        button.appendChild(createSafeTextNode(emoji));
        button.addEventListener('click', () => {
            addReaction(messageId, emoji);
            picker.remove();
        });
        picker.appendChild(button);
    }

    // Position picker relative to button
    const rect = buttonElement.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.left = `${rect.left - picker.offsetWidth / 2 + buttonElement.offsetWidth / 2}px`;
    picker.style.top = `${rect.top - 10 - picker.offsetHeight}px`;

    document.body.appendChild(picker);

    // Close picker when clicking outside
    document.addEventListener('click', function closePickerOnClickOutside(e) {
        if (!picker.contains(e.target) && e.target !== buttonElement) {
            picker.remove();
            document.removeEventListener('click', closePickerOnClickOutside);
        }
    });
}