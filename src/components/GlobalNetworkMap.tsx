import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
} from "react-simple-maps";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanCountryName } from "@/lib/cleanCountryName";
import { getCountryCoordinates } from "@/lib/countryCoordinates";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MOROCCO: [number, number] = [-6.8, 33.9];

interface CountryData {
  country: string;
  founderCount: number;
  expertCount: number;
  institutions: string[];
}

const parseCountryValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseCountryValues(parsed);
    } catch {
      return [];
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [trimmed];
};

export default function GlobalNetworkMap() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: CountryData } | null>(null);

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("nationalities, nationality");
      if (error) throw error;
      return data;
    },
  });

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stakeholders")
        .select("based_in_country, institution_name, nationalities");
      if (error) throw error;
      return data;
    },
  });

  const mapData = useMemo(() => {
    const map: Record<string, CountryData> = {};

    founders.forEach((founder) => {
      const founderCountries = new Set(
        [...parseCountryValues(founder.nationalities), ...parseCountryValues(founder.nationality)]
          .map((rawCountry) => cleanCountryName(rawCountry))
          .filter((country) => Boolean(country) && country !== "Morocco")
      );

      founderCountries.forEach((country) => {
        if (!map[country]) {
          map[country] = { country, founderCount: 0, expertCount: 0, institutions: [] };
        }
        map[country].founderCount += 1;
      });
    });

    stakeholders.forEach((stakeholder) => {
      const stakeholderCountries = parseCountryValues(stakeholder.based_in_country);

      if (stakeholderCountries.length === 0) {
        stakeholderCountries.push(...parseCountryValues(stakeholder.nationalities));
      }

      const normalizedCountries = new Set(
        stakeholderCountries
          .map((rawCountry) => cleanCountryName(rawCountry))
          .filter((country) => Boolean(country) && country !== "Morocco")
      );

      normalizedCountries.forEach((country) => {
        if (!map[country]) {
          map[country] = { country, founderCount: 0, expertCount: 0, institutions: [] };
        }

        map[country].expertCount += 1;

        if (
          stakeholder.institution_name &&
          !map[country].institutions.includes(stakeholder.institution_name)
        ) {
          map[country].institutions.push(stakeholder.institution_name);
        }
      });
    });

    return Object.values(map);
  }, [founders, stakeholders]);

  const founderCountries = mapData.filter((country) => country.founderCount > 0);
  const expertCountries = mapData.filter((country) => country.expertCount > 0);

  console.log("Aggregated Map Data:", mapData);

  return (
    <Card className="border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">🌍 Global Network</CardTitle>
        <p className="text-xs text-muted-foreground">The Forge's international reach from Morocco</p>
      </CardHeader>
      <CardContent className="p-0 relative">
        <div className="bg-[hsl(var(--card))]">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 130, center: [10, 30] }}
            width={800}
            height={420}
            style={{ width: "100%", height: "auto" }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rpiKey}
                    geography={geo}
                    fill="hsl(var(--muted))"
                    stroke="hsl(var(--border))"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "hsl(var(--muted-foreground) / 0.2)" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {founderCountries.map((countryData) => {
              const coords = getCountryCoordinates(countryData.country);
              if (!coords) return null;

              return (
                <Line
                  key={`fl-${countryData.country}`}
                  from={coords}
                  to={MOROCCO}
                  stroke="hsl(var(--primary) / 0.3)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                />
              );
            })}

            {expertCountries.map((countryData) => {
              const coords = getCountryCoordinates(countryData.country);
              if (!coords) return null;

              return (
                <Line
                  key={`el-${countryData.country}`}
                  from={coords}
                  to={MOROCCO}
                  stroke="hsl(var(--module-events) / 0.3)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                />
              );
            })}

            <Marker coordinates={MOROCCO}>
              <circle r={6} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
              <circle r={10} fill="hsl(var(--primary) / 0.2)" />
            </Marker>

            {founderCountries.map((countryData) => {
              const coords = getCountryCoordinates(countryData.country);
              if (!coords) return null;

              const hasExpert = countryData.expertCount > 0;

              return (
                <Marker
                  key={`fm-${countryData.country}`}
                  coordinates={hasExpert ? [coords[0] - 1.2, coords[1] - 0.8] : coords}
                  onMouseEnter={(event) => {
                    const rect = (event.target as SVGElement).closest("svg")?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                        data: countryData,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle
                    r={Math.min(3 + countryData.founderCount, 8)}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                    className="cursor-pointer"
                  />
                </Marker>
              );
            })}

            {expertCountries.map((countryData) => {
              const coords = getCountryCoordinates(countryData.country);
              if (!coords) return null;

              const hasFounder = countryData.founderCount > 0;

              return (
                <Marker
                  key={`em-${countryData.country}`}
                  coordinates={hasFounder ? [coords[0] + 1.2, coords[1] + 0.8] : coords}
                  onMouseEnter={(event) => {
                    const rect = (event.target as SVGElement).closest("svg")?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                        data: countryData,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle
                    r={Math.min(3 + countryData.expertCount, 8)}
                    fill="hsl(var(--module-events))"
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                    className="cursor-pointer"
                  />
                </Marker>
              );
            })}
          </ComposableMap>

          {tooltip && (
            <div
              className="absolute pointer-events-none z-50 bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm max-w-[220px]"
              style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
            >
              <p className="font-bold text-foreground">{tooltip.data.country}</p>
              {tooltip.data.founderCount > 0 && (
                <p className="text-xs text-primary">Founders: {tooltip.data.founderCount}</p>
              )}
              {tooltip.data.expertCount > 0 && (
                <>
                  <p className="text-xs text-module-events">Experts: {tooltip.data.expertCount}</p>
                  {tooltip.data.institutions.length > 0 && (
                    <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                      {tooltip.data.institutions.map((institution) => (
                        <li key={institution}>{institution}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 px-4 py-3 border-t bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary inline-block" />
            <span className="text-xs text-muted-foreground">Founder Nationalities</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-module-events inline-block" />
            <span className="text-xs text-muted-foreground">Expert / Institution Network</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary ring-2 ring-primary/20 inline-block" />
            <span className="text-xs text-muted-foreground">Morocco (Hub)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
