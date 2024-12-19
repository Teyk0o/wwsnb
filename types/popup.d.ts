/**
 * Structure des données stockées dans le browser.storage
 */
export interface StorageData {
    customEmojis?: string[];
}

/**
 * Structure d'un event emoji-click
 */
export interface EmojiClickEventDetail {
    unicode?: string;
    name?: string;
    emoji?: {
        annotation: string;
        group: number;
        order: number;
        shortcodes: string[];
        tags: string[];
        unicode: string;
        version: number;
    };
}

/**
 * Structure des messages envoyés aux content scripts
 */
export interface ContentScriptMessage {
    type: 'UPDATE_REACTIONS';
    emojis: string[];
}

/**
 * Configuration commune de l'application
 */
export interface FlowlyConfig {
    MAX_EMOJIS: number;
    DEFAULT_EMOJIS: string[];
}