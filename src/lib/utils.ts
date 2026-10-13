import type { Frequency } from "@prisma/client";

export function amountToPesewas(amount: string): number {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount)) {
    throw new Error("Invalid GHS amount.");
  }
  const [whole, fraction = ""] = amount.split(".");
  const pesewas = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (pesewas < BigInt(100) || pesewas > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("GHS amount is outside the supported range.");
  }
  return Number(pesewas);
}

export function normalizeGhsAmount(amount: string): string {
  const [whole, fraction = ""] = amount.split(".");
  return `${BigInt(whole).toString()}.${fraction.padEnd(2, "0")}`;
}

export function formatGhs(amount: string): string {
  const [whole, fraction = ""] = amount.split(".");
  const formattedWhole = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 }).format(BigInt(whole));
  return `GHS ${formattedWhole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export function formatPesewas(amount: bigint): string {
  const whole = amount / BigInt(100);
  const fraction = (amount % BigInt(100)).toString().padStart(2, "0");
  return formatGhs(`${whole.toString()}.${fraction}`);
}

/**
 * Returns the start of a cycle anchored to the group's original start date.
 * Monthly periods use calendar-month arithmetic and clamp dates like Jan 31
 * to the last day of shorter months. Africa/Accra is UTC+00:00.
 */
export function cycleStartDate(startDate: Date, frequency: Frequency, cycle: number): Date {
  if (!Number.isInteger(cycle) || cycle < 1) {
    throw new Error("Cycle must be a positive integer.");
  }
  const result = new Date(startDate);
  if (frequency === "WEEKLY") {
    result.setUTCDate(result.getUTCDate() + (cycle - 1) * 7);
    return result;
  }

  const startMonth = startDate.getUTCMonth();
  const targetMonthIndex = startMonth + cycle - 1;
  const targetYear = startDate.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  result.setUTCFullYear(targetYear, targetMonth, Math.min(startDate.getUTCDate(), lastDay));
  return result;
}

export function formatAccraDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function dateInputValue(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getAppBaseUrl(requestOrigin?: string | null): string {
  if (process.env.NODE_ENV === "development" && requestOrigin) {
    try {
      const requestUrl = new URL(requestOrigin);
      if (requestUrl.hostname.endsWith(".e2b.app")) return requestUrl.origin;
    } catch {
      // Ignore malformed request origins and use the configured canonical URL.
    }
  }

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}

