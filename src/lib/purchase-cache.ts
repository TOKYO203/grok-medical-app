import type { PremiumPurchase } from "@/content/purchase-order";
import { useOptimus } from "@/state/store";

/**
 * Purchase rows in Zustand are an offline display cache only.
 * Canonical amount/product/status always come from the authenticated server registry.
 */
export function cacheServerPurchase(purchase: PremiumPurchase): void {
  useOptimus.setState((state) => ({
    purchases: [
      purchase,
      ...state.purchases.filter((saved) => saved.reference !== purchase.reference),
    ],
  }));
}

export function replacePurchaseCache(purchases: PremiumPurchase[]): void {
  const deduplicated = new Map<string, PremiumPurchase>();
  for (const purchase of purchases) {
    const previous = deduplicated.get(purchase.reference);
    if (!previous || purchase.updatedAt >= previous.updatedAt) {
      deduplicated.set(purchase.reference, purchase);
    }
  }
  useOptimus.setState({
    purchases: [...deduplicated.values()].sort((a, b) => b.updatedAt - a.updatedAt),
  });
}
