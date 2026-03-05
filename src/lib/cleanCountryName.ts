/**
 * Strips all emojis (including flag sequences), leading/trailing whitespace,
 * and other non-printable characters from a country name string.
 * E.g. "🇲🇦 Morocco" → "Morocco", "  🇫🇷 France  " → "France"
 */
export function cleanCountryName(raw: string | null | undefined): string {
  if (!raw) return "";
  // Remove emoji characters: flags (regional indicators), skin tones, symbols, etc.
  return raw
    .replace(
      /[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{E0001}]/gu,
      ""
    )
    .trim();
}
