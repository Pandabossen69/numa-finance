/**
 * Future affordability simulation — never mutates canonical records.
 * Phase 0: type + pure stub shape only.
 */
import type { Money } from "@/domain/money";
import { calculateSafeToSpend, type SafeToSpendInput } from "@/domain/finance/safe-to-spend";
import { money } from "@/domain/money";

export type AffordabilityInput = SafeToSpendInput & {
  purchase: Money;
};

export type AffordabilityResult = {
  afterAvailable: Money;
  afterReserved: Money;
  afterFree: Money;
  afterSafeToday: Money;
  recommended: boolean;
  deficitBeforeIncome: Money | null;
};

export function simulatePurchase(input: AffordabilityInput): AffordabilityResult {
  const afterAvailable = money(
    input.available.amountMinor - input.purchase.amountMinor,
    input.available.currency,
  );
  const safe = calculateSafeToSpend({
    ...input,
    available: afterAvailable,
  });

  const deficit =
    afterAvailable.amountMinor -
      input.reserved.amountMinor -
      input.safetyBuffer.amountMinor <
    0
      ? money(
          Math.abs(
            afterAvailable.amountMinor -
              input.reserved.amountMinor -
              input.safetyBuffer.amountMinor,
          ),
          input.available.currency,
        )
      : null;

  return {
    afterAvailable,
    afterReserved: input.reserved,
    afterFree: safe.free,
    afterSafeToday: safe.today,
    recommended: deficit == null && safe.today.amountMinor >= 0,
    deficitBeforeIncome: deficit,
  };
}
