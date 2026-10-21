import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { PROPERTY_IMAGE_SOURCES } from "../src/lib/propertyImageSources.js";
import { INITIAL_PROPERTIES, UNIT_ROUTE_ALIASES } from "../src/lib/seed.js";
import { canonicalSiteUrl, getPublicPageMetadata, publicListingSnapshot, publicPath, updatePublicMetadata } from "../src/lib/publicSeo.js";
import { createPublicRelease } from "./public-release.mjs";

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
const safeJson = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
const slug = value => value.trim().replace(/&/g, "and").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");

export async function fetchPublicListings({ url, key, fetcher = fetch }) {
  if (!url || !key) throw new Error("Public listing generation requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Use --offline only for a local fallback build.");
  const endpoint = new URL("/rest/v1/rpc/get_public_listings", url);
  if (endpoint.protocol !== "https:") throw new Error("The public listing API must use HTTPS.");
  const response = await fetcher(endpoint, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Could not load public listings for the build (HTTP ${response.status}). Existing production pages have not been replaced.`);
  return publicListingSnapshot(await response.json());
}

export async function generatePublicPages({ distDir, listings: rows, siteUrl, renderPage, offline = false }) {
  const listings = publicListingSnapshot(rows);
  const release = { ...createPublicRelease(listings), sourceRevision: process.env.GITHUB_SHA || null };
  const origin = canonicalSiteUrl(siteUrl);
  const template = await readFile(join(distDir, "index.html"), "utf8");
  let manifest = {};
  try { manifest = JSON.parse(await readFile(join(distDir, ".vite/manifest.json"), "utf8")); }
  catch (error) { if (!offline) throw error; }
  const imageForSlug = propertySlug => {
    const name = PROPERTY_IMAGE_SOURCES[propertySlug];
    const asset = name && manifest[`property-images/processed/${name}`];
    if (name && !asset && !offline) throw new Error(`The built exterior image is missing for ${propertySlug}.`);
    return asset ? `/${asset.file}` : "";
  };
  const canonicalPaths = new Set(["/"]);
  const pageCache = new Map();
  const publishedSlugs = new Set(listings.map(listing => listing.property_slug));
  const findRoute = path => {
    const parts = path.split("/").filter(Boolean).map(part => part.toLowerCase());
    return { propertySlug: parts[0] || "", unitSlug: parts[1] || "" };
  };

  async function page(path, { route = findRoute(path), unavailable = false, privatePage = false } = {}) {
    const cacheKey = JSON.stringify({ route, unavailable, privatePage });
    let html = pageCache.get(cacheKey);
    if (!html) {
      const metadata = getPublicPageMetadata({ listings, ...route, siteUrl: origin, imageForSlug, notFound: unavailable });
      if (offline || privatePage) metadata.robots = "noindex, follow";
      const dom = new JSDOM(template);
      const doc = dom.window.document;
      updatePublicMetadata(doc, metadata);
      const revision = doc.createElement('meta'); revision.name = 'public-content-revision'; revision.content = release.revision; doc.head.append(revision);
      if (release.sourceRevision) { const build = doc.createElement('meta'); build.name = 'public-build-revision'; build.content = release.sourceRevision; doc.head.append(build); }
      const root = doc.getElementById("root");
      if (root && !privatePage && renderPage) {
        root.innerHTML = renderPage(listings, route);
        root.setAttribute("data-prerendered-public", "true");
        const snapshot = doc.createElement("script"); snapshot.id = "public-listings-data"; snapshot.type = "application/json";
        snapshot.textContent = safeJson(listings); doc.body.append(snapshot);
      }
      html = `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
      dom.window.close();
      pageCache.set(cacheKey, html);
    }
    const destination = path === "404.html" ? join(distDir, path) : join(distDir, path, "index.html");
    if (path !== "404.html") await mkdir(join(distDir, path), { recursive: true });
    await writeFile(destination, html);
  }

  // Preserve existing internal/saved routes. Only currently public routes index.
  await page("404.html", { route: {}, unavailable: true, privatePage: true });
  await page("maintenance", { route: {}, unavailable: true, privatePage: true });
  for (const property of INITIAL_PROPERTIES) {
    const propertySlug = slug(property.name);
    for (const variant of new Set([propertySlug, propertySlug.toLowerCase()])) await page(variant);
    for (const unit of property.units) {
      for (const name of [unit, ...(UNIT_ROUTE_ALIASES[unit] || [])]) {
        for (const variant of new Set([`${propertySlug}/${slug(name)}`, `${propertySlug}/${slug(name)}`.toLowerCase(), slug(`${property.name} ${name}`), slug(`${property.name} ${name}`).toLowerCase()])) await page(variant);
      }
    }
  }
  // Database-driven routes also cover newly added properties and units.
  for (const listing of listings) {
    const path = publicPath(listing.property_slug, listing.unit_slug);
    await page(path.slice(1, -1)); canonicalPaths.add(path);
  }
  for (const propertySlug of publishedSlugs) {
    const path = publicPath(propertySlug);
    await page(path.slice(1, -1)); canonicalPaths.add(path);
  }
  await page("");
  await writeFile(join(distDir, ".nojekyll"), "");
  await writeFile(join(distDir, 'public-listings.json'), `${JSON.stringify(release)}\n`);
  const urls = [...canonicalPaths].sort().map(path => `<url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`).join("");
  await writeFile(join(distDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
  await writeFile(join(distDir, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /maintenance/\nSitemap: ${new URL("sitemap.xml", origin).href}\n`);
  return { listings: listings.length, properties: publishedSlugs.size, sitemapUrls: canonicalPaths.size };
}
