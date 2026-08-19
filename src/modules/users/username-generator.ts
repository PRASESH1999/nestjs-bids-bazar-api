/**
 * Formats a system-generated username: BB + a 6-digit zero-padded sequence
 * number (never resets) + the calendar year the account was created in, e.g.
 * `BB000001-2026`. Past 999,999 accounts this simply stops zero-padding
 * rather than truncating or resetting.
 */
export function formatGeneratedUsername(seq: number, year: number): string {
  return `BB${String(seq).padStart(6, '0')}-${year}`;
}
