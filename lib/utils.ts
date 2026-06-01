import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Determine temperature unit from bucket value.
 * Polymarket US city markets use °F (values typically 50-110),
 * all others use °C (values typically -10 to 45).
 */
export function tempUnit(bucketValue: number | null | undefined): string {
  if (bucketValue == null) return "°C";
  return bucketValue > 50 ? "°F" : "°C";
}

/**
 * Parse temperature unit from a market question string.
 * Falls back to heuristic based on value if no unit symbol found.
 */
export function parseTemp(question: string | null): { value: number; unit: string } | null {
  if (!question) return null;
  const match = question.match(/(\d+)\s*°?\s*([CF])/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toUpperCase() === "F" ? "°F" : "°C";
  return { value, unit };
}
