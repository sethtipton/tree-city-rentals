export const PUBLIC_SITE_URL = "https://treecityrentals.com/";
export const SITE_TITLE = "Tree City Rentals | Kent, Ohio Rentals";
export const SITE_DESCRIPTION = "Explore available apartments and homes in Kent, Ohio from Tree City Rentals, including rentals near Kent State University.";
const publicFields = ["property_id", "unit_id", "property_name", "property_slug", "unit_name", "unit_slug", "property_type", "listing_headline", "listing_status", "display_address", "city", "state", "neighborhood", "monthly_rent", "rent_display_type", "available_date", "lease_term", "bedrooms", "full_bathrooms", "half_bathrooms", "interior_square_feet", "listing_description", "amenities"];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const cleanText = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function publicListingSnapshot(rows) {
  if (!Array.isArray(rows)) throw new Error("Public listings must be an array.");
  return rows.filter(row => row && row.listing_published !== false && ["available", "coming-soon"].includes(row.listing_status)).map(row => {
    if (!slugPattern.test(row.property_slug) || !slugPattern.test(row.unit_slug) || !row.unit_id || !row.property_id) throw new Error("A public listing has an invalid route or identity.");
    const listing = Object.fromEntries(publicFields.filter(field => row[field] !== undefined).map(field => [field, row[field]]));
    // Contact pricing is a display choice; never put the hidden amount in HTML.
    if (listing.rent_display_type === "contact") listing.monthly_rent = null;
    return listing;
  });
}

export function publicPath(propertySlug = "", unitSlug = "") {
  const parts = [propertySlug, unitSlug].filter(Boolean).map(encodeURIComponent);
  return parts.length ? `/${parts.join("/")}/` : "/";
}

export function canonicalSiteUrl(value = PUBLIC_SITE_URL) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("The public site URL must be an HTTPS origin with no credentials, query or subpath.");
  return url.href;
}

function shorten(value, limit = 160) {
  const text = cleanText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}…`;
}
function unitLabel(listing) {
  return [cleanText(listing.property_name), listing.unit_name?.toLowerCase() !== "main unit" ? cleanText(listing.unit_name) : ""].filter(Boolean).join(" · ");
}
function facts(listing) {
  const rooms = listing.bedrooms === 0 ? "Studio" : listing.bedrooms != null ? `${listing.bedrooms}-bedroom` : "";
  const location = [listing.city, listing.state].map(cleanText).filter(Boolean).join(", ");
  const details = [rooms, cleanText(listing.property_type) || "home", "for rent", location ? `in ${location}` : ""].filter(Boolean).join(" ");
  const rent = listing.rent_display_type !== "contact" && listing.monthly_rent != null
    ? `${listing.rent_display_type === "starting-at" ? "From " : ""}$${Number(listing.monthly_rent).toLocaleString("en-US")} per month.` : "Ask about rent and availability.";
  return `${details}. ${rent}`;
}

export function getPublicPageMetadata({ listings, propertySlug = "", unitSlug = "", siteUrl = PUBLIC_SITE_URL, imageForSlug = () => "", notFound = false }) {
  const origin = canonicalSiteUrl(siteUrl);
  const propertyListings = listings.filter(listing => listing.property_slug === propertySlug);
  const listing = unitSlug ? propertyListings.find(row => row.unit_slug === unitSlug) : null;
  const missing = notFound || Boolean(propertySlug && (unitSlug ? !listing : propertyListings.length === 0));
  let title = SITE_TITLE, description = SITE_DESCRIPTION;
  if (missing) { title = "Listing unavailable | Tree City Rentals"; description = "This listing is unavailable. Browse current Tree City Rentals homes in Kent, Ohio."; }
  else if (listing) {
    const name = unitLabel(listing);
    const headline = cleanText(listing.listing_headline);
    title = `${headline && headline.toLowerCase() !== name.toLowerCase() ? `${headline} · ` : ""}${name} | Tree City Rentals`;
    description = shorten(`${name}: ${facts(listing)} ${cleanText(listing.listing_description)}`);
  } else if (propertyListings.length) {
    const property = propertyListings[0];
    title = `${cleanText(property.property_name)} Rentals | Tree City Rentals`;
    description = shorten(`Explore ${propertyListings.length === 1 ? "the rental home" : `${propertyListings.length} rental homes`} at ${cleanText(property.property_name)}${property.city ? ` in ${cleanText(property.city)}${property.state ? `, ${cleanText(property.state)}` : ""}` : ""}. View current availability, photos, rental details, and contact us about a home.`);
  }
  const imageListing = missing ? null : listing || propertyListings[0] || listings[0];
  const imagePath = imageListing ? imageForSlug(imageListing.property_slug) : "";
  const image = imagePath ? new URL(imagePath, origin) : null;
  if (image && (image.protocol !== "https:" || image.username || image.password)) throw new Error("Sharing images must use an HTTPS URL.");
  return { title, description, canonical: new URL(publicPath(propertySlug, unitSlug), origin).href,
    robots: missing ? "noindex, follow" : "index, follow", image: image?.href || "",
    imageAlt: imageListing && image ? `Exterior of ${cleanText(imageListing.property_name)}` : "" };
}

export function updatePublicMetadata(doc, metadata) {
  doc.title = metadata.title;
  function meta(attribute, name, value) {
    let element = doc.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!value) { element?.remove(); return; }
    if (!element) { element = doc.createElement("meta"); element.setAttribute(attribute, name); doc.head.append(element); }
    element.setAttribute("content", value);
  }
  let canonical = doc.head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = doc.createElement("link"); canonical.rel = "canonical"; doc.head.append(canonical); }
  canonical.href = metadata.canonical;
  meta("name", "description", metadata.description); meta("name", "robots", metadata.robots);
  for (const [key, value] of Object.entries({ title: metadata.title, description: metadata.description, url: metadata.canonical, type: "website", site_name: "Tree City Rentals", locale: "en_US", image: metadata.image, "image:alt": metadata.imageAlt })) meta("property", `og:${key}`, value);
  for (const [key, value] of Object.entries({ card: metadata.image ? "summary_large_image" : "summary", title: metadata.title, description: metadata.description, image: metadata.image, "image:alt": metadata.imageAlt })) meta("name", `twitter:${key}`, value);
}

export function readPublicListingSnapshot(doc) {
  const element = doc.getElementById("public-listings-data");
  if (!element) return null;
  try { return publicListingSnapshot(JSON.parse(element.textContent)); } catch { return null; }
}
