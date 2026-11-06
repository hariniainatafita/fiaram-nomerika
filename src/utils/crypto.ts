/* -------------------------------------------------------------------------- */
/*  Constantes de sÃ©curitÃ©                                                  */
/* -------------------------------------------------------------------------- */

// Sel fixe utilisÃ© pour le hachage des mots de passe (SHA-256).
// Chaque appareil garde ses hachages localement (jamais synchronisÃ©s sur
// Supabase) afin qu'aucun tiers ne puisse les dÃ©crypter hors ligne.
const PASSWORD_SALT = 'fiaram-member-password-v1';

// Nombre d'itÃ©rations PBKDF2 pour dÃ©river une clÃ© AES-256 Ã partir d'un mot
// de passe. 100 000 ralentit les attaques par force brute / dictionnaire.
const PBKDF2_ITERATIONS = 100_000;

/* -------------------------------------------------------------------------- */
/*  Utilitaires hex                                                           */
/* -------------------------------------------------------------------------- */

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function decodeHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/* -------------------------------------------------------------------------- */
/*  SHA-256 : hachage des mots de passe (sens unique)                         */
/* -------------------------------------------------------------------------- */

/** Hache un mot de passe en clair avec SHA-256 + sel. Renvoie une chaÃ®ne hex. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(PASSWORD_SALT + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return encodeHex(new Uint8Array(hash));
}

const PBKDF2_HASH_ITERATIONS = 100_000;
const PBKDF2_PREFIX = 'pbkdf2';
const FAST_HASH_PREFIX = 'sha256';

// Some Android WebViews freeze (instead of rejecting) a PBKDF2 computation.
// Every WebCrypto call is therefore bounded and can fall back to a worker.
const PASSWORD_HASH_TIMEOUT_MS = 2000;
const PASSWORD_VERIFY_TIMEOUT_MS = 2500;

export class PasswordCheckTimeoutError extends Error {
  constructor() {
    super('password-check-timeout');
    this.name = 'PasswordCheckTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return encodeHex(new Uint8Array(hash));
}

async function verifyFastHash(password: string, stored: string): Promise<boolean> {
  const [prefix, saltHex, hashHex] = stored.split('$');
  if (prefix !== FAST_HASH_PREFIX || !saltHex || !hashHex) return false;
  return safeEqual(await sha256Hex(`${saltHex}:${password}`), hashHex);
}

export function needsPasswordHashUpgrade(stored?: string): boolean {
  if (!stored) return false;
  const parts = stored.split('|');
  return !(parts.length === 1 && parts[0].startsWith(`${PBKDF2_PREFIX}$`));
}

async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  timeoutMs: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  ).catch(() => null);
  if (keyMaterial) {
    const bits = await withTimeout(
      crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        256
      ),
      timeoutMs
    ).catch(() => null);
    if (bits) return encodeHex(new Uint8Array(bits));
  }
  const { derivePbkdf2InWorker } = await import('./pbkdf2WorkerClient');
  return derivePbkdf2InWorker(password, encodeHex(salt), iterations);
}

export async function createPasswordHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  try {
    const derived = await derivePbkdf2(password, salt, PBKDF2_HASH_ITERATIONS, PASSWORD_HASH_TIMEOUT_MS);
    return `${PBKDF2_PREFIX}$${PBKDF2_HASH_ITERATIONS}$${encodeHex(salt)}$${derived}`;
  } catch (err) {
    console.warn('PBKDF2 indisponible, repli SHA-256:', err);
    return hashPassword(password);
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split('|');
  const pbkdf2Part = parts.find((part) => part.startsWith(`${PBKDF2_PREFIX}$`));
  if (pbkdf2Part) {
    const [, iterationsRaw, saltHex, hashHex] = pbkdf2Part.split('$');
    const iterations = Number(iterationsRaw);
    if (!iterations || !saltHex || !hashHex) return false;
    if (saltHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(saltHex)) return false;

    let computed: string;
    try {
      computed = await derivePbkdf2(password, decodeHex(saltHex), iterations, PASSWORD_VERIFY_TIMEOUT_MS);
    } catch {
      throw new PasswordCheckTimeoutError();
    }
    return safeEqual(computed, hashHex);
  }

  const fastPart = parts.find((part) => part.startsWith(`${FAST_HASH_PREFIX}$`));
  if (fastPart) {
    try {
      return await verifyFastHash(password, fastPart);
    } catch {
      return false;
    }
  }

  return safeEqual(await hashPassword(password), stored);
}

/* -------------------------------------------------------------------------- */
/*  AES-256-GCM : chiffrement symÃ©trique de donnÃ©es sensibles au repos      */
/* -------------------------------------------------------------------------- */

/** DÃ©rive une clÃ© AES-256 Ã partir d'un mot de passe via PBKDF2. */
async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Chiffre du texte avec AES-256-GCM.
 * Renvoie : salt(16) + iv(12) + ciphertext, le tout encodÃ© en hexadÃ©cimal.
 */
export async function aes256Encrypt(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return encodeHex(combined);
}

/**
 * DÃ©chiffre une chaÃ®ne produite par aes256Encrypt.
 */
export async function aes256Decrypt(ciphertextHex: string, password: string): Promise<string> {
  const combined = decodeHex(ciphertextHex);
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 16 + 12);
  const ciphertext = combined.slice(16 + 12);
  const key = await deriveAesKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
