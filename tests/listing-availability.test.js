import { expect, it } from "vitest";
import { getListingAvailabilityWarning } from "../src/lib/listingAvailability";
const unit = { name: "DOWN", listing_published: true, listing_status: "coming-soon", available_date: "2026-10-20" };
it("flags arrived coming-soon dates without changing listing data", () => {
  const original = { ...unit };
  expect(getListingAvailabilityWarning(unit, new Date("2026-10-20T12:00:00Z"))).toContain("Review the date");
  expect(unit).toEqual(original);
});
it("uses the property's Eastern date at the UTC boundary", () => {
  expect(getListingAvailabilityWarning(unit, new Date("2026-10-20T01:00:00Z"))).toBe("");
});
it.each([{ listing_published: false }, { listing_status: "available" }, { available_date: "2026-12-01" }, { available_date: null }])("does not flag %j", (patch) => {
  expect(getListingAvailabilityWarning({ ...unit, ...patch }, new Date("2026-10-20T12:00:00Z"))).toBe("");
});
