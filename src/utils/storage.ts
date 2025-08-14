interface APIKeys {
  openrouter: string;
}

const STORAGE_KEY = 'trading_strategy_api_keys';

// Simple encryption/decryption for localStorage
function simpleEncrypt(text: string): string {
  return btoa(text);
}

function simpleDecrypt(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return '';
  }
}

export function saveAPIKeys(keys: APIKeys): void {
  const encrypted = simpleEncrypt(JSON.stringify(keys));
  localStorage.setItem(STORAGE_KEY, encrypted);
}

export function loadAPIKeys(): APIKeys | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const decrypted = simpleDecrypt(stored);
    const keys = JSON.parse(decrypted);
    if (keys.openrouter) {
      return keys;
    }
  } catch (error) {
    console.error('Failed to load API keys:', error);
  }
  
  return null;
}

export function clearAPIKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasAPIKeys(): boolean {
  return loadAPIKeys() !== null;
}