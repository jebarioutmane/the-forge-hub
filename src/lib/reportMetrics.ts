import { supabase } from "@/integrations/supabase/client";

export type MetricValue = { number: number | null; text: string | null };

export type MetricContext = {
  cohortId: string | null; // null = all cohorts
  periodStart: string;     // ISO date (yyyy-mm-dd)
  periodEnd: string;       // ISO date (yyyy-mm-dd)
};

const empty: MetricValue = { number: null, text: null };

function withinMonth(payment_month: string | null, start: string, end: string) {
  if (!payment_month) return false;
  // payment_month is YYYY-MM
  const m = payment_month.length >= 7 ? payment_month.slice(0, 7) : payment_month;
  return m >= start.slice(0, 7) && m <= end.slice(0, 7);
}

async function fetchFounders(cohortId: string | null) {
  let q = supabase.from("founders").select("id,stage,funding_raised,nationality,is_archived,cohort_id").eq("is_archived", false);
  if (cohortId) q = q.eq("cohort_id", cohortId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

async function fetchEngagement(cohortId: string | null) {
  let q = supabase.from("founder_engagement").select("founder_id,cohort_id,risk_status,attendance_rate");
  if (cohortId) q = q.eq("cohort_id", cohortId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function computeMetric(metric: string, ctx: MetricContext): Promise<MetricValue> {
  try {
    switch (metric) {
      case "active_founders": {
        const rows = await fetchFounders(ctx.cohortId);
        return { number: rows.length, text: null };
      }
      case "at_risk_count":
      case "watch_count":
      case "on_track_count": {
        const map: Record<string, string> = {
          at_risk_count: "at_risk",
          watch_count: "watch",
          on_track_count: "on_track",
        };
        const rows = await fetchEngagement(ctx.cohortId);
        const n = rows.filter((r: any) => r.risk_status === map[metric]).length;
        return { number: n, text: null };
      }
      case "avg_attendance_rate": {
        const rows = await fetchEngagement(ctx.cohortId);
        const vals = rows.map((r: any) => Number(r.attendance_rate)).filter((v) => !Number.isNaN(v));
        if (vals.length === 0) return empty;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { number: Math.round(avg * 10) / 10, text: `${Math.round(avg)}%` };
      }
      case "total_checkins": {
        let q = supabase.from("founder_checkins").select("id,founder_id,checkin_date", { count: "exact", head: true })
          .gte("checkin_date", ctx.periodStart).lte("checkin_date", ctx.periodEnd);
        if (ctx.cohortId) {
          const founders = await fetchFounders(ctx.cohortId);
          const ids = founders.map((f: any) => f.id);
          if (ids.length === 0) return { number: 0, text: null };
          q = q.in("founder_id", ids);
        }
        const { count, error } = await q;
        if (error) throw error;
        return { number: count ?? 0, text: null };
      }
      case "total_events": {
        let q = supabase.from("events").select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .gte("start_date", ctx.periodStart).lte("start_date", ctx.periodEnd);
        if (ctx.cohortId) {
          // events.cohort_year is text (label) — try matching cohort label if available
          const { data: c } = await supabase.from("cohorts").select("label,year").eq("id", ctx.cohortId).maybeSingle();
          if (c?.label) q = q.eq("cohort_year", c.label);
        }
        const { count, error } = await q;
        if (error) throw error;
        return { number: count ?? 0, text: null };
      }
      case "total_mentoring_sessions": {
        const { count, error } = await supabase.from("mentoring_sessions").select("id", { count: "exact", head: true })
          .gte("session_date", ctx.periodStart).lte("session_date", ctx.periodEnd);
        if (error) throw error;
        return { number: count ?? 0, text: null };
      }
      case "founders_by_stage": {
        const rows = await fetchFounders(ctx.cohortId);
        const map: Record<string, number> = {};
        rows.forEach((r: any) => {
          const k = r.stage || "Unspecified";
          map[k] = (map[k] ?? 0) + 1;
        });
        const parts = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`);
        return { number: rows.length, text: parts.join(" · ") || null };
      }
      case "total_funding_raised": {
        const rows = await fetchFounders(ctx.cohortId);
        const sum = rows.reduce((a: number, r: any) => a + (Number(r.funding_raised) || 0), 0);
        return { number: sum, text: null };
      }
      case "evaluation_decisions_breakdown": {
        let q = supabase.from("founder_evaluations").select("decision,founder_id")
          .eq("is_archived", false)
          .gte("evaluation_date", ctx.periodStart).lte("evaluation_date", ctx.periodEnd);
        const { data, error } = await q;
        if (error) throw error;
        let rows = data ?? [];
        if (ctx.cohortId) {
          const founders = await fetchFounders(ctx.cohortId);
          const ids = new Set(founders.map((f: any) => f.id));
          rows = rows.filter((r: any) => ids.has(r.founder_id));
        }
        const map: Record<string, number> = {};
        rows.forEach((r: any) => {
          const k = r.decision || "Undecided";
          map[k] = (map[k] ?? 0) + 1;
        });
        const parts = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`);
        return { number: rows.length, text: parts.join(" · ") || null };
      }
      case "avg_evaluation_score": {
        let q = supabase.from("founder_evaluations").select("total_score,founder_id")
          .eq("is_archived", false)
          .gte("evaluation_date", ctx.periodStart).lte("evaluation_date", ctx.periodEnd);
        const { data, error } = await q;
        if (error) throw error;
        let rows = data ?? [];
        if (ctx.cohortId) {
          const founders = await fetchFounders(ctx.cohortId);
          const ids = new Set(founders.map((f: any) => f.id));
          rows = rows.filter((r: any) => ids.has(r.founder_id));
        }
        const vals = rows.map((r: any) => Number(r.total_score)).filter((v) => !Number.isNaN(v));
        if (vals.length === 0) return empty;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { number: Math.round(avg * 10) / 10, text: null };
      }
      case "budget_allocated": {
        let q = supabase.from("budget_lines").select("allocated_amount,cohort_id").eq("is_archived", false);
        if (ctx.cohortId) q = q.eq("cohort_id", ctx.cohortId);
        const { data, error } = await q;
        if (error) throw error;
        const sum = (data ?? []).reduce((a: number, r: any) => a + (Number(r.allocated_amount) || 0), 0);
        return { number: sum, text: null };
      }
      case "budget_spent": {
        // paid expenses + paid stipends + paid contract payments in period
        let expQ = supabase.from("expenses").select("amount,cohort_id,due_date,status,created_at")
          .eq("is_archived", false).eq("status", "Paid");
        if (ctx.cohortId) expQ = expQ.eq("cohort_id", ctx.cohortId);
        const { data: exp, error: e1 } = await expQ;
        if (e1) throw e1;
        const expSum = (exp ?? []).filter((r: any) => {
          const d = r.due_date ?? r.created_at?.slice(0, 10);
          return d && d >= ctx.periodStart && d <= ctx.periodEnd;
        }).reduce((a: number, r: any) => a + (Number(r.amount) || 0), 0);

        let stipQ = supabase.from("stipend_records").select("total_net,payment_month,status,cohort_year")
          .eq("is_archived", false).eq("status", "paid");
        if (ctx.cohortId) {
          const { data: c } = await supabase.from("cohorts").select("label").eq("id", ctx.cohortId).maybeSingle();
          if (c?.label) stipQ = stipQ.eq("cohort_year", c.label);
        }
        const { data: stip, error: e2 } = await stipQ;
        if (e2) throw e2;
        const stipSum = (stip ?? []).filter((r: any) => withinMonth(r.payment_month, ctx.periodStart, ctx.periodEnd))
          .reduce((a: number, r: any) => a + (Number(r.total_net) || 0), 0);

        const { data: pay, error: e3 } = await supabase.from("contract_payments").select("amount,payment_date,status")
          .eq("status", "paid")
          .gte("payment_date", ctx.periodStart).lte("payment_date", ctx.periodEnd);
        if (e3) throw e3;
        const paySum = (pay ?? []).reduce((a: number, r: any) => a + (Number(r.amount) || 0), 0);

        return { number: expSum + stipSum + paySum, text: null };
      }
      case "budget_committed": {
        let q = supabase.from("contracts").select("value,cohort_id,status")
          .eq("is_archived", false).eq("status", "Active");
        if (ctx.cohortId) q = q.eq("cohort_id", ctx.cohortId);
        const { data, error } = await q;
        if (error) throw error;
        const sum = (data ?? []).reduce((a: number, r: any) => a + (Number(r.value) || 0), 0);
        return { number: sum, text: null };
      }
      case "budget_remaining": {
        const alloc = await computeMetric("budget_allocated", ctx);
        const spent = await computeMetric("budget_spent", ctx);
        const commit = await computeMetric("budget_committed", ctx);
        return { number: (alloc.number ?? 0) - (spent.number ?? 0) - (commit.number ?? 0), text: null };
      }
      case "stipends_paid": {
        let q = supabase.from("stipend_records").select("total_net,payment_month,status,cohort_year")
          .eq("is_archived", false).eq("status", "paid");
        if (ctx.cohortId) {
          const { data: c } = await supabase.from("cohorts").select("label").eq("id", ctx.cohortId).maybeSingle();
          if (c?.label) q = q.eq("cohort_year", c.label);
        }
        const { data, error } = await q;
        if (error) throw error;
        const sum = (data ?? []).filter((r: any) => withinMonth(r.payment_month, ctx.periodStart, ctx.periodEnd))
          .reduce((a: number, r: any) => a + (Number(r.total_net) || 0), 0);
        return { number: sum, text: null };
      }
      case "active_contracts_count": {
        let q = supabase.from("contracts").select("id", { count: "exact", head: true })
          .eq("is_archived", false).eq("status", "Active");
        if (ctx.cohortId) q = q.eq("cohort_id", ctx.cohortId);
        const { count, error } = await q;
        if (error) throw error;
        return { number: count ?? 0, text: null };
      }
      case "active_contracts_value": {
        let q = supabase.from("contracts").select("value,cohort_id,status")
          .eq("is_archived", false).eq("status", "Active");
        if (ctx.cohortId) q = q.eq("cohort_id", ctx.cohortId);
        const { data, error } = await q;
        if (error) throw error;
        const sum = (data ?? []).reduce((a: number, r: any) => a + (Number(r.value) || 0), 0);
        return { number: sum, text: null };
      }
      case "stakeholders_count": {
        const { count, error } = await supabase.from("stakeholders").select("id", { count: "exact", head: true })
          .eq("is_archived", false);
        if (error) throw error;
        return { number: count ?? 0, text: null };
      }
      case "countries_represented": {
        const rows = await fetchFounders(ctx.cohortId);
        const set = new Set<string>();
        rows.forEach((r: any) => { if (r.nationality) set.add(String(r.nationality).trim()); });
        return { number: set.size, text: Array.from(set).sort().join(", ") || null };
      }
      default:
        return empty;
    }
  } catch (err) {
    console.error(`computeMetric ${metric} failed`, err);
    return empty;
  }
}

export function formatMetric(metric: string, v: MetricValue): string {
  if (v.text) return v.text;
  if (v.number === null || v.number === undefined) return "—";
  const moneyMetrics = new Set([
    "total_funding_raised", "budget_allocated", "budget_spent", "budget_committed",
    "budget_remaining", "stipends_paid", "active_contracts_value",
  ]);
  if (moneyMetrics.has(metric)) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v.number);
  }
  if (metric === "avg_attendance_rate") return `${Math.round(v.number)}%`;
  return new Intl.NumberFormat().format(v.number);
}
