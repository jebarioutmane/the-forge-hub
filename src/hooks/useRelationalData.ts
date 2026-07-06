import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFounders() {
  return useQuery({
    queryKey: ["founders-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name")
        .order("founder_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["vendors-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, type, email")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

