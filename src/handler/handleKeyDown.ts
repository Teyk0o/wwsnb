import { hideSuggestions, selectSuggestion } from "../modules/mentions";
import { isValidTarget } from "./handleInput";

/**
 * Handle keyboard events for navigation and selection
 * @param {KeyboardEvent} e Keyboard event
 */
export const handleKeyDownGlobal = (e: KeyboardEvent) => {
    const target = e.target as HTMLInputElement | null;
    if(!isValidTarget(target))return;
    if (!suggestionsBox) return;

  if (e.key === 'Enter') {
    const selectedItem = suggestionsBox.querySelector('.selected');
    if (selectedItem) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        selectSuggestion(selectedItem);
        return false;
    }
} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    navigateSuggestions(e.key === 'ArrowDown' ? 1 : -1);
    return false;
} else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    hideSuggestions();
    return false;
}

}