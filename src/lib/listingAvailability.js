export function getListingAvailabilityWarning(unit, now = new Date()) {
  if (!unit.listing_published || unit.listing_status !== "coming-soon" || !unit.available_date) return "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (unit.available_date > today) return "";
  return `${unit.name}: the coming-soon date (${unit.available_date}) has arrived. Review the date and availability status.`;
}
