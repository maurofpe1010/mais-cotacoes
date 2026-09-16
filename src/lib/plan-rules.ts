export type PlanRules = { observations?: string | null; iof_percent?: number | null; discount_percent?: number | null; discount_min_lives?: number | null };
export function discountFor(plan: PlanRules, lives: number): number {
  const percent = Number(plan.discount_percent ?? 0), minimum = Number(plan.discount_min_lives ?? 0);
  return Number.isFinite(percent) && percent > 0 && percent <= 100 && Number.isInteger(minimum) && minimum >= 1 && lives >= minimum ? percent : 0;
}
export function discountedPrice(value: number | null, percent: number): number | null {
  if (value === null) return null;
  return Math.round((Math.round(value * 100) * (1 - percent / 100)) + 1e-8) / 100;
}
export function ruleDescription(plan: PlanRules): string {
  return Number(plan.discount_percent) > 0 && Number(plan.discount_min_lives) >= 1 ? `${Number(plan.discount_percent)}% de desconto a partir de ${plan.discount_min_lives} pessoa(s)` : "";
}

export function totalsWithIof(subtotal: number, plan: PlanRules, corporate: boolean) {
  const candidate = Number(plan.iof_percent ?? 0);
  const percent = corporate && Number.isFinite(candidate) && candidate >= 0 && candidate <= 100 ? candidate : 0;
  const rounded = Math.round(subtotal * 100) / 100;
  const iof = Math.round((rounded * percent / 100 + Number.EPSILON) * 100) / 100;
  return { subtotal: rounded, percent, iof, total: Math.round((rounded + iof) * 100) / 100 };
}
