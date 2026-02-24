/**
 * Ensures a URL string has a protocol prefix.
 * If the URL doesn't start with http:// or https://, prepends https://.
 */
export function formatUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
