import { getActualUserName } from "./users/user.module.js";
import type {
    ReactionConfig,
    MessageReactions,
    ParsedMessageReaction,
    ParsedReactionData,
    AvailableReaction,
    ReactionElements,
    WebSocketMessage,
    BaseWebSocketMessage,
    ReactionUpdateData,
    ReactionStateData, ReactionData
} from '../../types/reactions.js';

/**
 * Manages all reaction-related functionality using the Singleton pattern
 * Handles WebSocket connections, UI updates, and reaction state management
 */
class ReactionManager {
    private static instance: ReactionManager;
    private messageReactions: MessageReactions = new Map();
    private messageQueue: WebSocketMessage[] = [];
    private ws?: WebSocket;
    private reconnectAttempts = 0;
    private messagesObserver?: MutationObserver;
    private checkInterval?: number;

    private readonly config: ReactionConfig = {
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        checkInterval: 1000,
        wsUrl: 'wss://api.theovilain.com/reactions'
    };

    private readonly availableReactions: AvailableReaction[] = [
        '👍', '❤️', '😂', '😮', '😢', '😡',
        '🎉', '🤔', '👀', '🔥', '✨', '👎'
    ];

    private queueMessage(message: WebSocketMessage): void {
        this.messageQueue.push(message);
        this.processQueue();
    }

    /**
     * Gets the singleton instance of ReactionManager
     * @returns {ReactionManager} The singleton instance
     */
    static getInstance(): ReactionManager {
        if (!ReactionManager.instance) {
            ReactionManager.instance = new ReactionManager();
        }
        return ReactionManager.instance;
    }

    /**
     * Initializes the reaction system
     * Sets up observers, periodic checks, and WebSocket connection
     */
    public setup(): void {
        console.log('[WWSNB] Initializing message reactions module');
        this.setupObserver();
        this.startPeriodicCheck();
        this.checkAndAddReactionButtons();
        this.initializeReactions(this.getSessionToken());
    }

