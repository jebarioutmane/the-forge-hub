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
import { Globe2, Lock, Unlock, X } from "lucide-react";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MOROCCO: [number, number] = [-6.8, 33.9];

interface FounderEntry {
  name: string;
  startup: string;
}
interface StakeholderEntry {
  name: string;
  institution: string | null;
}
interface CountryData {
  country: string;
  founders: FounderEntry[];
  stakeholders: StakeholderEntry[];
}

const parseCountryValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((i): i is string => typeof i === "string").map((i) => i.trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try { return parseCountryValues(JSON.parse(trimmed)); } catch { return []; }
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed.slice(1, -1).split(",").map((i) => i.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  if (trimmed.includes(",")) return trimmed.split(",").map((i) => i.trim()).filter(Boolean);
  return [trimmed];
};

export default function GlobalNetworkMap() {
  const { selectedCohortId } = useCohort();
  const [isInteractive, setIsInteractive] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: CountryData } | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);

  const cohortScoped = selectedCohortId && selectedCohortId !== ALL_COHORTS;

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-map", selectedCohortId],
    queryFn: async () => {
      let q = supabase.from("founders").select("founder_name, startup_name, nationalities, nationality, cohort_id");
      if (cohortScoped) q = q.eq("cohort_id", selectedCohortId as string);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stakeholders")
        .select("full_name, based_in_country, institution_name, nationalities");
      if (error) throw error;
      return data;
    },
  });

  const { moroccoData, countries } = useMemo(() => {
    const byCountry: Record<string, CountryData> = {};
    const morocco: CountryData = { country: "Morocco", founders: [], stakeholders: [] };

    founders.forEach((f: any) => {
      const list = [
        ...parseCountryValues(f.nationalities),
        ...parseCountryValues(f.nationality),
      ].map((r) => cleanCountryName(r)).filter(Boolean);
      const uniq = Array.from(new Set(list));
      uniq.forEach((c) => {
        const bucket = c === "Morocco" ? morocco : (byCountry[c] ||= { country: c, founders: [], stakeholders: [] });
        bucket.founders.push({ name: f.founder_name, startup: f.startup_name });
      });
    });

    stakeholders.forEach((s: any) => {
      const list = parseCountryValues(s.based_in_country);
      const fallback = list.length ? list : parseCountryValues(s.nationalities);
      const uniq = Array.from(new Set(fallback.map((r) => cleanCountryName(r)).filter(Boolean)));
      uniq.forEach((c) => {
        const bucket = c === "Morocco" ? morocco : (byCountry[c] ||= { country: c, founders: [], stakeholders: [] });
        bucket.stakeholders.push({ name: s.full_name ?? "Unknown", institution: s.institution_name });
      });
    });

    return { moroccoData: morocco, countries: Object.values(byCountry) };
  }, [founders, stakeholders]);

  const stats = useMemo(() => {
    const withFounders = countries.filter((c) => c.founders.length > 0);
    const nationalitiesCount = withFounders.length + (moroccoData.founders.length > 0 ? 1 : 0);
    const totalCountries = countries.length + (moroccoData.founders.length + moroccoData.stakeholders.length > 0 ? 1 : 0);
    const top = [...withFounders, moroccoData]
      .filter((c) => c.founders.length > 0)
      .sort((a, b) => b.founders.length - a.founders.length)[0];
    return {
      totalCountries,
      nationalitiesCount,
      topCountry: top ? { name: top.country, count: top.founders.length } : null,
    };
  }, [countries, moroccoData]);

  const maxFounders = Math.max(1, ...countries.map((c) => c.founders.length));

  const markerRadius = (n: number) => {
    if (n <= 0) return 3.5;
    return 4 + Math.sqrt(n / maxFounders) * 6;
  };

  const founderFill = (n: number) => {
    // muted blue scale
    const t = Math.min(1, n / maxFounders);
    const alpha = 0.4 + t * 0.55;
    return `rgba(0, 113, 227, ${alpha})`;
  };

  const showTooltip = (event: React.MouseEvent, data: CountryData) => {
    const rect = (event.target as SVGElement).closest("svg")?.getBoundingClientRect();
    if (rect) setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, data });
  };

  const allMarkerCountries = [...countries];
  const hasAnyData = allMarkerCountries.length > 0 || moroccoData.founders.length > 0 || moroccoData.stakeholders.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center">
          <Globe2 className="h-4 w-4 text-sky-600" />
        </div>
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Global Network</h3>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="hidden sm:inline"><strong className="text-foreground font-semibold">{stats.totalCountries}</strong> countries</span>
          <span className="hidden sm:inline"><strong className="text-foreground font-semibold">{stats.nationalitiesCount}</strong> nationalities</span>
          {stats.topCountry && (
            <span className="hidden md:inline">Top: <strong className="text-foreground font-semibold">{stats.topCountry.name}</strong></span>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-0 bg-[hsl(210,40%,98%)]">
        {!isInteractive && (
          <div className="absolute inset-0 z-10 cursor-pointer" onClick={() => setIsInteractive(true)} />
        )}

        <button
          onClick={() => setIsInteractive(!isInteractive)}
          className={`absolute top-3 right-3 z-20 h-9 w-9 rounded-full shadow-sm flex items-center justify-center transition-all bg-background/90 backdrop-blur-sm border border-border/60 hover:shadow-md ${
            isInteractive ? "ring-2 ring-primary/20" : ""
          }`}
          title={isInteractive ? "Lock map" : "Unlock map"}
          aria-label={isInteractive ? "Lock map" : "Unlock map"}
        >
          {isInteractive ? <Unlock className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
        </button>

        {!hasAnyData ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-xs px-4">
              <Globe2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Add founder countries to populate the map.</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            <style>{`
              @keyframes gnm-pulse {
                0% { transform: scale(1); opacity: 0.55; }
                70% { transform: scale(2.4); opacity: 0; }
                100% { transform: scale(2.4); opacity: 0; }
              }
              .gnm-pulse { transform-origin: center; transform-box: fill-box; animation: gnm-pulse 2.6s ease-out infinite; }
            `}</style>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 145, center: [15, 30] }}
              width={800}
              height={450}
              style={{ width: "100%", height: "100%" }}
            >
              <ZoomableGroup zoom={1} minZoom={1} maxZoom={isInteractive ? 8 : 1}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="hsl(220, 15%, 92%)"
                        stroke="hsl(210, 40%, 98%)"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", fill: "hsl(220, 15%, 88%)" },
                          pressed: { outline: "none" },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {/* Connection arcs (soft) */}
                {allMarkerCountries.map((d) => {
                  const coords = getCountryCoordinates(d.country);
                  if (!coords) return null;
                  return (
                    <Line
                      key={`arc-${d.country}`}
                      from={coords}
                      to={MOROCCO}
                      stroke="hsl(211, 100%, 44%)"
                      strokeWidth={0.6}
                      strokeLinecap="round"
                      strokeOpacity={0.18}
                      strokeDasharray="2 3"
                    />
                  );
                })}

                {/* Country markers */}
                {allMarkerCountries.map((d) => {
                  const coords = getCountryCoordinates(d.country);
                  if (!coords) return null;
                  const hasFounders = d.founders.length > 0;
                  const r = markerRadius(d.founders.length);
                  return (
                    <Marker key={`m-${d.country}`} coordinates={coords}>
                      {hasFounders && (
                        <circle
                          r={r}
                          fill={founderFill(d.founders.length)}
                          className="gnm-pulse"
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                      <circle
                        r={hasFounders ? r : 3.5}
                        fill={hasFounders ? founderFill(d.founders.length) : "hsl(160, 60%, 45%)"}
                        stroke="#FFFFFF"
                        strokeWidth={1.25}
                        className="cursor-pointer transition-transform hover:scale-125"
                        onMouseEnter={(e) => showTooltip(e, d)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => setSelectedCountry(d)}
                      />
                    </Marker>
                  );
                })}

                {/* Morocco hub */}
                <Marker coordinates={MOROCCO}>
                  <circle r={12} fill="hsl(211, 100%, 44%)" opacity={0.14} />
                  <circle r={7} fill="hsl(211, 100%, 44%)" opacity={0.24} className="gnm-pulse" style={{ pointerEvents: "none" }} />
                  <circle
                    r={5.5}
                    fill="hsl(211, 100%, 44%)"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    className="cursor-pointer"
                    onMouseEnter={(e) => showTooltip(e, moroccoData)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => setSelectedCountry(moroccoData)}
                  />
                </Marker>
              </ZoomableGroup>
            </ComposableMap>

            {tooltip && (
              <div
                className="absolute pointer-events-none z-40 bg-popover/95 backdrop-blur border border-border/60 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[240px]"
                style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
              >
                <p className="font-semibold text-foreground text-[13px]">{tooltip.data.country}</p>
                <div className="flex gap-3 mt-1 text-[11px]">
                  {tooltip.data.founders.length > 0 && (
                    <span className="text-primary font-medium">{tooltip.data.founders.length} founder{tooltip.data.founders.length > 1 ? "s" : ""}</span>
                  )}
                  {tooltip.data.stakeholders.length > 0 && (
                    <span className="text-emerald-700 font-medium">{tooltip.data.stakeholders.length} stakeholder{tooltip.data.stakeholders.length > 1 ? "s" : ""}</span>
                  )}
                </div>
                {tooltip.data.founders.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {tooltip.data.founders.slice(0, 4).map((f, i) => (
                      <li key={i} className="text-muted-foreground truncate">
                        <span className="text-foreground">{f.name}</span> · {f.startup}
                      </li>
                    ))}
                    {tooltip.data.founders.length > 4 && (
                      <li className="text-muted-foreground italic">+{tooltip.data.founders.length - 4} more</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {/* Selected country panel */}
            {selectedCountry && (
              <div className="absolute bottom-3 left-3 z-30 w-[280px] max-h-[60%] overflow-hidden bg-popover/95 backdrop-blur border border-border/60 rounded-xl shadow-lg flex flex-col">
                <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/40">
                  <p className="text-[13px] font-semibold text-foreground flex-1 truncate">{selectedCountry.country}</p>
                  <button
                    onClick={() => setSelectedCountry(null)}
                    className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="overflow-y-auto p-3 space-y-3 text-xs">
                  {selectedCountry.founders.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Founders ({selectedCountry.founders.length})
                      </p>
                      <ul className="space-y-0.5">
                        {selectedCountry.founders.map((f, i) => (
                          <li key={i} className="text-muted-foreground">
                            <span className="text-foreground font-medium">{f.name}</span> · {f.startup}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedCountry.stakeholders.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Stakeholders ({selectedCountry.stakeholders.length})
                      </p>
                      <ul className="space-y-0.5">
                        {selectedCountry.stakeholders.map((s, i) => (
                          <li key={i} className="text-muted-foreground">
                            <span className="text-foreground font-medium">{s.name}</span>
                            {s.institution && <> · {s.institution}</>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedCountry.founders.length === 0 && selectedCountry.stakeholders.length === 0 && (
                    <p className="text-muted-foreground italic">No data.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-5 px-5 py-2.5 border-t border-border/40 bg-muted/20 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-primary/20" style={{ background: "hsl(211, 100%, 44%)" }} />
          <span className="text-muted-foreground">Morocco hub</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(0, 113, 227, 0.85)" }} />
          <span className="text-muted-foreground">Founders</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(160, 60%, 45%)" }} />
          <span className="text-muted-foreground">Stakeholders</span>
        </div>
      </div>
    </div>
  );
}
