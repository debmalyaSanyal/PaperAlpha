type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flatMap((input): string[] => {
      if (!input) return [];
      if (typeof input === "string" || typeof input === "number") return [String(input)];
      if (Array.isArray(input)) return [cn(...input)];
      return Object.entries(input)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([className]) => className);
    })
    .filter(Boolean)
    .join(" ");
}

/** Count words the way a document word-count does (whitespace separated tokens). */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const stripped = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_>`|-]/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(Boolean).length;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;
}

/** Estimate reading/processing tokens (~4 chars per token) for context budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function slugify(input: string, maxLength = 60): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Roman numerals for IEEE-style section numbering (I, II, III, IV ...). */
export function romanUpper(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "";
  const table: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = Math.floor(n);
  let out = "";
  for (const [value, symbol] of table) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}

/** Alphabetic labels A, B, ... Z, AA, AB ... for IEEE level-2 headings. */
export function alphaUpper(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "";
  let remaining = Math.floor(n);
  let out = "";
  while (remaining > 0) {
    const rem = (remaining - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return out;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "\u2014";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Chunk an array without mutating it. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
