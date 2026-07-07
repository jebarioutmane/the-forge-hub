import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cake, PartyPopper } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface UpcomingBirthday {
  id: string;
  founder_name: string;
  startup_name: string;
  photo_url: string | null;
  birthday: string;
  daysUntil: number;
  displayDate: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function BirthdaysPanel() {
  const { data: founders = [] } = useQuery({
    queryKey: ["founders-birthdays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, photo_url, birthday")
        .not("birthday", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const upcoming: UpcomingBirthday[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const results: UpcomingBirthday[] = [];

    founders.forEach((f: any) => {
      if (!f.birthday) return;
      const b = new Date(f.birthday);
      if (isNaN(b.getTime())) return;
      const month = b.getMonth();
      const day = b.getDate();

      // Try this year and next year to handle year-end wrap
      for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        const candidate = new Date(year, month, day);
        candidate.setHours(0, 0, 0, 0);
        const diff = Math.round((candidate.getTime() - today.getTime()) / 86400000);
        if (diff >= 0 && diff <= 7) {
          results.push({
            id: f.id,
            founder_name: f.founder_name,
            startup_name: f.startup_name,
            photo_url: f.photo_url,
            birthday: f.birthday,
            daysUntil: diff,
            displayDate: `${MONTHS[month]} ${day}`,
          });
          break;
        }
      }
    });

    return results.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [founders]);

  if (upcoming.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md border border-border bg-secondary flex items-center justify-center">
            <Cake className="h-4 w-4 text-ink" />
          </div>
          <h3 className="font-serif text-base font-semibold text-ink tracking-tight">Birthdays</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-3">No upcoming birthdays in the next 7 days.</p>
      </div>
    );
  }

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md border border-border bg-secondary flex items-center justify-center">
          <Cake className="h-4 w-4 text-ink" />
        </div>
        <h3 className="font-serif text-base font-semibold text-ink tracking-tight">
          Upcoming Birthdays
        </h3>
        <Badge variant="outline" className="ml-auto">Next 7 days</Badge>
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        {upcoming.map((entry) => {
          const isToday = entry.daysUntil === 0;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isToday
                  ? "bg-pink-50 border border-pink-200"
                  : "hover:bg-accent/50"
              }`}
            >
              <Avatar className="h-9 w-9 shrink-0">
                {entry.photo_url && <AvatarImage src={entry.photo_url} alt={entry.founder_name} />}
                <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                  {getInitials(entry.founder_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-foreground truncate leading-tight">
                  {entry.founder_name}
                </p>
                <p className="text-[12px] text-muted-foreground truncate leading-tight">
                  {entry.startup_name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isToday ? (
                  <Badge className="text-[10px] bg-pink-100 text-pink-700 border-pink-200 gap-1">
                    <PartyPopper className="h-3 w-3" />
                    Today
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {entry.displayDate}
                    <span className="ml-1 text-muted-foreground">
                      · {entry.daysUntil}d
                    </span>
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
