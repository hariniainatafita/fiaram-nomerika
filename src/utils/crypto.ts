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
