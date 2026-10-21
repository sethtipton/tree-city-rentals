// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { getPublicPageMetadata, publicListingSnapshot, updatePublicMetadata, readPublicListingSnapshot } from "../src/lib/publicSeo";
import { PROPERTY_IMAGE_SOURCES } from "../src/lib/propertyImageSources";
import { getPropertyImageBySlug } from "../src/lib/propertyImages";
const listing = { property_id: "property", unit_id: "unit", property_name: "Future property", property_slug: "future-property", unit_name: "DOWN", unit_slug: "down", listing_status: "available", listing_headline: "A home in Kent", city: "Kent", state: "OH", bedrooms: 2, monthly_rent: 1500, rent_display_type: "exact", listing_description: "A useful existing description." };
const metadata = (patch = {}, options = {}) => getPublicPageMetadata({ listings: [{ ...listing, ...patch }], propertySlug: listing.property_slug, unitSlug: listing.unit_slug, ...options });
afterEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; });
describe("listing metadata", () => {
  it("derives unique factual defaults for future properties without extra fields", () => {
    const result = metadata();
    expect(result.title).toContain("Future property · DOWN"); expect(result.description).toContain("2-bedroom home for rent in Kent, OH");
    expect(result.description).not.toContain("1,500"); expect(result.description.length).toBeLessThanOrEqual(160);
    expect(result.canonical).toBe("https://treecityrentals.com/future-property/down/");
  });
  it("keeps sibling units distinct even with the same headline", () => {
    expect(metadata().title).not.toBe(metadata({ unit_name: "UP", unit_slug: "up" }, { unitSlug: "up" }).title);
  });
  it("keeps internal rent and retired display settings out of metadata", () => {
    const result = metadata({ rent_display_type: "contact", monthly_rent: 1500 });
    expect(result.description).not.toContain("1,500"); expect(result.description).not.toContain("Contact for rent");
  });
  it("handles missing optional fields and studio listings without inventing features", () => {
    const result = metadata({ bedrooms: 0, monthly_rent: null, listing_headline: "", listing_description: "", city: "", state: "" });
    expect(result.description).toContain("Studio home for rent"); expect(result.description).not.toContain("undefined");
    expect(result.description).not.toContain("parking");
  });
  it("creates property and directory metadata plus a non-indexable missing page", () => {
    expect(metadata({}, { unitSlug: "" }).title).toBe("Future property Rentals | Tree City Rentals");
    expect(metadata({}, { propertySlug: "", unitSlug: "" }).canonical).toBe("https://treecityrentals.com/");
    expect(metadata({}, { unitSlug: "missing" }).robots).toBe("noindex, follow");
  });
  it("uses permanent HTTPS image URLs instead of expiring private links", () => {
    const result = metadata({}, { imageForSlug: () => "/assets/existing.webp" });
    expect(result.image).toBe("https://treecityrentals.com/assets/existing.webp"); expect(result.imageAlt).toBe("Exterior of Future property");
    expect(() => metadata({}, { imageForSlug: () => "javascript:alert(1)" })).toThrow("HTTPS");
  });
  it("uses the existing image catalogue consistently for every current property", () => {
    for (const [slug, name] of Object.entries(PROPERTY_IMAGE_SOURCES)) expect(getPropertyImageBySlug(slug)).toContain(name);
  });
  it("updates every tag once, removes obsolete images, and escapes text as text", () => {
    updatePublicMetadata(document, metadata({}, { imageForSlug: () => "/existing.webp" }));
    updatePublicMetadata(document, metadata({ property_name: '<script>alert("x")</script> House' }));
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
    expect(document.head.querySelector("script")).toBeNull();
  });
  it.each(["http://example.test/", "https://user:secret@example.test/", "https://example.test/?token=private"])("rejects unsafe canonical origins %s", (siteUrl) => {
    expect(() => metadata({}, { siteUrl })).toThrow();
  });
});
describe("public snapshot boundary", () => {
  it("excludes private fields, unpublished records, and hidden prices", () => {
    const rows = publicListingSnapshot([{ ...listing, private_note: "private", reporter_email: "private@example.test", rent_display_type: "contact" }, { ...listing, listing_published: false }, { ...listing, listing_status: "off-market" }]);
    expect(rows).toHaveLength(1); expect(rows[0].private_note).toBeUndefined(); expect(rows[0].reporter_email).toBeUndefined(); expect(rows[0].monthly_rent).toBeUndefined(); expect(rows[0].rent_display_type).toBeUndefined();
  });
  it("rejects traversal routes and malformed public API responses", () => {
    expect(() => publicListingSnapshot([{ ...listing, property_slug: "../private" }])).toThrow();
    expect(() => publicListingSnapshot({ error: "unavailable" })).toThrow();
  });
  it("ignores a malformed bootstrap snapshot", () => {
    const element = document.createElement("script"); element.id = "public-listings-data"; element.type = "application/json"; element.textContent = "not JSON"; document.body.append(element);
    expect(readPublicListingSnapshot(document)).toBeNull();
  });
});
