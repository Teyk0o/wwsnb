import type { User } from "../types/user";
import { cleanUsername, generateInitials, generateUserColor } from "../utils";

/**
 * Get the current user's full name from the UI
 * @returns {string|undefined} The current user's full name or undefined if not found
 */
export function getActualUserName():string|undefined {
  const userElement = document.querySelector('[aria-label*="Vous"]');
  if (!userElement) return;

  const ariaLabel = userElement.getAttribute('aria-label');
  if (!ariaLabel) return;

  // Extrait tout ce qui se trouve avant " Vous"
  const fullNameMatch = ariaLabel.match(/(.+?)\s*Vous/);
  if (!fullNameMatch) return;

  // si fullNameMatch est "Matthieu LE PRIOL", retourne "Mouss"
  if (fullNameMatch[1].trim() === "Matthieu LE PRIOL") return "Mouss";

  // Retourne le nom complet trouvé
  return fullNameMatch[1].trim();
}

/**
 * Get all users from the user list and chat messages
 * @returns {Array} Array of user objects with name, initials, and background color
 */
export function getAllUsers() {
  const users:User[] = [];

  // Get users from the user list
  for (const item of document.querySelectorAll('[data-test="userListItem"]')) {
      const userNameElement = item.querySelector('[aria-label*="Statut"]');
      if (userNameElement?.textContent) {
          const rawName = userNameElement.textContent.trim();
          const name = cleanUsername(rawName);
          users.push({
            name,
            initials: generateInitials(name),
            bgColor: generateUserColor(name)
        });
      }
  }

  // Get users from chat messages
  for (const message of document.querySelectorAll('[data-message-id]')) {
      const userNameElement = message.querySelector('.sc-gFkHhu span') as HTMLElement;
      if (userNameElement.textContent) {
          const rawName = userNameElement.textContent.trim();
          const name = cleanUsername(rawName);
          if (name && name !== 'System Message') {
              users.push({
                name,
                initials: generateInitials(name),
                bgColor: generateUserColor(name)
            });
          }
      }
  };

  return users;
}