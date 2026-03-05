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

// Geo URL for world map
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Coordinate lookup for countries
const COORDS: Record<string, [number, number]> = {
  "Afghanistan": [69.1, 33.9], "Albania": [20.2, 41.3], "Algeria": [3.0, 36.7],
  "Andorra": [1.5, 42.5], "Angola": [13.2, -8.8], "Argentina": [-58.4, -34.6],
  "Armenia": [44.5, 40.2], "Australia": [149.1, -35.3], "Austria": [16.4, 48.2],
  "Azerbaijan": [49.9, 40.4], "Bahamas": [-77.3, 25.0], "Bahrain": [50.6, 26.2],
  "Bangladesh": [90.4, 23.7], "Barbados": [-59.6, 13.1], "Belarus": [27.6, 53.9],
  "Belgium": [4.4, 50.8], "Benin": [2.6, 6.5], "Bhutan": [89.6, 27.5],
  "Bolivia": [-68.1, -16.5], "Bosnia and Herzegovina": [18.4, 43.9],
  "Botswana": [25.9, -24.7], "Brazil": [-47.9, -15.8], "Brunei": [114.9, 4.9],
  "Bulgaria": [23.3, 42.7], "Burkina Faso": [-1.5, 12.4], "Burundi": [29.4, -3.4],
  "Cabo Verde": [-23.5, 14.9], "Cambodia": [104.9, 11.6], "Cameroon": [11.5, 3.9],
  "Canada": [-75.7, 45.4], "Central African Republic": [18.6, 4.4],
  "Chad": [15.0, 12.1], "Chile": [-70.7, -33.4], "China": [116.4, 39.9],
  "Colombia": [-74.1, 4.6], "Comoros": [43.3, -11.7], "Congo": [15.3, -4.3],
  "Congo (DRC)": [15.3, -4.3], "Costa Rica": [-84.1, 9.9],
  "Côte d'Ivoire": [-5.5, 6.8], "Croatia": [16.0, 45.8], "Cuba": [-82.4, 23.1],
  "Cyprus": [33.4, 35.2], "Czech Republic": [14.4, 50.1], "Denmark": [12.6, 55.7],
  "Djibouti": [43.1, 11.6], "Dominican Republic": [-69.9, 18.5],
  "Ecuador": [-78.5, -0.2], "Egypt": [31.2, 30.0], "El Salvador": [-89.2, 13.7],
  "Equatorial Guinea": [8.8, 3.8], "Eritrea": [38.9, 15.3], "Estonia": [24.7, 59.4],
  "Eswatini": [31.1, -26.3], "Ethiopia": [38.7, 9.0], "Fiji": [178.0, -18.1],
  "Finland": [24.9, 60.2], "France": [2.3, 48.9], "Gabon": [9.5, 0.4],
  "Gambia": [-16.6, 13.5], "Georgia": [44.8, 41.7], "Germany": [13.4, 52.5],
  "Ghana": [-0.2, 5.6], "Greece": [23.7, 37.9], "Guatemala": [-90.5, 14.6],
  "Guinea": [-13.7, 9.5], "Guinea-Bissau": [-15.6, 11.9], "Guyana": [-58.2, 6.8],
  "Haiti": [-72.3, 18.5], "Honduras": [-87.2, 14.1], "Hungary": [19.0, 47.5],
  "Iceland": [-22.0, 64.1], "India": [77.2, 28.6], "Indonesia": [106.8, -6.2],
  "Iran": [51.4, 35.7], "Iraq": [44.4, 33.3], "Ireland": [-6.3, 53.3],
  "Israel": [35.2, 31.8], "Italy": [12.5, 41.9], "Jamaica": [-76.8, 18.0],
  "Japan": [139.7, 35.7], "Jordan": [35.9, 31.9], "Kazakhstan": [71.4, 51.1],
  "Kenya": [36.8, -1.3], "Kuwait": [47.9, 29.4], "Kyrgyzstan": [74.6, 42.9],
  "Laos": [102.6, 17.9], "Latvia": [24.1, 56.9], "Lebanon": [35.5, 33.9],
  "Lesotho": [29.3, -29.3], "Liberia": [-10.8, 6.3], "Libya": [13.2, 32.9],
  "Lithuania": [25.3, 54.7], "Luxembourg": [6.1, 49.6], "Madagascar": [47.5, -18.9],
  "Malawi": [33.8, -13.9], "Malaysia": [101.7, 3.1], "Maldives": [73.5, 4.2],
  "Mali": [-8.0, 12.6], "Malta": [14.5, 35.9], "Mauritania": [-15.9, 18.1],
  "Mauritius": [57.5, -20.2], "Mexico": [-99.1, 19.4], "Moldova": [28.8, 47.0],
  "Monaco": [7.4, 43.7], "Mongolia": [106.9, 47.9], "Montenegro": [19.3, 42.4],
  "Morocco": [-6.8, 33.9], "Mozambique": [32.6, -25.9], "Myanmar": [96.2, 16.9],
  "Namibia": [17.1, -22.6], "Nepal": [85.3, 27.7], "Netherlands": [4.9, 52.4],
  "New Zealand": [174.8, -41.3], "Nicaragua": [-86.3, 12.1], "Niger": [2.1, 13.5],
  "Nigeria": [7.5, 9.1], "North Korea": [125.8, 39.0],
  "North Macedonia": [21.4, 42.0], "Norway": [10.8, 59.9], "Oman": [58.5, 23.6],
  "Pakistan": [73.0, 33.7], "Palestine": [35.2, 31.9], "Panama": [-79.5, 9.0],
  "Papua New Guinea": [147.2, -6.3], "Paraguay": [-57.6, -25.3],
  "Peru": [-77.0, -12.0], "Philippines": [121.0, 14.6], "Poland": [21.0, 52.2],
  "Portugal": [-9.1, 38.7], "Qatar": [51.5, 25.3], "Romania": [26.1, 44.4],
  "Russia": [37.6, 55.8], "Rwanda": [29.9, -1.9], "Saudi Arabia": [46.7, 24.7],
  "Senegal": [-17.4, 14.7], "Serbia": [20.5, 44.8], "Sierra Leone": [-13.2, 8.5],
  "Singapore": [103.9, 1.3], "Slovakia": [17.1, 48.1], "Slovenia": [14.5, 46.1],
  "Somalia": [45.3, 2.0], "South Africa": [28.0, -26.2], "South Korea": [127.0, 37.6],
  "South Sudan": [31.6, 4.9], "Spain": [-3.7, 40.4], "Sri Lanka": [79.9, 6.9],
  "Sudan": [32.5, 15.6], "Suriname": [-55.2, 5.8], "Sweden": [18.1, 59.3],
  "Switzerland": [7.4, 46.9], "Syria": [36.3, 33.5], "Taiwan": [121.5, 25.0],
  "Tajikistan": [68.8, 38.6], "Tanzania": [39.3, -6.8], "Thailand": [100.5, 13.8],
  "Togo": [1.2, 6.1], "Trinidad and Tobago": [-61.5, 10.7], "Tunisia": [10.2, 36.8],
  "Turkey": [32.9, 39.9], "Turkmenistan": [58.4, 37.9], "Uganda": [32.6, 0.3],
  "Ukraine": [30.5, 50.4], "United Arab Emirates": [54.4, 24.5],
  "United Kingdom": [-0.1, 51.5], "United States": [-77.0, 38.9],
  "Uruguay": [-56.2, -34.9], "Uzbekistan": [69.3, 41.3], "Venezuela": [-66.9, 10.5],
  "Vietnam": [105.8, 21.0], "Yemen": [44.2, 15.4], "Zambia": [28.3, -15.4],
  "Zimbabwe": [31.1, -17.8],
};

