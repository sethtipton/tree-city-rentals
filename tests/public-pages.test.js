import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { fetchPublicListings, generatePublicPages } from "../scripts/public-pages.mjs";
import { renderPublicPage } from "../src/prerender.jsx";
vi.mock("../src/lib/supabase", () => ({ supabase: null }));
let directory;
const listing = { property_id: "carthage", unit_id: "carthage-unit", property_name: "469 Carthage Ave", property_slug: "469-carthage", unit_name: "Main Unit", unit_slug: "main-unit", listing_headline: "Home in Kent", listing_status: "available", monthly_rent: 1250, rent_display_type: "exact", bedrooms: 2, city: "Kent", state: "OH", amenities: [] };
const future = { ...listing, property_id: "future", unit_id: "future-up", property_name: "Future property", property_slug: "new-property-outside-manifest", unit_name: "UP", unit_slug: "up", rent_display_type: "contact", listing_description: '</script><script id="injected">alert(1)</script>', private_notes: "Never publish this", reporter_email: "private@example.test" };
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "public-seo-"));
  await mkdir(join(directory, ".vite"));
  await writeFile(join(directory, "index.html"), '<!doctype html><html lang="en"><head><title>Generic</title><meta name="description" content="Generic"></head><body><div id="root"></div></body></html>');
  await writeFile(join(directory, ".vite/manifest.json"), JSON.stringify({ "property-images/processed/469-carthage-ave.webp": { file: "assets/existing-exterior.webp" } }));
  await generatePublicPages({ distDir: directory, listings: [listing, future, { ...listing, property_id: "private", property_slug: "private-property", listing_published: false }], siteUrl: "https://rentals.example.test/", renderPage: renderPublicPage });
});
afterAll(async () => rm(directory, { recursive: true, force: true }));
async function html(path) { return new JSDOM(await readFile(join(directory, path, "index.html"), "utf8")); }
it("writes listing-specific tags and readable listing HTML before JavaScript", async () => {
  const dom = await html("469-carthage/main-unit"); const doc = dom.window.document;
  expect(doc.title).toContain("469 Carthage Ave"); expect(doc.querySelector('meta[name=description]').content).toContain("$1,250");
  expect(doc.querySelector('link[rel=canonical]').href).toBe("https://rentals.example.test/469-carthage/main-unit/");
  expect(doc.querySelector('meta[property="og:image"]').content).toBe("https://rentals.example.test/assets/existing-exterior.webp");
  expect(doc.querySelector("#root .public-listing-detail").textContent).toContain("$1,250 / month");
  expect(doc.querySelector("#root").hasAttribute("data-prerendered-public")).toBe(true); dom.window.close();
});
it("generates future properties without adding them to the hard-coded manifest", async () => {
  const dom = await html("new-property-outside-manifest/up");
  expect(dom.window.document.title).toContain("Future property · UP");
  expect(dom.window.document.querySelector('meta[property="og:image"]')).toBeNull();
  const sitemap = await readFile(join(directory, "sitemap.xml"), "utf8");
  expect(sitemap).toContain("https://rentals.example.test/new-property-outside-manifest/up/");
  expect(sitemap).toContain("https://rentals.example.test/new-property-outside-manifest/"); dom.window.close();
});
it("keeps private fields and script injection out of the bootstrap data", async () => {
  const source = await readFile(join(directory, "new-property-outside-manifest/up/index.html"), "utf8"); const dom = new JSDOM(source);
  expect(dom.window.document.getElementById("injected")).toBeNull();
  const snapshot = JSON.parse(dom.window.document.getElementById("public-listings-data").textContent);
  expect(snapshot[1].listing_description).toBe(future.listing_description);
  expect(source).not.toContain("Never publish this"); expect(source).not.toContain("private@example.test");
  expect(snapshot[1].monthly_rent).toBeNull(); dom.window.close();
});
it("canonicalizes saved mixed-case links and keeps unavailable routes out of search", async () => {
  const alias = await html("469-Carthage/Main-Unit");
  expect(alias.window.document.querySelector('link[rel=canonical]').href).toBe("https://rentals.example.test/469-carthage/main-unit/");
  const inactive = await html("451-park/up"); expect(inactive.window.document.querySelector('meta[name=robots]').content).toContain("noindex");
  const sitemap = await readFile(join(directory, "sitemap.xml"), "utf8"); expect(sitemap).not.toContain("private-property"); expect(sitemap).not.toContain("451-park");
  alias.window.close(); inactive.window.close();
});
it("does not bootstrap public listings into private maintenance or 404 fallback pages", async () => {
  const maintenance = await html("maintenance"); expect(maintenance.window.document.querySelector('meta[name=robots]').content).toContain("noindex");
  expect(maintenance.window.document.getElementById("public-listings-data")).toBeNull();
  const fallback = new JSDOM(await readFile(join(directory, "404.html"), "utf8")); expect(fallback.window.document.querySelector('meta[name=robots]').content).toContain("noindex");
  maintenance.window.close(); fallback.window.close();
});
it("uses a public API key only and fails the build on unavailable listing data", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [listing] });
  expect(await fetchPublicListings({ url: "https://backend.example.test", key: "public-key", fetcher })).toHaveLength(1);
  expect(fetcher.mock.calls[0][1].headers).toEqual({ apikey: "public-key", "Content-Type": "application/json" });
  await expect(fetchPublicListings({ url: "https://backend.example.test", key: "public-key", fetcher: async () => ({ ok: false, status: 503 }) })).rejects.toThrow("HTTP 503");
  await expect(fetchPublicListings({})).rejects.toThrow("requires");
});
