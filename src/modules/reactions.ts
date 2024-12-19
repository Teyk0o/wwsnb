import { wsManager } from "@/managers/websocket.manager";
import {
    AvailableReaction,
    MessageReactions,
    ReactionConfig,
    ReactionElements, ReactionManagerConfig,
} from '../../types/reactions.js';
import { forceReflow } from "../utils/chat";
import {getActualUserName} from "@/modules/users/user.module";

/**
 * Gère toutes les fonctionnalités liées aux réactions aux messages
 * Utilise le pattern Singleton et délègue la communication WebSocket au gestionnaire centralisé
 */
class ReactionManager {
    private static instance: ReactionManager;
    private messageReactions: MessageReactions = new Map();
    private messagesObserver?: MutationObserver;
    private checkInterval?: number;
    private debounceTimeout?: ReturnType<typeof setTimeout>;

    // Configuration des réactions
    private readonly config: ReactionManagerConfig = {
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        checkInterval: 1000,
    };

    // Liste des réactions disponibles
    private availableReactions: string[] = [];

    private constructor() {
        this.setup();
    }

    public static getInstance(): ReactionManager {
        if (!ReactionManager.instance) {
            ReactionManager.instance = new ReactionManager();
        }
        return ReactionManager.instance;
    }

    /**
     * Initialise le gestionnaire de réactions
     * Configure les observations DOM et s'abonne aux mises à jour WebSocket
     */
    public async setup(): Promise<void> {
        console.log('[Flowly] Initializing message reactions module');

        await this.updateAvailableReactions();

        browser.storage.onChanged.addListener((changes) => {
            if (changes.customEmojis) {
                this.updateAvailableReactions();
            }
        });

        this.initializeMessageIds();
        this.setupObserver();
        this.startPeriodicCheck();
        this.checkAndAddReactionButtons();

        // S'abonne aux mises à jour des réactions via le gestionnaire WebSocket
        wsManager.subscribe('reactions', ['update_reactions'], new Map([
            ['update_reactions', this.handleReactionUpdate.bind(this)]
        ]));
    }

    private initializeMessageIds(): void {
        const containers = document.querySelectorAll<HTMLElement>('.sc-leYdVB');
        containers.forEach(container => {
            if (!container.dataset.messageId) {
                container.dataset.messageId = this.generateMessageId(container);
            }
        });
    }

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

    public async updateAvailableReactions(): Promise<void> {
        try {
            const { customEmojis } = await browser.storage.sync.get('customEmojis');
            this.availableReactions = customEmojis || [
                '👍', '❤️', '😂', '😮', '😢', '😡',
                '🎉', '🤔', '👀', '🔥', '✨', '👎'
            ];
        } catch (error) {
            console.error('[Flowly] Error loading custom reactions:', error);
            this.availableReactions = [
                '👍', '❤️', '😂', '😮', '😢', '😡',
                '🎉', '🤔', '👀', '🔥', '✨', '👎'
            ];
        }
    }

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

