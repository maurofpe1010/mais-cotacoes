export function cleanQuoteTitle(value: string | null | undefined): string {
  return (value ?? "").replace(/^(?:\s*cota[çc][ãa]o\s*[-–—:]\s*)+/i, "").trim();
}

export function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}