    /**
     * Sets up mutation observers to watch for DOM changes
     * Monitors specific containers and the document body
     */
    private setupObserver(): void {
        const config: MutationObserverInit = {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true
        };

        this.messagesObserver = new MutationObserver(this.handleMutations.bind(this));

        const containers = [
            '.ReactVirtualized__Grid__innerScrollContainer',
            '[data-test="conversation-turns-container"]',
            '.ReactVirtualized__Grid'
        ].map(selector => document.querySelector(selector)).filter(Boolean);

        containers.forEach(container => {
            this.messagesObserver?.observe(container!, config);
        });

        this.messagesObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Checks if WebSocket connection is ready
     * @returns {boolean} True if connection is open and ready
     */
    private isConnectionReady(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Handles DOM mutations and triggers reaction button updates
     * @param {MutationRecord[]} mutations Array of observed mutations
     */
    private handleMutations(mutations: MutationRecord[]): void {
        const shouldCheck = mutations.some(mutation =>
            mutation.type === 'childList' ||
            mutation.type === 'characterData' ||
            (mutation.type === 'attributes' && mutation.attributeName === 'style')
        );

        if (shouldCheck) {
            this.debounce(() => this.checkAndAddReactionButtons(), 100);
        }
    }

    /**
     * Debounces a function call to prevent excessive execution
     * @param {Function} fn Function to debounce
     * @param {number} delay Delay in milliseconds
     */
    private debounce(fn: Function, delay: number): void {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => fn(), delay);
    }
    private debounceTimeout?: number;

    /**
     * Starts periodic checking for new messages that need reaction buttons
     */
    private startPeriodicCheck(): void {
        this.checkInterval = window.setInterval(
            () => this.checkAndAddReactionButtons(),
            this.config.checkInterval
        );
    }

    /**
     * Checks for messages without reaction buttons and adds them
     */
    private checkAndAddReactionButtons(): void {
        const containers = document.querySelectorAll<HTMLElement>('.sc-leYdVB');
        containers.forEach(container => {
            if (!container.dataset.hasReactions) {
                this.addReactionButton(container);
            }
        });
    }

    /**
     * Generates a unique message ID using message content, username and timestamp
     * @param {HTMLElement} container Message container element
     * @returns {string} Unique message identifier
     */
    private generateMessageId(container: HTMLElement): string {
        const selectors = {
            text: '[data-test="chatUserMessageText"]',
            user: '[data-test="chatUserName"]',
            timestamp: '[data-test="chatMessageTimestamp"]'
        };

        const elements = Object.entries(selectors).reduce((acc, [key, selector]) => ({
            ...acc,
            [key]: container.querySelector(selector)?.textContent || ''
        }), {} as Record<keyof typeof selectors, string>);

        const uniqueString = `${elements.user}-${elements.text}-${elements.timestamp}`;
        return `msg-${btoa(encodeURIComponent(uniqueString))
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 32)}`;
    }

    /**
     * Gets current session token from URL parameters
     * @returns {string} Session token or default value
     */
    private getSessionToken(): string {
        return new URLSearchParams(window.location.search).get('sessionToken') || 'default-session';
    }

    /**
     * Initializes reactions system for current session
     * @param {string} sessionToken Current session token
     */
    private initializeReactions(sessionToken: string): void {
        this.connectWebSocket(sessionToken);
        this.loadReactionsFromStorage(sessionToken);
    }

    /**
     * Establishes WebSocket connection
     * @param {string} sessionToken Current session token
     */
    private connectWebSocket(sessionToken: string): void {
        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(this.config.wsUrl);
        this.setupWebSocketHandlers(sessionToken);
    }

    /**
     * Sets up WebSocket event handlers
     * @param {string} sessionToken Current session token
     */
    private setupWebSocketHandlers(sessionToken: string): void {
        if (!this.ws) return;

        this.ws.onopen = () => {
            console.log('[WWSNB] WebSocket connected');
            this.reconnectAttempts = 0;
            this.sendInitialState(sessionToken);
            // Traiter la file d'attente après la reconnexion
            this.processQueue();
        };

        this.ws.onmessage = this.handleWebSocketMessage.bind(this);
        this.ws.onclose = () => this.handleReconnection(sessionToken);
        this.ws.onerror = (error) => {
            console.error('[WWSNB] WebSocket error:', (error as ErrorEvent).message || 'Unknown error');
            this.handleReconnection(sessionToken);
        };
    }

    /**
     * Handles WebSocket message events
     * @param {MessageEvent} event WebSocket message event
     */
    private handleWebSocketMessage(event: MessageEvent): void {
        try {
            const data = JSON.parse(event.data) as ReactionData;
            if (data.type === 'update_reactions') {
                this.updateReactionsState(data.reactions);
            }
        } catch (error) {
            console.error('[WWSNB] Error handling WebSocket message:', error);
        }
    }

    /**
     * Updates reaction state and UI from WebSocket data
     * @param {string} reactionsData Stringified reactions data
     */
    private updateReactionsState(reactionsData: string): void {
        try {
            const parsedReactions = JSON.parse(reactionsData) as ParsedMessageReaction[];

            this.messageReactions = new Map(
                parsedReactions.map((data: ParsedMessageReaction) => [
                    data.messageId,
                    new Map(data.reactions.map((r: ParsedReactionData) => [r.emoji, r.users]))
                ])
            );

            this.updateAllReactionDisplays();
        } catch (error) {
            console.error('[WWSNB] Error updating reactions state:', error);
        }
    }

    /**
     * Sends initial reactions state through WebSocket
     * @param {string} sessionToken Current session token
     */
    private sendInitialState(sessionToken: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const message: BaseWebSocketMessage<'update_reactions', ReactionStateData> = {
            type: 'update_reactions',
            sessionToken,
            data: {
                reactions: JSON.stringify(Array.from(this.messageReactions.entries()))
            }
        };

        this.ws.send(JSON.stringify(message));
    }

    /**
     * Handles WebSocket reconnection attempts
     * @param {string} sessionToken Current session token
     */
    private handleReconnection(sessionToken: string): void {
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[WWSNB] Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
            setTimeout(() => this.connectWebSocket(sessionToken), this.config.reconnectDelay);
        } else {
            console.error('[WWSNB] Max reconnection attempts reached');
        }
    }

