import { CACHE_DURATION } from "../config";
import type { User } from "../types/user";
import { getAllUsers } from "../user/get";

/**
 * Clean a username by removing status indicators and extra spaces
 * @param {string} name The raw username to clean
 * @returns {string} The cleaned username
 */
export function cleanUsername(name:string):string {
    return name
        .replace(/\s+Verrouillé($|\s)/g, '')    // Remove "Verrouillé" status
        .replace(/\s+Webcam($|\s)/g, '')        // Remove "Webcam" status
        .replace(/\s+Mobile($|\s)/g, '')        // Remove "Mobile" status
        .replace(/\s*\|\s*/g, '')               // Remove separators
        .trim();                                // Remove extra spaces
}

/**
 * Generate initials from a user's name
 * @param {string} name The user's full name
 * @returns {string} The user's initials in uppercase
 */
export function generateInitials(name:string):string {
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();
}

/**
 * Generate a consistent color for a user based on their name
 * @param {string} name The user's name
 * @returns {string} HSL color string
 */
export function generateUserColor(name:string):string {
    return `hsl(${name.length * 137.508 % 360}, 70%, 80%)`;
}


/**
 * Get cached users or fetch new ones if cache is expired
 * @returns {Promise<Array>} Array of users
 */
export function getCachedUsers():User[] {
    // localStorage cachedUser est un JSON qui a été stringify qui a besoin d'être converti en tableau de type User
    const getCachedUsers = localStorage.getItem('cachedUsers');
    const getLastCacheTime = localStorage.getItem('lastCacheTime');
    const cachedUsers:User[] = getCachedUsers ? JSON.parse(getCachedUsers) : [];
    const lastCacheTime = getLastCacheTime ? Number(getLastCacheTime) : 0;
    const now = Date.now();
    if (cachedUsers == null || now - lastCacheTime > CACHE_DURATION) {
        console.log('Fetching users...');
        const getAllusers = getAllUsers();
        localStorage.setItem('cachedUsers', JSON.stringify(getAllusers));
        console.log('Users fetched:', cachedUsers);

        localStorage.setItem('lasCacheTime', JSON.stringify(now));
    }
    return cachedUsers;
}

/**
 * @deprecated Use {@link cleanUsername} instead
 * Capitalize the first letter of a string
 * @param {string} val The string to capitalize
 * @returns {string} The capitalized string
 */
export function capitalizeFirstLetter(val:string):string {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}



