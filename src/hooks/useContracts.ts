import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContractRow {
  id: string;
  title: string;
  description: string | null;
  vendor_id: string | null;
  stakeholder_name: string;
  type: string | null;
  status: string | null;
  value: number | null;
  currency: string | null;
  payment_structure: string | null;
  cohort_id: string | null;
  budget_line_id: string | null;
  start_date: string | null;
  end_date: string | null;
  tag_ids: string[] | null;
  owner_id: string | null;
}

export interface ContractPayment {
  id: string;
  contract_id: string;
  amount: number;
  payment_date: string | null;
  status: string;
  expense_id: string | null;
  created_at: string | null;
}

export interface ContractMilestone {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  payment_amount: number;
  status: string;
  created_at: string | null;
}

export interface ContractLink {
  id: string;
  contract_id: string;
  title: string | null;
  url: string;
  created_at: string | null;
}

export interface ContractDocument {
  id: string;
  contract_id: string;
  file_url: string;
  file_name: string;
  created_at: string | null;
}

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as unknown as ContractRow[];
    },
  });
}

export function useContractPayments(contractId: string | null) {
  return useQuery({
    queryKey: ["contract-payments", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments" as any)
        .select("*")
        .eq("contract_id", contractId!)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ContractPayment[];
    },
  });
}

export function useContractMilestones(contractId: string | null) {
  return useQuery({
    queryKey: ["contract-milestones", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_milestones" as any)
        .select("*")
        .eq("contract_id", contractId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ContractMilestone[];
    },
  });
}

export function useContractLinks(contractId: string | null) {
  return useQuery({
    queryKey: ["contract-links", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_links" as any)
        .select("*")
        .eq("contract_id", contractId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContractLink[];
    },
  });
}

export function useContractDocuments(contractId: string | null) {
  return useQuery({
    queryKey: ["contract-documents", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_documents" as any)
        .select("*")
        .eq("contract_id", contractId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContractDocument[];
    },
  });
}

export function useBudgetLinesByCohort(cohortId: string | null) {
  return useQuery({
    queryKey: ["budget-lines-by-cohort", cohortId],
    enabled: !!cohortId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_lines")
        .select("id, code, name, allocated_amount, cohort_id")
        .eq("cohort_id", cohortId!)
        .order("code");
      if (error) throw error;
      return data;
    },
  });
}

export function useContractMutations() {
  const qc = useQueryClient();

  const addPayment = useMutation({
    mutationFn: async (p: Omit<ContractPayment, "id" | "created_at">) => {
      const { error } = await supabase.from("contract_payments" as any).insert(p as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-payments"] }); toast.success("Payment added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<ContractPayment> & { id: string }) => {
      const { error } = await supabase.from("contract_payments" as any).update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-payments"] }); toast.success("Payment updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_payments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-payments"] }); toast.success("Payment deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addMilestone = useMutation({
    mutationFn: async (m: Omit<ContractMilestone, "id" | "created_at">) => {
      const { error } = await supabase.from("contract_milestones" as any).insert(m as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-milestones"] }); toast.success("Milestone added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<ContractMilestone> & { id: string }) => {
      const { error } = await supabase.from("contract_milestones" as any).update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-milestones"] }); toast.success("Milestone updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_milestones" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-milestones"] }); toast.success("Milestone deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addLink = useMutation({
    mutationFn: async (l: Omit<ContractLink, "id" | "created_at">) => {
      const { error } = await supabase.from("contract_links" as any).insert(l as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-links"] }); toast.success("Link added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_links" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-links"] }); toast.success("Link deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addDocument = useMutation({
    mutationFn: async (d: Omit<ContractDocument, "id" | "created_at">) => {
      const { error } = await supabase.from("contract_documents" as any).insert(d as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-documents"] }); toast.success("Document added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_documents" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-documents"] }); toast.success("Document deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return { addPayment, updatePayment, deletePayment, addMilestone, updateMilestone, deleteMilestone, addLink, deleteLink, addDocument, deleteDocument };
}