    /**
     * Loads reactions from localStorage for the current session
     * @param {string} sessionToken Current session token
     */
    private loadReactionsFromStorage(sessionToken: string): void {
        try {
            const storageKey = `wwsnb_reactions_${sessionToken}`;
            const saved = localStorage.getItem(storageKey);

            if (saved) {
                const reactionsObj = JSON.parse(saved);
                this.messageReactions = new Map();

                for (const [messageId, reactions] of Object.entries(reactionsObj)) {
                    const messageReactionMap = new Map<string, string[]>();
                    for (const [emoji, users] of Object.entries(reactions as { [key: string]: string[] })) {
                        messageReactionMap.set(emoji, Array.isArray(users) ? users : []);
                    }
                    this.messageReactions.set(messageId, messageReactionMap);
                }
            }
            this.updateAllReactionDisplays();
        } catch (error) {
            console.error('[WWSNB] Error loading reactions:', error);
            this.messageReactions = new Map();
        }
    }

    /**
     * Saves reactions to localStorage
     */
    private saveToLocalStorage(sessionToken: string): void {
        const storageKey = `wwsnb_reactions_${sessionToken}`;
        const reactionsObj = Object.fromEntries(
            Array.from(this.messageReactions.entries()).map(([messageId, reactions]) => [
                messageId,
                Object.fromEntries(reactions)
            ])
        );
        localStorage.setItem(storageKey, JSON.stringify(reactionsObj));
    }

    /**
     * Updates reaction displays for all messages in the UI
     */
    private updateAllReactionDisplays(): void {
        const containers = document.querySelectorAll<HTMLElement>('.sc-leYdVB');
        containers.forEach(messageContainer => {
            const messageId = messageContainer.dataset.messageId || this.generateMessageId(messageContainer);
            messageContainer.dataset.messageId = messageId;

            if (this.messageReactions.has(messageId)) {
                this.ensureReactionsContainer(messageContainer);
                this.updateReactionDisplay(messageId, messageContainer);
                messageContainer.dataset.hasReactions = 'true';
            }
        });
    }

    /**
     * Ensures a reactions container exists for a message
     * @param {HTMLElement} messageContainer Message container element
     * @returns {HTMLElement} Reactions container element
     */
    private ensureReactionsContainer(messageContainer: HTMLElement): HTMLElement {
        let container = messageContainer.querySelector<HTMLElement>('.reactions-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'reactions-container';
            messageContainer.appendChild(container);
        }
        return container;
    }

    /**
     * Adds or removes a reaction from a message
     * @param {string} messageId Message identifier
     * @param {string} emoji Reaction emoji
     */
    private async addReaction(messageId: string, emoji: string): Promise<void> {
        const currentUserName = getActualUserName();
        if (!currentUserName) {
            console.error('[WWSNB] User name is not defined');
            return;
        }

        try {
            // Envoyer la mise à jour au serveur d'abord
            await this.sendReactionUpdate(messageId, emoji, currentUserName);

            // La mise à jour locale se fait après la confirmation du serveur
            this.updateLocalReaction(messageId, emoji, currentUserName);
            this.updateMessageReactions(messageId);
            this.saveToLocalStorage(this.getSessionToken());
        } catch (error) {
            console.error('[WWSNB] Failed to update reaction:', error);
        }
    }

    /**
     * Updates reaction display for a specific message
     * @param {string} messageId Message identifier
     */
    private updateMessageReactions(messageId: string): void {
        const messageContainer = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
        if (messageContainer) {
            const reactionsContainer = this.ensureReactionsContainer(messageContainer);
            this.updateReactionDisplay(messageId, reactionsContainer);
        }
    }

    /**
     * Updates reaction display for a specific message
     * @param {string} messageId Message identifier
     * @param {HTMLElement} container Reactions container element
     */
    private updateReactionDisplay(messageId: string, container: HTMLElement): void {
        this.clearContainer(container);
        const reactions = this.messageReactions.get(messageId) || new Map();
        const currentUserName = getActualUserName();

        // Check if username is defined
        if (!currentUserName) {
            console.error('[WWSNB] User name is not defined');
            return;
        }

        for (const [emoji, users] of reactions) {
            const badge = this.createReactionBadge(emoji, users, currentUserName);
            badge.addEventListener('click', () => this.addReaction(messageId, emoji));
            container.appendChild(badge);
        }
    }

    /**
     * Safely clears a container's contents
     * @param {HTMLElement} container Container to clear
     */
    private clearContainer(container: HTMLElement): void {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }

