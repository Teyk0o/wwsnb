import { checkNewMessages } from "../modules/message";

// Create observer for new messages
export const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            checkNewMessages();
        }
    }
});