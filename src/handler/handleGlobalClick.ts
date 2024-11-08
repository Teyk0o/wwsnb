import { hideSuggestions } from "../modules/mentions";

/**
 * Handle click events on suggestion items
 * @param {Event} e Click event
 */
export function handleGlobalClick(e:Event) {
  if (suggestionsBox) {
      const suggestionItem = e.target.closest('.mention-suggestion-item');
      if (suggestionItem) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          selectSuggestion(suggestionItem);
          return false;
      } else if (!suggestionsBox.contains(e.target) && e.target.id !== 'message-input') {
          hideSuggestions();
      }
  }
}