import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  (window as any).global = window;
  window.process = window.process || { env: {} };
  (globalThis as any).Buffer = Buffer;
}
