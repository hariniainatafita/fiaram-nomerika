import { decodeHex, pbkdf2Sha256Hex } from './pbkdf2Fallback';

interface Pbkdf2Request {
  id: number;
  password: string;
  saltHex: string;
  iterations: number;
}

const post = (message: unknown): void => {
  (self as unknown as { postMessage: (value: unknown) => void }).postMessage(message);
};

self.onmessage = (event: MessageEvent<Pbkdf2Request>) => {
  const { id, password, saltHex, iterations } = event.data;
  try {
    post({ id, result: pbkdf2Sha256Hex(password, decodeHex(saltHex), iterations) });
  } catch (error) {
    post({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
