export const SAVED_PRODUCTS_STORAGE_KEY = "sugarno.saved-products.v1";
export const MAX_SAVED_PRODUCTS = 40;

export function parseSavedProductIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0))]
      .slice(0, MAX_SAVED_PRODUCTS);
  } catch {
    return [];
  }
}

export function toggleSavedProductId(current: string[], productId: string): string[] {
  if (current.includes(productId)) return current.filter((id) => id !== productId);
  return [productId, ...current.filter((id) => id !== productId)].slice(0, MAX_SAVED_PRODUCTS);
}
