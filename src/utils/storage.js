/**
 * Safe localStorage wrapper.
 * Prevents crashes in private browsing or when storage is full/disabled.
 */

export function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    console.warn(`[storage] Failed to read "${key}" from localStorage`);
    return null;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn(`[storage] Failed to write "${key}" to localStorage`);
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    console.warn(`[storage] Failed to remove "${key}" from localStorage`);
  }
}
