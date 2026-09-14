/**
 * Every localStorage key the app writes.
 *
 * Centralised because "Reset all data" is the one place that has to know all
 * of them, and it silently rots otherwise: it was still clearing a portfolio
 * key that no longer exists while leaving alerts and positions untouched. A
 * reset that quietly keeps data is worse than no reset button.
 *
 * Keep this in step with the `name` passed to each store's persist().
 */
export const PERSISTED_KEYS = [
  'panscreener.screener',
  'panscreener.prefs',
  'panscreener.alerts',
  'panscreener.positions',
  'panscreener.listings',
  'panscreener.admin',
] as const;

export function clearPersistedData() {
  for (const key of PERSISTED_KEYS) localStorage.removeItem(key);
}
