/**
 * Response headers for the endpoints that stream an uploaded file.
 *
 * Both the product-image and the category-icon endpoints returned only a
 * Content-Type and `Content-Disposition: inline`, which left two things open:
 *
 *  1. **No caching.** Every page load re-fetched every image. A category nav is
 *     13 icons and a feed is a dozen photos, so a single visit re-downloaded
 *     megabytes that had not changed.
 *  2. **An uploaded SVG is an active document.** Opened directly — not via an
 *     `<img>` or a CSS mask, but by pasting the URL into the address bar — an
 *     SVG's `<script>` runs on the API's own origin. Only admins can upload
 *     icons, so the blast radius is small, but the guard costs two headers.
 *
 * `default-src 'none'` stops an SVG reaching the network or running script
 * while leaving it perfectly renderable as an image, and `nosniff` stops a
 * mislabelled upload being re-typed into something executable.
 */

const SVG_SAFETY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
} as const;

/**
 * A product image. The URL carries the image row's id, and replacing an image
 * creates a new row, so a given URL's bytes never change — it can be cached
 * indefinitely.
 *
 * `private` rather than `public`: an image belonging to a DRAFT or rejected
 * listing is owner-only, and the endpoint decides that per requester. Marking
 * it private keeps it in the requester's own browser and out of any shared
 * cache that might otherwise hand it to the next person.
 */
export function productImageHeaders(mimeType: string): Record<string, string> {
  return {
    'Content-Type': mimeType,
    'Content-Disposition': 'inline',
    'Cache-Control': 'private, max-age=31536000, immutable',
    ...SVG_SAFETY_HEADERS,
  };
}

/**
 * A category or subcategory icon. Always public — the taxonomy itself is.
 *
 * Deliberately NOT `immutable`: unlike a product image, this URL is keyed by
 * the *category* id, which does not change when an admin uploads a replacement
 * icon. A long max-age would leave the old icon on screen until it expired, so
 * the window is short and `stale-while-revalidate` covers the refresh.
 */
export function categoryIconHeaders(mimeType: string): Record<string, string> {
  return {
    'Content-Type': mimeType,
    'Content-Disposition': 'inline',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    ...SVG_SAFETY_HEADERS,
  };
}
