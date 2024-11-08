import { handleInput } from "../handler/handleInput";
import { handleKeyDownGlobal } from "../handler/handleKeyDown";
import { setupInputListener } from "../modules/mentions";

/**
 * Initialize the mentions system by setting up event listeners
 */
export function setupMentions() {
  console.log('[WWSNB] Initializing user mentions module');

  // Remove any existing event listeners to prevent duplicates
  document.removeEventListener('input', handleInput);
  document.removeEventListener('keydown', handleKeyDownGlobal);

  // Add event listeners for handling mentions
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeyDownGlobal, true);
  // document.addEventListener('click', handleGlobalClick, true);

  setupInputListener();
}