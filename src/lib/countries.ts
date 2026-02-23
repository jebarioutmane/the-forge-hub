// Country name → emoji flag mapping
const COUNTRY_FLAGS: Record<string, string> = {
  "Afghanistan": "🇦🇫", "Albania": "🇦🇱", "Algeria": "🇩🇿", "Argentina": "🇦🇷",
  "Australia": "🇦🇺", "Austria": "🇦🇹", "Bahrain": "🇧🇭", "Bangladesh": "🇧🇩",
  "Belgium": "🇧🇪", "Brazil": "🇧🇷", "Canada": "🇨🇦", "Chile": "🇨🇱",
  "China": "🇨🇳", "Colombia": "🇨🇴", "Côte d'Ivoire": "🇨🇮", "Czech Republic": "🇨🇿",
  "Denmark": "🇩🇰", "Egypt": "🇪🇬", "Ethiopia": "🇪🇹", "Finland": "🇫🇮",
  "France": "🇫🇷", "Germany": "🇩🇪", "Ghana": "🇬🇭", "Greece": "🇬🇷",
  "India": "🇮🇳", "Indonesia": "🇮🇩", "Iran": "🇮🇷", "Iraq": "🇮🇶",
  "Ireland": "🇮🇪", "Israel": "🇮🇱", "Italy": "🇮🇹", "Japan": "🇯🇵",
  "Jordan": "🇯🇴", "Kenya": "🇰🇪", "Kuwait": "🇰🇼", "Lebanon": "🇱🇧",
  "Libya": "🇱🇾", "Malaysia": "🇲🇾", "Mali": "🇲🇱", "Mauritania": "🇲🇷",
  "Mexico": "🇲🇽", "Morocco": "🇲🇦", "Netherlands": "🇳🇱", "New Zealand": "🇳🇿",
  "Nigeria": "🇳🇬", "Norway": "🇳🇴", "Oman": "🇴🇲", "Pakistan": "🇵🇰",
  "Palestine": "🇵🇸", "Peru": "🇵🇪", "Philippines": "🇵🇭", "Poland": "🇵🇱",
  "Portugal": "🇵🇹", "Qatar": "🇶🇦", "Romania": "🇷🇴", "Russia": "🇷🇺",
  "Rwanda": "🇷🇼", "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳", "Singapore": "🇸🇬",
  "South Africa": "🇿🇦", "South Korea": "🇰🇷", "Spain": "🇪🇸", "Sudan": "🇸🇩",
  "Sweden": "🇸🇪", "Switzerland": "🇨🇭", "Syria": "🇸🇾", "Tanzania": "🇹🇿",
  "Thailand": "🇹🇭", "Tunisia": "🇹🇳", "Turkey": "🇹🇷", "Uganda": "🇺🇬",
  "Ukraine": "🇺🇦", "United Arab Emirates": "🇦🇪", "United Kingdom": "🇬🇧",
  "United States": "🇺🇸", "Vietnam": "🇻🇳", "Yemen": "🇾🇪", "Zambia": "🇿🇲",
  "Zimbabwe": "🇿🇼",
};

export const COUNTRIES = Object.keys(COUNTRY_FLAGS).sort();

export function getFlag(country: string | null | undefined): string {
  if (!country) return "";
  return COUNTRY_FLAGS[country] || "🏳️";
}
