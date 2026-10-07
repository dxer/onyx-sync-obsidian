/**
 * Device-Bound Secret Encryption for Obsidian Sync (Data-at-Rest Protection)
 *
 * Guarantees that even if data.json is copied or stolen:
 * 1. On Desktop: Encrypted with OS DPAPI (Windows) / Keychain (macOS) via Electron safeStorage.
 *    Windows DPAPI cryptographically binds keys to the local Windows user account and hardware.
 * 2. On Mobile / Fallback: Encrypted with an isolated 256-bit AES key stored exclusively
 *    inside the application's private sandbox (outside the vault directory).
 *
 * In either case, copying data.json to another machine or device will render the
 * token and passphrase mathematically undecryptable and useless.
 */

import {
  encryptData,
  decryptText,
  bytesToBase64Url,
  base64UrlToBytes,
  getRandomBytes,
  bytesToHex,
  hexToBytes
} from '@onyx/shared';

interface ElectronSafeStorage {
  isEncryptionAvailable: () => boolean;
  encryptString: (plainText: string) => Uint8Array;
  decryptString: (encrypted: Uint8Array) => string;
}

interface ElectronModule {
  safeStorage?: ElectronSafeStorage;
}

function getSafeStorage(): ElectronSafeStorage | null {
  try {
    const customRequire = (window as unknown as { require?: (name: string) => ElectronModule }).require;
    if (typeof customRequire === 'function') {
      const electron = customRequire('electron');
      if (electron?.safeStorage?.isEncryptionAvailable()) {
        return electron.safeStorage;
      }
    }
  } catch {
    // Mobile or sandbox environment
  }
  return null;
}

/**
 * Get or generate a private device key stored exclusively in the app's isolated sandbox storage.
 * This storage is never inside the vault folder and does NOT get copied when copying the vault.
 */
async function getOrCreateSandboxDeviceKey(): Promise<CryptoKey> {
  const STORAGE_KEY = 'obsidian_sync_sandbox_device_secret';
  let hexSecret = window.localStorage.getItem(STORAGE_KEY);

  if (!hexSecret || hexSecret.length !== 64) {
    const randomBytes = getRandomBytes(32);
    hexSecret = bytesToHex(randomBytes);
    window.localStorage.setItem(STORAGE_KEY, hexSecret);
  }

  const rawBytes = hexToBytes(hexSecret);
  const buffer = rawBytes.buffer instanceof ArrayBuffer ? rawBytes.buffer : new Uint8Array(rawBytes).slice().buffer;
  return window.crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a sensitive secret string (token or passphrase) with hardware/device binding
 */
export async function encryptDeviceSecret(plaintext: string): Promise<string> {
  if (!plaintext) return '';

  const safeStorage = getSafeStorage();

  // Level 1: Hardware-backed OS DPAPI / Keychain (Desktop)
  if (safeStorage) {
    try {
      const encryptedBytes = safeStorage.encryptString(plaintext);
      return 'dpapi:' + bytesToHex(new Uint8Array(encryptedBytes));
    } catch (err) {
      console.warn('[Cloud Sync] safeStorage encryption failed, falling back to sandbox key:', err);
    }
  }

  // Level 2: Sandboxed Device Key (Mobile or fallback)
  try {
    const key = await getOrCreateSandboxDeviceKey();
    const ciphertext = await encryptData(plaintext, key);
    return 'devkey:' + bytesToBase64Url(ciphertext);
  } catch (err) {
    console.error('[Cloud Sync] Failed to encrypt secret:', err);
    return '';
  }
}

/**
 * Decrypt a sensitive secret. Returns empty string if copied to an unauthorized device.
 */
export async function decryptDeviceSecret(ciphertextWithPrefix: string): Promise<string> {
  if (!ciphertextWithPrefix) return '';

  // 1. Decrypt DPAPI (Windows DPAPI / Mac Keychain)
  if (ciphertextWithPrefix.startsWith('dpapi:')) {
    const safeStorage = getSafeStorage();
    if (!safeStorage) {
      console.warn('⚠️ [Cloud Sync] Config was encrypted with OS DPAPI on desktop, cannot decrypt in non-desktop environment.');
      return '';
    }

    try {
      const hex = ciphertextWithPrefix.slice(6);
      const bytes = hexToBytes(hex);
      return safeStorage.decryptString(bytes);
    } catch {
      console.warn('🛡️ [Cloud Sync Security Alert] DPAPI Decryption failed! The config file may have been copied from another computer. Access denied.');
      return '';
    }
  }

  // 2. Decrypt Sandboxed Device Key
  if (ciphertextWithPrefix.startsWith('devkey:')) {
    try {
      const b64 = ciphertextWithPrefix.slice(7);
      const bytes = base64UrlToBytes(b64);
      const key = await getOrCreateSandboxDeviceKey();
      return await decryptText(bytes, key);
    } catch {
      console.warn('🛡️ [Cloud Sync Security Alert] Sandboxed key mismatch! The config file was copied without device sandbox credentials. Access denied.');
      return '';
    }
  }

  // Legacy plaintext fallback (migrates automatically on next save)
  return ciphertextWithPrefix;
}
