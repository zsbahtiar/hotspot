export interface Bindings {
  DB: D1Database;
  CACHE: KVNamespace;
  BUCKET: R2Bucket;
  APP_ENV: string;
  CORS_ALLOWED_ORIGINS: string;
}

// Response envelope mirrors the Go domain.Response[T].
export interface Envelope<T> {
  message: string;
  success: boolean;
  data: T;
}

export function envelope<T>(message: string, data: T): Envelope<T> {
  return { message, success: true, data };
}

export interface ErrorEnvelope {
  message: string;
  success: boolean;
  error?: string;
}
