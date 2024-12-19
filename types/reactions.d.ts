export interface ReactionValidation {
    readonly defaultReactions: string[];
    userCustomReactions: Map<string, string[]>;
}

export interface ReactionConfig {
    maxReconnectAttempts: number;
    reconnectDelay: number;
    checkInterval: number;
    wsUrl: string;
    validReactions: ReactionValidation;
}

export interface BaseWebSocketMessage<T extends string, D = unknown> {
    type: T;
    data?: D;
    sessionToken?: string;
}

export type ReactionUsers = string[];
export type MessageReaction = Map<string, ReactionUsers>;
export type MessageReactions = Map<string, MessageReaction>;

export interface ReactionData {
    type: 'update_reactions';
    sessionToken: string;
    data: {
        reactions: string;
    };
}

export interface ParsedReactionData {
    emoji: string;
    users: string[];
}

export interface ParsedMessageReaction {
    messageId: string;
    reactions: ParsedReactionData[];
}

export type AvailableReaction = string;

export interface ReactionElements {
    reactionsWrapper: HTMLElement;
    reactionsContainer: HTMLElement;
}

export type WebSocketMessage =
    | BaseWebSocketMessage<'reaction_update', ReactionUpdateData>
    | BaseWebSocketMessage<'update_reactions', ReactionStateData>;

export interface ReactionUpdateData {
    messageId: string;
    emoji: string;
    userId: string;
    action: 'add' | 'remove';
}


export interface ReactionStateData {
    reactions: string;
}

export interface ReactionManagerConfig {
    maxReconnectAttempts: number;
    reconnectDelay: number;
    checkInterval: number;
}

export type QueuedMessage = WebSocketMessage;

export function isValidReaction(emoji: string, config: ReactionConfig): boolean;