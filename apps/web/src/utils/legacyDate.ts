function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatLegacyDate(value: string): string {
  const parsed = parseDate(value);
  if (!parsed) return value || "-";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function formatLegacyDateRange(startDate: string, endDate: string): string {
  return `${formatLegacyDate(startDate)} - ${formatLegacyDate(endDate)}`;
}
