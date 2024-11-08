import { hideSuggestions, searchAndShowSuggestions } from "../modules/mentions";

/**
 * Handle input changes and trigger suggestions display
 * @param {Event} e Input event
 */
export function handleInput(e:Event) {
    const target = e.target as HTMLInputElement;
    if (!isValidTarget(target)) return;

  const text = target.value;
  const cursorPosition = target.selectionStart ?? 0;
  const textUpToCursor = text.slice(0, cursorPosition);
  const lastAtIndex = textUpToCursor.lastIndexOf('@');

  if (shouldHideSuggestions(lastAtIndex, textUpToCursor)) {
    hideSuggestions();
    return;
  }

  const textAfterAt = textUpToCursor.slice(lastAtIndex + 1);

  if (shouldShowAllSuggestions(lastAtIndex, cursorPosition)) {
    searchAndShowSuggestions('', target, lastAtIndex);
  } else {
    searchAndShowSuggestions(textAfterAt, target, lastAtIndex);
  }
}

export function isValidTarget(target: HTMLInputElement | null): target is HTMLInputElement {
    return target !== null && target.id === 'message-input';
  }

function shouldHideSuggestions(lastAtIndex: number, textUpToCursor: string): boolean {
    return lastAtIndex === -1 || textUpToCursor.slice(lastAtIndex + 1).includes(' ');
  }
function shouldShowAllSuggestions(lastAtIndex: number, cursorPosition: number): boolean {
    return lastAtIndex === cursorPosition - 1;
  }