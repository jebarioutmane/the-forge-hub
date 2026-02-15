import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function OperationsContracts() {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusVariant = (s: string | null) => {
    if (s === "Signed") return "default";
    if (s === "Sent") return "secondary";
    return "outline";
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Contracts</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Stakeholder</TableHead>
                <TableHead className="text-right">Value (MAD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : contracts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No contracts yet</TableCell></TableRow>
              ) : (
                contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.stakeholder_name}</TableCell>
                    <TableCell className="text-right">{c.value ? Number(c.value).toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.start_date || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.end_date || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
