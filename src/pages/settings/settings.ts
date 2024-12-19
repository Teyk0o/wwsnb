import 'emoji-picker-element';
import { browser } from 'webextension-polyfill-ts';
import type { EmojiClickEventDetail } from "emoji-picker-element/shared";
import { StorageData } from "../../../types/popup";

class SettingsManager {
    private readonly MAX_EMOJIS = 12;
    private readonly DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🤔', '👀', '🔥', '✨', '👎'];
    private currentEmojis: string[] = [];
    private selectedEmojiIndex: number | null = null;

    constructor() {
        this.init();
        this.setupEventListeners();
    }

    private async init(): Promise<void> {
        try {
            await this.loadEmojis();
        } catch (error) {
            this.showToast('Erreur lors de l\'initialisation');
            console.error('[Flowly] Initialization error:', error);
        }
    }

    private setupEventListeners(): void {
        // Emoji grid events
        document.getElementById('emojiList')?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const emojiItem = target.closest('.emoji-item');
            if (!emojiItem) return;

            const index = Array.from(emojiItem.parentElement?.children || []).indexOf(emojiItem);
            this.openEmojiPicker(index);
        });

        // Picker overlay events
        document.getElementById('pickerOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeEmojiPicker();
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEmojiPicker();
            }
        });
    }

    private async loadEmojis(): Promise<void> {
        try {
            const { customEmojis } = await browser.storage.sync.get('customEmojis') as StorageData;
            this.currentEmojis = customEmojis || this.DEFAULT_EMOJIS;

            // Ensure we always have exactly MAX_EMOJIS
            while (this.currentEmojis.length < this.MAX_EMOJIS) {
                this.currentEmojis.push(this.DEFAULT_EMOJIS[this.currentEmojis.length % this.DEFAULT_EMOJIS.length]);
            }

            this.renderEmojis();
        } catch (error) {
            console.error('[Flowly] Error loading emojis:', error);
            this.showToast('Erreur lors du chargement des émojis');
        }
    }

    private renderEmojis(): void {
        const container = document.getElementById('emojiList');
        if (!container) return;

        container.innerHTML = this.currentEmojis.map(emoji => `
            <div class="emoji-item">
                ${emoji}
            </div>
        `).join('');
    }

    private openEmojiPicker(index: number): void {
        this.selectedEmojiIndex = index;
        const overlay = document.getElementById('pickerOverlay');
        const container = document.querySelector('.picker-container');

        if (!overlay || !container) return;

        // Clear and initialize picker
        container.innerHTML = '';
        const picker = document.createElement('emoji-picker');
        container.appendChild(picker);

        // Setup picker event listener
        picker.addEventListener('emoji-click', ((e: CustomEvent<EmojiClickEventDetail>) => {
            this.handleEmojiSelect(e);
        }) as EventListener);

        // Show overlay with animation
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        // Highlight selected emoji
        document.querySelectorAll('.emoji-item').forEach((item, i) => {
            item.classList.toggle('selected-emoji', i === index);
        });
    }

    private closeEmojiPicker(): void {
        const overlay = document.getElementById('pickerOverlay');
        if (!overlay) return;

        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            this.selectedEmojiIndex = null;
        }, 200);

        // Remove highlighting
        document.querySelectorAll('.emoji-item').forEach(item => {
            item.classList.remove('selected-emoji');
        });
    }

    private async handleEmojiSelect(event: CustomEvent<EmojiClickEventDetail>): Promise<void> {
        const emoji = event.detail.unicode;
        if (this.selectedEmojiIndex === null || !emoji) return;

        try {
            if (this.currentEmojis.includes(emoji)) {
                this.showToast('Cette réaction est déjà dans votre liste');
                return;
            }

            const updatedEmojis = [...this.currentEmojis];
            updatedEmojis[this.selectedEmojiIndex] = emoji;
            this.currentEmojis = updatedEmojis;

            await this.saveEmojis();
            this.renderEmojis();

            setTimeout(() => this.closeEmojiPicker(), 200);
        } catch (error) {
            console.error('[Flowly] Error updating emoji:', error);
            this.showToast('Erreur lors de la mise à jour de la réaction');
        }
    }

    private async saveEmojis(): Promise<void> {
        try {
            await browser.storage.sync.set({ customEmojis: this.currentEmojis });

            // Notify all tabs about the update
            const tabs = await browser.tabs.query({});
            tabs.forEach(tab => {
                if (tab.id) {
                    browser.tabs.sendMessage(tab.id, {
                        type: 'UPDATE_REACTIONS',
                        emojis: this.currentEmojis
                    }).catch(error => {
                        // Ignore errors for tabs that don't have the content script
                        console.debug('[Flowly] Could not notify tab:', error);
                    });
                }
            });
        } catch (error) {
            console.error('[Flowly] Error saving emojis:', error);
            throw error;
        }
    }

    private showToast(message: string, duration = 3000): void {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
        }, duration);
    }
}

// Initialize the settings manager when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});