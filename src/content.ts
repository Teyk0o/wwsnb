import { mainConfig } from "./config";
import { observer } from "./event/observer";
import { checkNewMessages } from "./modules/message";
import { setupMentions } from "./setup/setupMentions";
/**
 * Initialize all WWSNB modules
 */
function WWSNB() {
    localStorage.setItem('cachedUsers', JSON.stringify([]));
    localStorage.setItem('lastCacheTime', '0');
    console.log('WWSNB by Théo Vilain successfully loaded');
    // Start observing document for changes
    observer.observe(document.body, mainConfig);


    checkNewMessages();
    // Initialize all modules with a slight delay to ensure DOM is ready
    setTimeout(() => {
        console.log('[WWSNB] Starting modules initialization');
        checkNewMessages();
        setupMentions();
        // setupReactions();
        // setupQuestions();
        // setupModerator();
        console.log('[WWSNB] Modules initialized successfully');
    }, 1000);
}

// Launch the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', WWSNB);
} else {
    WWSNB();
}