// Main-thread side of the pure-JS PBKDF2 fallback. The worker is only created
// when WebCrypto fails, so normal browsers keep the fast native implementation.

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timer: number;
}

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<number, PendingRequest>();

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;

  worker = new Worker(new URL('./pbkdf2Worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = (event: MessageEvent<{ id: number; result?: string; error?: string }>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    window.clearTimeout(entry.timer);
    if (event.data.result) entry.resolve(event.data.result);
    else entry.reject(new Error(event.data.error || 'PBKDF2 worker failed'));
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || 'PBKDF2 worker error');
    for (const [id, entry] of pending) {
      window.clearTimeout(entry.timer);
      entry.reject(error);
      pending.delete(id);
    }
    worker?.terminate();
    worker = null;
  };

  return worker;
}

export function derivePbkdf2InWorker(
  password: string,
  saltHex: string,
  iterations: number,
  timeoutMs = 20000
): Promise<string> {
  const current = ensureWorker();
  if (!current) return Promise.reject(new Error('Worker indisponible'));

  return new Promise<string>((resolve, reject) => {
    const id = ++sequence;
    const timer = window.setTimeout(() => {
      pending.delete(id);
      current.terminate();
      worker = null;
      reject(new Error('PBKDF2 timeout'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    current.postMessage({ id, password, saltHex, iterations });
  });
}