    /**
     * Creates a reaction badge element
     * @param {string} emoji Reaction emoji
     * @param {string[]} users Users who reacted
     * @param {string} currentUser Current username
     * @returns {HTMLElement} Reaction badge element
     */
    private createReactionBadge(emoji: string, users: string[], currentUser: string): HTMLElement {
        const badge = document.createElement('div');
        badge.className = 'reaction-badge';

        if (currentUser && users.includes(currentUser)) {
            badge.style.backgroundColor = '#bbdefb';
        }

        const emojiElement = this.createEmojiElement(emoji, users.length.toString());
        badge.appendChild(emojiElement);
        badge.setAttribute('title', users.join(', '));

        return badge;
    }

    /**
     * Creates an emoji element with count
     * @param {string} emoji Emoji character
     * @param {string} count Reaction count
     * @returns {HTMLElement} Emoji element
     */
    private createEmojiElement(emoji: string, count: string): HTMLElement {
        const span = document.createElement('span');
        span.appendChild(document.createTextNode(emoji));
        span.appendChild(document.createTextNode(` ${count}`));
        return span;
    }

    /**
     * Adds reaction button and container to a message
     * @param {HTMLElement} messageContainer Message container element
     */
    private addReactionButton(messageContainer: HTMLElement): void {
        if (messageContainer.dataset.hasReactions === 'true') return;

        const messageId = this.generateMessageId(messageContainer);
        messageContainer.dataset.messageId = messageId;
        messageContainer.dataset.hasReactions = 'true';

        const { reactionsWrapper, reactionsContainer } = this.createReactionElements();
        const reactionButton = this.createReactionButton(messageId);

        messageContainer.appendChild(reactionButton);
        messageContainer.appendChild(reactionsWrapper);

        if (!this.messageReactions.has(messageId)) {
            this.messageReactions.set(messageId, new Map());
        }

        this.updateReactionDisplay(messageId, reactionsContainer);
    }

    /**
     * Creates reaction wrapper and container elements
     * @returns {Object} Object containing wrapper and container elements
     */
    private createReactionElements(): ReactionElements {
        const reactionsWrapper = document.createElement('div');
        reactionsWrapper.className = 'reactions-wrapper';

        const reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'reactions-container';
        reactionsWrapper.appendChild(reactionsContainer);

        return { reactionsWrapper, reactionsContainer };
    }

