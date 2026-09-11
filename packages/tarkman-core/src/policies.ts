/** Existing web polling values, available to adapters without enabling polling. */
export const SESSION_POLLING = {
  activeIntervalMs: 1000,
  inactiveIntervalMs: 10000,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 30000,
  cacheRetentionMs: 300000,
} as const
export const DEFAULT_EXPLANATION_LOOKAHEAD = 3
