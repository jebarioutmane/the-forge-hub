import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePresence() {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Remove any existing channel with this name first to avoid
    // "cannot add presence callbacks after subscribe()" in strict mode
    const existing = supabase.getChannels().find(c => c.topic === "realtime:online-users");
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    // All .on() calls MUST happen before .subscribe()
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const ids = new Set<string>();
      Object.keys(state).forEach((key) => ids.add(key));
      setOnlineUserIds(ids);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
      }
    });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { onlineUserIds };
}
