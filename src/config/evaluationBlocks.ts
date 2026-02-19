export interface BlockCategory {
  key: string;
  label: string;
}

export interface BlockMetric {
  key: string;
  label: string;
}

export interface BlockConfig {
  name: string;
  label: string;
  categories: BlockCategory[];
  metrics: BlockMetric[];
}

export const BLOCKS: BlockConfig[] = [
  {
    name: "Block 1",
    label: "Validation",
    categories: [
      { key: "problem_validation", label: "Problem Validation" },
      { key: "customer_discovery", label: "Customer Discovery" },
      { key: "early_partnerships", label: "Early Partnerships" },
      { key: "team_structure", label: "Team Structure" },
    ],
    metrics: [
      { key: "customer_interviews", label: "Customer Interviews" },
      { key: "validated_pain_points", label: "Validated Pain Points" },
      { key: "research_partnerships", label: "Research Partnerships" },
    ],
  },
  {
    name: "Block 2",
    label: "Build",
    categories: [
      { key: "product_development", label: "Product Development" },
      { key: "mvp_progress", label: "MVP Progress" },
      { key: "early_traction", label: "Early Traction" },
      { key: "team_hiring", label: "Team Hiring" },
    ],
    metrics: [
      { key: "product_completion_pct", label: "% Product Completion" },
      { key: "beta_users", label: "Beta Users" },
      { key: "prototype_iterations", label: "Prototype Iterations" },
    ],
  },
  {
    name: "Block 3",
    label: "Market Entry",
    categories: [
      { key: "clients_revenue", label: "Clients & Revenue" },
      { key: "market_presence", label: "Market Presence" },
      { key: "partnerships", label: "Partnerships" },
      { key: "funding_progress", label: "Funding Progress" },
    ],
    metrics: [
      { key: "monthly_revenue", label: "Monthly Revenue" },
      { key: "paying_customers", label: "Paying Customers" },
      { key: "partnership_deals", label: "Partnership Deals Signed" },
      { key: "funding_raised_usd", label: "Funding Raised (USD)" },
    ],
  },
  {
    name: "Block 4",
    label: "Scale",
    categories: [
      { key: "revenue_growth", label: "Revenue Growth" },
      { key: "operational_maturity", label: "Operational Maturity" },
      { key: "capital_raised", label: "Capital Raised" },
      { key: "strategic_expansion", label: "Strategic Expansion" },
    ],
    metrics: [
      { key: "mrr", label: "MRR" },
      { key: "burn_rate", label: "Burn Rate" },
      { key: "cac", label: "CAC" },
      { key: "capital_raised_total", label: "Capital Raised" },
      { key: "market_expansion_count", label: "Market Expansion Count" },
    ],
  },
];

export const SUPPORT_OPTIONS = [
  "Mentorship",
  "Funding Intro",
  "Technical Support",
  "Legal Support",
  "Marketing Support",
  "Hiring Support",
  "Strategic Advice",
  "Partnership Intro",
];

export interface CategoryData {
  rating: number;
  update: string;
  blockers: string;
  needs: string;
}

export interface MetricData {
  value: number | null;
  notes: string;
}

export function calculateScores(categoriesData: Record<string, CategoryData>) {
  const entries = Object.values(categoriesData);
  if (entries.length === 0) return { execution: 0, traction: 0, momentum: 0, total: 0 };

  const avgRating = entries.reduce((s, e) => s + (e.rating || 0), 0) / entries.length;
  const maxRating = 5;
  const normalized = avgRating / maxRating; // 0-1

  // Milestone Completion (40%): based on how many categories have rating >= 3
  const completed = entries.filter((e) => e.rating >= 3).length;
  const milestoneScore = (completed / entries.length) * 40;

  // Execution Quality (30%): average rating normalized
  const executionScore = normalized * 30;

  // Traction (20%): based on categories with rating >= 4
  const highPerformers = entries.filter((e) => e.rating >= 4).length;
  const tractionScore = (highPerformers / entries.length) * 20;

  // Momentum (10%): based on updates provided (engagement indicator)
  const withUpdates = entries.filter((e) => e.update.trim().length > 0).length;
  const momentumScore = (withUpdates / entries.length) * 10;

  const total = Math.round(milestoneScore + executionScore + tractionScore + momentumScore);

  return {
    execution: Math.round(executionScore * (100 / 30)),
    traction: Math.round(tractionScore * (100 / 20)),
    momentum: Math.round(momentumScore * (100 / 10)),
    total: Math.min(total, 100),
  };
}

export function getRiskTag(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "High Performer", color: "bg-emerald-500" };
  if (score >= 40) return { label: "On Track", color: "bg-amber-500" };
  return { label: "At Risk", color: "bg-red-500" };
}
