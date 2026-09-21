export type PlanCommercialRules = { discount_percent?: number | null; discount_min_lives?: number | null; iof_percent?: number | null };
export type PriceBreakdown = { subtotal: number; discountPercent: number; discountAmount: number; afterDiscount: number; iofPercent: number; iofAmount: number; total: number };

function safePercent(value: number | null | undefined) { return Math.min(100, Math.max(0, Number(value) || 0)); }

export function calculatePlanTotal(subtotal: number, lives: number, rules: PlanCommercialRules, corporate: boolean): PriceBreakdown {
  const minimum = Math.max(1, Number(rules.discount_min_lives) || 1);
  const discountPercent = lives >= minimum ? safePercent(rules.discount_percent) : 0;
  const discountAmount = subtotal * discountPercent / 100;
  const afterDiscount = subtotal - discountAmount;
  const iofPercent = corporate ? safePercent(rules.iof_percent) : 0;
  const iofAmount = afterDiscount * iofPercent / 100;
  return { subtotal, discountPercent, discountAmount, afterDiscount, iofPercent, iofAmount, total: afterDiscount + iofAmount };
}
