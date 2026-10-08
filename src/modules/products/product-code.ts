/**
 * Formats a system-generated product code: `BB-SKU-` + the `product_code_seq`
 * value, unpadded, e.g. `BB-SKU-1`, `BB-SKU-42`. One counter across every
 * category, so a code never encodes anything that can later go stale.
 */
export function formatProductCode(seq: number): string {
  return `BB-SKU-${seq}`;
}