    /**
     * Creates the reaction button element
     * @param {string} messageId Message identifier
     * @returns {HTMLElement} Reaction button element
     */
    private createReactionButton(messageId: string): HTMLElement {
        const button = document.createElement('button');
        button.className = 'reaction-button';
        button.appendChild(document.createTextNode('😀'));
        button.setAttribute('title', 'Add reaction');

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showReactionPicker(messageId, button);
        });

        return button;
    }

    /**
     * Shows the reaction picker menu
     * @param {string} messageId Message identifier
     * @param {HTMLElement} buttonElement Button that triggered the picker
     */
    private showReactionPicker(messageId: string, buttonElement: HTMLElement): void {
        const existingPicker = document.querySelector('.reaction-picker');
        existingPicker?.remove();

        const picker = this.createReactionPicker(messageId);
        this.positionPicker(picker, buttonElement);
        document.body.appendChild(picker);

        this.setupPickerClickOutside(picker, buttonElement);
    }

    /**
     * Creates the reaction picker element
     * @param {string} messageId Message identifier
     * @returns {HTMLElement} Reaction picker element
     */
    private createReactionPicker(messageId: string): HTMLElement {
        const picker = document.createElement('div');
        picker.className = 'reaction-picker';

        this.availableReactions.forEach(emoji => {
            const button = document.createElement('button');
            button.appendChild(document.createTextNode(emoji));
            button.addEventListener('click', () => {
                this.addReaction(messageId, emoji);
                picker.remove();
            });
            picker.appendChild(button);
        });

        return picker;
    }

    /**
     * Positions the reaction picker relative to the button
     * @param {HTMLElement} picker Reaction picker element
     * @param {HTMLElement} buttonElement Button element
     */
    private positionPicker(picker: HTMLElement, buttonElement: HTMLElement): void {
        const rect = buttonElement.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.left = `${rect.left - picker.offsetWidth / 2 + buttonElement.offsetWidth / 2}px`;
        picker.style.top = `${rect.top - 10 - picker.offsetHeight}px`;
    }

    /**
     * Sets up click outside handler for the reaction picker
     * @param {HTMLElement} picker Reaction picker element
     * @param {HTMLElement} buttonElement Button element
     */
    private setupPickerClickOutside(picker: HTMLElement, buttonElement: HTMLElement): void {
        const handleClickOutside = (e: MouseEvent) => {
            if (!picker.contains(e.target as Node) && e.target !== buttonElement) {
                picker.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        };

        document.addEventListener('click', handleClickOutside);
    }

    /**
     * Processes the message queue
     * @returns {Promise<void>}
     */
    private async processQueue(): Promise<void> {
        if (this.isConnectionReady() && this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                try {
                    await this.sendMessage(message);
                    await this.processQueue();
                } catch (error) {
                    // En cas d'échec, remettre le message dans la file
                    this.messageQueue.unshift(message);
                    console.error('[WWSNB] Failed to send message:', error);
                }
            }
        }
    }

    /**
     * Sends a reaction update to the server
     * @param {string} messageId Message identifier
     * @param {string} emoji Reaction emoji
     * @param {string} userId User identifier
     * @returns {Promise<void>}
     */
    private async sendReactionUpdate(messageId: string, emoji: string, userId: string): Promise<void> {
        const message: BaseWebSocketMessage<'reaction_update', ReactionUpdateData> = {
            type: 'reaction_update',
            data: {
                messageId,
                emoji,
                userId,
                action: this.getReactionAction(messageId, emoji, userId)
            }
        };

        if (this.isConnectionReady()) {
            await this.sendMessage(message);
        } else {
            this.queueMessage(message);
        }
    }

    /**
     * Determines if this is an add or remove reaction action
     * @param {string} messageId Message identifier
     * @param {string} emoji Reaction emoji
     * @param {string} userId User identifier
     * @returns {'add' | 'remove'} Action type
     */
    private getReactionAction(messageId: string, emoji: string, userId: string): 'add' | 'remove' {
        const reactions = this.messageReactions.get(messageId);
        const users = reactions?.get(emoji) || [];
        return users.includes(userId) ? 'remove' : 'add';
    }

    /**
     * Sends a message through WebSocket
     * @param {Object} message Message to send
     * @param timeout Timeout in milliseconds
     * @returns {Promise<void>}
     */
    private async sendMessage(message: WebSocketMessage, timeout: number = 5000): Promise<void> {
        if (!this.ws || !this.isConnectionReady()) {
            throw new Error('WebSocket connection not ready');
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('WebSocket message timeout'));
            }, timeout);

            try {
                this.ws!.send(JSON.stringify(message));
                clearTimeout(timeoutId);
                resolve();
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Updates the local reaction state
     * @param {string} messageId Message identifier
     * @param {string} emoji Reaction emoji
     * @param {string} userId User identifier
     * @private
     */
    private updateLocalReaction(messageId: string, emoji: string, userId: string): void {
        const reactions = this.messageReactions.get(messageId) || new Map<string, string[]>();
        const users = reactions.get(emoji) || [];
        const isRemoving = users.includes(userId);

        if (isRemoving) {
            const updatedUsers = users.filter(user => user !== userId);
            if (updatedUsers.length === 0) {
                reactions.delete(emoji);
            } else {
                reactions.set(emoji, updatedUsers);
            }
        } else {
            reactions.set(emoji, [...users, userId]);
        }

        this.messageReactions.set(messageId, reactions);
    }

    /**
     * Cleans up resources and disconnects WebSocket
     * @param {boolean} isRefresh Indicates if this is a page refresh
     */
    public cleanup(isRefresh: boolean = false): void {

        this.messagesObserver?.disconnect();
        clearInterval(this.checkInterval);

        if (this.ws) {
            if (isRefresh) {
                this.ws.close(1000, 'Page refresh');
            } else {
                this.ws.close();
            }
        }

        if (isRefresh) {
            try {
                const sessionToken = this.getSessionToken();
                this.saveToLocalStorage(sessionToken);
            } catch (error) {
                console.error('[WWSNB] Failed to save state during refresh:', error);
            }
        } else {
            try {
                localStorage.removeItem(`wwsnb_reactions_${this.getSessionToken()}`);
            } catch (error) {
                console.error('[WWSNB] Failed to clean localStorage:', error);
            }
        }
    }
}

// Export singleton instance
export const reactionManager = ReactionManager.getInstance();