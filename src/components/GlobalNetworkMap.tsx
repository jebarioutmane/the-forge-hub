import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  ZoomableGroup,
} from "react-simple-maps";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cleanCountryName } from "@/lib/cleanCountryName";
import { getCountryCoordinates } from "@/lib/countryCoordinates";
import { Search } from "lucide-react";

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
      return parseCountryValues(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed.slice(1, -1).split(",").map((i) => i.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  if (trimmed.includes(",")) {
    return trimmed.split(",").map((i) => i.trim()).filter(Boolean);
  }
  return [trimmed];
};

export default function GlobalNetworkMap() {
  const [isInteractive, setIsInteractive] = useState(false);
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
      const { data, error } = await supabase.from("stakeholders").select("based_in_country, institution_name, nationalities");
      if (error) throw error;
      return data;
    },
  });

  const { moroccanFounderCount, mapData } = useMemo(() => {
    const map: Record<string, CountryData> = {};
    let moroccanCount = 0;

    founders.forEach((founder) => {
      const allCountries = [
        ...parseCountryValues(founder.nationalities),
        ...parseCountryValues(founder.nationality),
      ].map((raw) => cleanCountryName(raw)).filter(Boolean);

      allCountries.forEach((country) => {
        if (country === "Morocco") {
          moroccanCount += 1;
          return;
        }
        if (!map[country]) map[country] = { country, founderCount: 0, expertCount: 0, institutions: [] };
        map[country].founderCount += 1;
      });
    });

    stakeholders.forEach((s) => {
      const countries = parseCountryValues(s.based_in_country);
      if (countries.length === 0) countries.push(...parseCountryValues(s.nationalities));

      const normalized = new Set(
        countries.map((raw) => cleanCountryName(raw)).filter((c) => Boolean(c) && c !== "Morocco")
      );

      normalized.forEach((country) => {
        if (!map[country]) map[country] = { country, founderCount: 0, expertCount: 0, institutions: [] };
        map[country].expertCount += 1;
        if (s.institution_name && !map[country].institutions.includes(s.institution_name)) {
          map[country].institutions.push(s.institution_name);
        }
      });
    });

    return { moroccanFounderCount: moroccanCount, mapData: Object.values(map) };
  }, [founders, stakeholders]);

  const founderCountries = mapData.filter((c) => c.founderCount > 0);
  const expertCountries = mapData.filter((c) => c.expertCount > 0);

  

  const handleMarkerHover = (event: React.MouseEvent, data: CountryData) => {
    const rect = (event.target as SVGElement).closest("svg")?.getBoundingClientRect();
    if (rect) {
      setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, data });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2.5">
        <span className="text-lg">🌍</span>
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Global Network</h3>
      </div>
      <div className="flex-1 relative min-h-0">
        {/* Scroll trap overlay */}
        {!isInteractive && (
          <div
            className="absolute inset-0 z-10 cursor-default"
            onClick={() => setIsInteractive(true)}
          />
        )}

        {/* Toggle button */}
        <button
          onClick={() => setIsInteractive(!isInteractive)}
          className={`absolute top-3 right-3 z-20 h-9 w-9 rounded-full shadow-md flex items-center justify-center transition-all duration-200 bg-background/90 backdrop-blur-sm border border-border/40 hover:shadow-lg ${
            isInteractive ? "ring-2 ring-primary/20" : ""
          }`}
          title={isInteractive ? "Lock map" : "Unlock map to interact"}
        >
          <Search className={`h-4 w-4 transition-colors ${isInteractive ? "text-muted-foreground" : "text-primary"}`} />
        </button>

        <div className="h-full w-full bg-background">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 140, center: [15, 35] }}
            width={800}
            height={450}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup zoom={1} minZoom={1} maxZoom={isInteractive ? 8 : 1}>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rpiKey}
                      geography={geo}
                      fill="#E8E8ED"
                      stroke="#FFFFFF"
                      strokeWidth={0.75}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: "#D2D2D7" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Connection lines */}
              {[...founderCountries, ...expertCountries].map((d) => {
                const coords = getCountryCoordinates(d.country);
                if (!coords) return null;
                return (
                  <Line
                    key={`line-${d.country}`}
                    from={coords}
                    to={MOROCCO}
                    stroke="#0071E3"
                    strokeWidth={1}
                    strokeLinecap="round"
                    strokeOpacity={0.3}
                  />
                );
              })}

              {/* Morocco hub dot */}
              <Marker coordinates={MOROCCO}>
                <circle
                  r={6}
                  fill="#0071E3"
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                  className="cursor-pointer"
                  onMouseEnter={(e) =>
                    handleMarkerHover(e, {
                      country: "Morocco",
                      founderCount: moroccanFounderCount,
                      expertCount: 0,
                      institutions: ["The Forge (Hub)"],
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              </Marker>

              {/* Country dots */}
              {mapData.map((d) => {
                const coords = getCountryCoordinates(d.country);
                if (!coords) return null;
                return (
                  <Marker key={`dot-${d.country}`} coordinates={coords}>
                    <circle
                      r={4}
                      fill="#0071E3"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMarkerHover(e, d)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  </Marker>
                );
              })}
            </ZoomableGroup>
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
                <p className="text-xs text-muted-foreground">Experts: {tooltip.data.expertCount}</p>
              )}
              {tooltip.data.institutions.length > 0 && (
                <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                  {tooltip.data.institutions.map((inst) => (
                    <li key={inst}>{inst}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 px-4 py-2.5 border-t border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0071E3]" />
          <span className="text-xs text-muted-foreground">Network Nodes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0071E3] ring-2 ring-[#0071E3]/20" />
          <span className="text-xs text-muted-foreground">Morocco Hub</span>
        </div>
      </div>
    </div>
  );
}
