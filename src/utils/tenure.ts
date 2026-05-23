// Floored years between two ISO dates; if less than a year, floored months.
// Callers wrap with "more than" — e.g. "more than 11 years" or "more than 9 months".
export function tenureText(startIso: string, endIso: string): { value: number; unit: "year" | "month" } {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const ms = end.getTime() - start.getTime();
  const years = Math.floor(ms / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return { value: years, unit: "year" };
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return { value: Math.max(0, months), unit: "month" };
}

export function formatTenure(startIso: string, endIso: string): string {
  const { value, unit } = tenureText(startIso, endIso);
  const plural = value === 1 ? unit : unit + "s";
  return `more than ${value} ${plural}`;
}
