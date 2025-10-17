import { Buffer } from 'buffer';
import util from 'util';
import process from 'process';

if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).process = process;
}

if (typeof global !== 'undefined') {
  (global as any).Buffer = Buffer;
}

export { Buffer, util, process };