const MOROCCO: [number, number] = [-6.8, 33.9];

interface CountryData {
  country: string;
  founderCount: number;
  expertCount: number;
  institutions: string[];
}

export default function GlobalNetworkMap() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: CountryData } | null>(null);

  const { data: founders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("nationalities");
      if (error) throw error;
      return data;
    },
  });

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stakeholders").select("based_in_country, institution_name");
      if (error) throw error;
      return data;
    },
  });

  const countryData = useMemo(() => {
    const map: Record<string, CountryData> = {};

    // Aggregate founders nationalities
    founders.forEach((f) => {
      const nats = (f.nationalities as string[] | null) || [];
      nats.forEach((country) => {
        if (!country || country === "Morocco") return;
        if (!map[country]) map[country] = { country, founderCount: 0, expertCount: 0, institutions: [] };
        map[country].founderCount++;
      });
    });

    // Aggregate stakeholders
    stakeholders.forEach((s) => {
      const country = s.based_in_country;
      if (!country || country === "Morocco") return;
      if (!map[country]) map[country] = { country, founderCount: 0, expertCount: 0, institutions: [] };
      map[country].expertCount++;
      if (s.institution_name && !map[country].institutions.includes(s.institution_name)) {
        map[country].institutions.push(s.institution_name);
      }
    });

    return Object.values(map);
  }, [founders, stakeholders]);

  const founderCountries = countryData.filter((d) => d.founderCount > 0);
  const expertCountries = countryData.filter((d) => d.expertCount > 0);

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

            {/* Connection lines - Founders (orange) */}
            {founderCountries.map((d) => {
              const coords = COORDS[d.country];
              if (!coords) return null;
              return (
                <Line
                  key={`fl-${d.country}`}
                  from={coords}
                  to={MOROCCO}
                  stroke="hsl(var(--primary) / 0.3)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                />
              );
            })}

            {/* Connection lines - Experts (blue) */}
            {expertCountries.map((d) => {
              const coords = COORDS[d.country];
              if (!coords) return null;
              return (
                <Line
                  key={`el-${d.country}`}
                  from={coords}
                  to={MOROCCO}
                  stroke="hsl(var(--module-events) / 0.3)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                />
              );
            })}

            {/* Morocco hub marker */}
            <Marker coordinates={MOROCCO}>
              <circle r={6} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
              <circle r={10} fill="hsl(var(--primary) / 0.2)" />
            </Marker>

            {/* Founder dots */}
            {founderCountries.map((d) => {
              const coords = COORDS[d.country];
              if (!coords) return null;
              return (
                <Marker
                  key={`fm-${d.country}`}
                  coordinates={coords}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data: d });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle
                    r={Math.min(3 + d.founderCount, 8)}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                    className="cursor-pointer"
                  />
                </Marker>
              );
            })}

            {/* Expert dots */}
            {expertCountries.map((d) => {
              const coords = COORDS[d.country];
              if (!coords) return null;
              // Offset slightly if also a founder country
              const offset = d.founderCount > 0 ? 4 : 0;
              return (
                <Marker
                  key={`em-${d.country}`}
                  coordinates={[coords[0] + offset * 0.3, coords[1] + offset * 0.3]}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data: d });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle
                    r={Math.min(3 + d.expertCount, 8)}
                    fill="hsl(var(--module-events))"
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                    className="cursor-pointer"
                  />
                </Marker>
              );
            })}
          </ComposableMap>

          {/* Tooltip */}
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
                      {tooltip.data.institutions.map((inst) => (
                        <li key={inst}>{inst}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
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
