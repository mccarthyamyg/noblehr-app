/// <reference types="vite/client" />

/**
 * API client throws errors with status and data.
 * Augment Error so catch (err) { err.status; err.data } type-checks.
 */
declare global {
  interface Error {
    status?: number;
    data?: Record<string, unknown>;
  }
}

export {};
