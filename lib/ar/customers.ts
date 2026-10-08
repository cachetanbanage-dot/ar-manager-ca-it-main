// Customer Master figures (Part 2).
import type { Paise } from './types';

/**
 * Percentage of the credit limit used by the net balance, to the nearest whole
 * percent. A credit balance uses 0%. Returns null when the limit is zero and
 * something is owed (no meaningful percentage; the screen shows "—").
 */
export function creditUsedPct(netBalance: Paise, creditLimit: Paise): number | null {
  if (netBalance <= 0) return 0;
  if (creditLimit <= 0) return null;
  return Math.round((netBalance * 100) / creditLimit);
}
