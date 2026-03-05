import countries from "world-countries";
import { cleanCountryName } from "@/lib/cleanCountryName";

type Coordinates = [number, number];

type CountryRecord = {
  name?: { common?: string; official?: string };
  altSpellings?: string[];
  cca2?: string;
  cca3?: string;
  cioc?: string;
  latlng?: [number, number];
};

const manualAliases: Record<string, string> = {
  USA: "United States",
  "U.S.A.": "United States",
  US: "United States",
  UK: "United Kingdom",
  UAE: "United Arab Emirates",
  "Ivory Coast": "Côte d'Ivoire",
  "Cote dIvoire": "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  "DR Congo": "Democratic Republic of the Congo",
  "Congo (DRC)": "Democratic Republic of the Congo",
  "Congo-Kinshasa": "Democratic Republic of the Congo",
  "Congo-Brazzaville": "Republic of the Congo",
  "Republic of Korea": "South Korea",
  "Korea, South": "South Korea",
  "Korea, North": "North Korea",
  "Russian Federation": "Russia",
  "Czech Republic": "Czechia",
  Swaziland: "Eswatini",
  Burma: "Myanmar",
  "Cape Verde": "Cabo Verde",
  Türkiye: "Turkey",
  Turkiye: "Turkey",
};

const normalizeCountryKey = (value: string): string =>
  cleanCountryName(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const countryCoordinates = new Map<string, Coordinates>();

const addCountryAlias = (name: string | undefined, coordinates: Coordinates) => {
  if (!name) return;
  const key = normalizeCountryKey(name);
  if (!key) return;
  countryCoordinates.set(key, coordinates);
};

(countries as CountryRecord[]).forEach((country) => {
  if (!country?.latlng || country.latlng.length !== 2) return;

  const coordinates: Coordinates = [Number(country.latlng[1]), Number(country.latlng[0])];

  addCountryAlias(country.name?.common, coordinates);
  addCountryAlias(country.name?.official, coordinates);
  addCountryAlias(country.cca2, coordinates);
  addCountryAlias(country.cca3, coordinates);
  addCountryAlias(country.cioc, coordinates);

  country.altSpellings?.forEach((alt) => addCountryAlias(alt, coordinates));
});

Object.entries(manualAliases).forEach(([alias, canonical]) => {
  const canonicalCoords = countryCoordinates.get(normalizeCountryKey(canonical));
  if (canonicalCoords) {
    countryCoordinates.set(normalizeCountryKey(alias), canonicalCoords);
  }
});

export function getCountryCoordinates(countryName: string | null | undefined): Coordinates | null {
  if (!countryName) return null;
  return countryCoordinates.get(normalizeCountryKey(countryName)) ?? null;
}