    private debounce(fn: Function, delay: number): void {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => fn(), delay);
    }

    private startPeriodicCheck(): void {
        this.checkInterval = window.setInterval(
            () => this.checkAndAddReactionButtons(),
            this.config.checkInterval
        );
    }

    private checkAndAddReactionButtons(): void {
        const containers = document.querySelectorAll<HTMLElement>('.sc-leYdVB');
        containers.forEach(container => {
            if (!container.dataset.hasReactions) {
                this.addReactionButton(container);
            }
        });
    }

    private generateMessageId(container: HTMLElement): string {
        const messageText = container.querySelector('p.sc-dmvcBB[data-test="chatUserMessageText"]')?.textContent?.trim() || '';
        const user = container.querySelector('.sc-gFkHhu span')?.textContent?.trim() || '';
        const timestamp = container.querySelector('time')?.getAttribute('datetime') || '';

        const uniqueString = JSON.stringify({
            text: messageText,
            user: user,
            time: timestamp
        });

        let hash = 0;
        for (let i = 0; i < uniqueString.length; i++) {
            const char = uniqueString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return `msg-${Math.abs(hash).toString(36)}`;
    }

    private handleReactionUpdate(data: any): void {
        try {
            if (!data.data?.reactions) return;

            const reactionsData = JSON.parse(data.data.reactions);
            this.messageReactions = new Map(
                Object.entries(reactionsData).map(([messageId, reactions]) => [
                    messageId,
                    new Map(Object.entries(reactions as Record<string, string[]>))
                ])
            );

            this.updateAllReactionDisplays();
        } catch (error) {
            console.error('[Flowly] Error updating reactions state:', error);
        }
    }

    private updateAllReactionDisplays(): void {
        const containers = document.querySelectorAll<HTMLElement>('.sc-leYdVB');
        containers.forEach(container => {
            const messageId = container.dataset.messageId || this.generateMessageId(container);
            container.dataset.messageId = messageId;

            if (!container.dataset.hasReactions) {
                this.addReactionButton(container);
            }

            if (this.messageReactions.has(messageId)) {
                this.updateReactionDisplay(messageId, container);
            }
        });
    }

    private addReactionButton(container: HTMLElement): void {
        if (container.dataset.hasReactions === 'true') return;

        if (!container.dataset.messageId) {
            container.dataset.messageId = this.generateMessageId(container);
        }
        const messageId = container.dataset.messageId;
        container.dataset.hasReactions = 'true';

        const { reactionsWrapper, reactionsContainer } = this.createReactionElements();
        const reactionButton = this.createReactionButton(messageId);

        container.appendChild(reactionButton);
        container.appendChild(reactionsWrapper);

        if (!this.messageReactions.has(messageId)) {
            this.messageReactions.set(messageId, new Map());
        }

        this.updateReactionDisplay(messageId, reactionsContainer);
    }

    private createReactionElements(): ReactionElements {
        const reactionsWrapper = document.createElement('div');
        reactionsWrapper.className = 'reactions-wrapper';

        const reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'reactions-container';
        reactionsWrapper.appendChild(reactionsContainer);

        return { reactionsWrapper, reactionsContainer };
    }

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

    private showReactionPicker(messageId: string, buttonElement: HTMLElement): void {
        const existingPicker = document.querySelector('.reaction-picker');
        existingPicker?.remove();

        const picker = this.createReactionPicker(messageId);
        this.positionPicker(picker, buttonElement);
        document.body.appendChild(picker);

        this.setupPickerClickOutside(picker, buttonElement);
    }

    private createReactionPicker(messageId: string): HTMLElement {
        const picker = document.createElement('div');
        picker.className = 'reaction-picker';

        this.availableReactions.forEach(emoji => {
            const button = document.createElement('button');
            button.appendChild(document.createTextNode(emoji));
            button.addEventListener('click', () => {
                wsManager.addReaction(messageId, emoji);
                picker.remove();
            });
            picker.appendChild(button);
        });

        return picker;
    }

    private positionPicker(picker: HTMLElement, buttonElement: HTMLElement): void {
        const rect = buttonElement.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.left = `${rect.left - picker.offsetWidth / 2 + buttonElement.offsetWidth / 2}px`;
        picker.style.top = `${rect.top - 10 - picker.offsetHeight}px`;
    }

    private setupPickerClickOutside(picker: HTMLElement, buttonElement: HTMLElement): void {
        const handleClickOutside = (e: MouseEvent) => {
            if (!picker.contains(e.target as Node) && e.target !== buttonElement) {
                picker.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        };

        document.addEventListener('click', handleClickOutside);
    }

    private updateReactionDisplay(messageId: string, container: HTMLElement): void {
        let reactionsWrapper = container.querySelector('.reactions-wrapper');
        let reactionsContainer: HTMLElement;

        if (!reactionsWrapper) {
            const elements = this.createReactionElements();
            reactionsWrapper = elements.reactionsWrapper;
            reactionsContainer = elements.reactionsContainer;
            container.appendChild(reactionsWrapper);
        } else {
            reactionsContainer = reactionsWrapper.querySelector('.reactions-container') as HTMLElement;
            if (!reactionsContainer) {
                reactionsContainer = document.createElement('div');
                reactionsContainer.className = 'reactions-container';
                reactionsWrapper.appendChild(reactionsContainer);
            }
        }

        this.clearContainer(reactionsContainer);

        const reactions = this.messageReactions.get(messageId) || new Map();
        reactions.forEach((users, emoji) => {
            if (users.length > 0) {
                const badge = this.createReactionBadge(emoji, users);
                badge.addEventListener('click', () => wsManager.addReaction(messageId, emoji));
                reactionsContainer.appendChild(badge);
            }
        });

        requestAnimationFrame(() => {
            forceReflow(container);
        });
    }

    private createReactionBadge(emoji: string, users: string[]): HTMLElement {
        const badge = document.createElement('div');
        badge.className = 'reaction-badge';

        const currentUser = getActualUserName();
        if (currentUser && users.includes(currentUser)) {
            badge.style.backgroundColor = '#92d4ff';
        }

        badge.setAttribute('title', users.join(', '));

        const emojiElement = this.createEmojiElement(emoji, users.length.toString());
        badge.appendChild(emojiElement);

        return badge;
    }

    private createEmojiElement(emoji: string, count: string): HTMLElement {
        const span = document.createElement('span');
        span.appendChild(document.createTextNode(emoji));
        span.appendChild(document.createTextNode(` ${count}`));
        return span;
    }

    private clearContainer(container: Element): void {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }

    public cleanup(isRefresh: boolean = false): void {
        this.messagesObserver?.disconnect();
        clearInterval(this.checkInterval);
    }
}

export const reactionManager = ReactionManager.getInstance();