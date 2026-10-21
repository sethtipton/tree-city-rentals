import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Home,
  MapPin,
  Maximize,
  Wrench,
} from "lucide-react";
import { getPublicPageMetadata, updatePublicMetadata } from "../lib/publicSeo";
import { groupListings } from "../lib/listings";
import { getPropertyImageBySlug } from "../lib/propertyImages";
import { getPublicListingPath, getPublicRouteFromCurrentPath } from "../lib/routing";
import { AppFooter } from "./AppFooter";
import { PropertyImage } from "./PropertyImage";
import { ListingGallery } from "./ListingGallery";
import { useListingPhotos } from "../hooks/useListingPhotos";
import { ListingInquiry } from "./ListingInquiry";
const TenantMaintenanceDialog = lazy(() => import("./TenantMaintenanceApp").then(module => ({ default: module.TenantMaintenanceDialog })));

export function PublicSite({ listings, busy, error, onSignIn, authenticated = false, user, tenantUnits = [], onSignOut, tenantPreview = false, previewRoute, onExitPreview }) {
  const previewRouteKey = previewRoute ? `${previewRoute.propertySlug}/${previewRoute.unitSlug}` : "";
  const [route, setRoute] = useState(() => previewRoute || getPublicRouteFromCurrentPath());
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const groupedListings = useMemo(() => groupListings(listings), [listings]);
  const canReportMaintenance = authenticated && tenantUnits.length > 0;

  useEffect(() => {
    if (previewRoute) {
      setRoute(previewRoute);
      return undefined;
    }
    function syncRoute() {
      setRoute(getPublicRouteFromCurrentPath());
    }
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [previewRoute, previewRouteKey]);

  const property = groupedListings.find((group) => group.property_slug === route.propertySlug);
  const listing = property?.listings.find((candidate) => candidate.unit_slug === route.unitSlug);
  const isListingRoute = Boolean(route.propertySlug && route.unitSlug);
  const isPropertyRoute = Boolean(route.propertySlug);

  useEffect(() => {
    if (busy || error || previewRoute) return;
    updatePublicMetadata(document, getPublicPageMetadata({ listings, propertySlug: route.propertySlug,
      unitSlug: route.unitSlug, siteUrl: import.meta.env.VITE_PUBLIC_SITE_URL || undefined,
      imageForSlug: getPropertyImageBySlug }));
  }, [listings, route.propertySlug, route.unitSlug, busy, error, previewRoute]);

  return (
    <>
      <main className="public-site" id="main-content" tabIndex="-1">
        <PublicHeader showDirectoryHeading={!isListingRoute && !isPropertyRoute} onReportMaintenance={canReportMaintenance ? () => setMaintenanceDialogOpen(true) : undefined} tenantPreviewLabel={tenantPreview ? `${tenantUnits[0]?.property_name} · ${tenantUnits[0]?.unit_name}` : ""} />
        {error ? (
          <section className="public-empty"><h1>Listings are unavailable</h1><p>{error}</p></section>
        ) : busy && (isListingRoute || isPropertyRoute) ? (
          <PublicRouteLoading listing={isListingRoute} />
        ) : isListingRoute ? (
          listing ? <ListingDetail listing={listing} /> : <PublicNotFound />
        ) : isPropertyRoute ? (
          property ? <PublicPropertyPage property={property} /> : <PublicNotFound />
        ) : (
          <PublicListingDirectory listings={listings} busy={busy} />
        )}
      </main>
      <AppFooter authenticated={authenticated} onAuthAction={tenantPreview ? onExitPreview : authenticated ? onSignOut : onSignIn} authActionLabel={tenantPreview ? "Return to maintenance workspace" : undefined} />
      {canReportMaintenance && maintenanceDialogOpen && <Suspense fallback={<p role="status">Loading maintenance form…</p>}><TenantMaintenanceDialog open={maintenanceDialogOpen} onClose={() => setMaintenanceDialogOpen(false)} user={user} tenantUnits={tenantUnits} preview={tenantPreview} /></Suspense>}
    </>
  );
}

function PublicHeader({ showDirectoryHeading = false, onReportMaintenance, tenantPreviewLabel }) {
  return (
    <header className={`public-header${showDirectoryHeading ? " has-header-subtitle" : ""}`}>
      <a className="public-brand" href={getPublicListingPath("")}>
        <span className="public-brand-mark" aria-hidden="true"><Building2 strokeWidth={1.6} /></span>
        <div className="public-brand-content">
          <h1 className="header-brand-title">Tree City Rentals</h1>
          {showDirectoryHeading && <h2>Homes near Kent State University</h2>}
        </div>
      </a>
      {onReportMaintenance && <button className="public-maintenance-button" type="button" onClick={onReportMaintenance}><Wrench size={17} aria-hidden="true" /> Maintenance Request</button>}
      {tenantPreviewLabel && <p className="public-tenant-preview" role="status">Admin tenant preview · {tenantPreviewLabel}</p>}
    </header>
  );
}

function PublicListingDirectory({ listings, busy }) {
  return (
    <section className="public-directory" aria-busy={busy}>
      <header className="public-directory-intro">
        <p>Browse available and coming-soon homes near Kent State, with clear details to help you find the right place to call home.</p>
      </header>
      {busy ? (
        <p className="public-loading">Loading available homes...</p>
      ) : listings.length === 0 ? (
        <section className="public-empty"><h2>No homes are available right now.</h2><p>Check back soon for upcoming listings.</p></section>
      ) : (
        <ul className="public-listing-grid" role="list">
          {listings.map((listing, index) => <ListingCard key={listing.unit_id} listing={listing} priority={index < 2} eager={index < 2} />)}
        </ul>
      )}
    </section>
  );
}

function PublicRouteLoading({ listing }) {
  return (
    <section className={`public-route-loading${listing ? " listing" : ""}`} aria-busy="true">
      <span className="visually-hidden" role="status">Loading {listing ? "listing" : "property"}</span>
      <div className="public-route-loading-media" aria-hidden="true" />
      <div className="public-route-loading-content" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

export function PublicPropertyPage({ property, preview = false }) {
  const location = [property.city, property.state].filter(Boolean).join(", ");
  return (
    <section className="public-property-page">
      {preview && <PreviewNotice listings={property.listings} />}
      <header className="public-property-heading">
        <p className="public-kicker">Tree City Rentals</p>
        <h1>{property.property_name}</h1>
        {(property.property_type || location) && <p>{[property.property_type, location].filter(Boolean).join(" / ")}</p>}
      </header>
      <ul className="public-property-listings" role="list">
        {property.listings.map((listing, index) => <ListingCard key={listing.unit_id} listing={listing} preview={preview} priority={index < 2} eager={index < 2} />)}
      </ul>
    </section>
  );
}

export function ListingDetail({ listing, preview = false, inquirySend }) {
  const title = listing.listing_headline || `${listing.property_name} ${listing.unit_name}`;
  const hasFacts = [
    listing.property_type,
    listing.bedrooms,
    listing.full_bathrooms,
    listing.half_bathrooms,
    listing.interior_square_feet,
    listing.available_date,
    listing.lease_term,
    listing.neighborhood,
  ].some((value) => value !== null && value !== undefined && value !== "");
  const photos = useListingPhotos(listing.unit_id, preview);
  const imageSrc = photos[0]?.url || getPropertyImageBySlug(listing.property_slug);
  const isLiveListing = isPublicListing(listing);

  return (
    <article className="public-listing-detail">
      {preview && <PreviewNotice listings={[listing]} />}
      <header className={`public-listing-hero${imageSrc ? " has-image" : ""}`}>
        {imageSrc && (
          <div className="public-listing-hero-media">
            {photos.length ? <ListingGallery key={listing.unit_id} photos={photos} /> : <PropertyImage src={imageSrc} alt={photos[0]?.label || (photos.length ? `Photo of ${listing.property_name}` : `Exterior of ${listing.property_name}`)} priority />}
            <span className={`listing-status listing-status-${listing.listing_status}`}>{getListingStatusLabel(listing.listing_status)}</span>
            {preview && isLiveListing && (
              <span className="listing-live-overlay">
                Live on Tree City Rentals as {getListingStatusLabel(listing.listing_status)}.
              </span>
            )}
          </div>
        )}
        <div className="public-listing-hero-content">
          <h1>{title}</h1>
          {listing.display_address && <p className="listing-address"><MapPin size={18} aria-hidden="true" /> {listing.display_address}</p>}
          <p className="listing-rent">{formatRent(listing)}</p>
          {!preview && <ListingInquiry key={listing.unit_id} listing={listing} send={inquirySend} />}
        </div>
      </header>

      {listing.listing_description && <p className="listing-description">{listing.listing_description}</p>}

      {(hasFacts || listing.amenities?.length > 0) && (
        <div className="listing-facts">
          {hasFacts && (
          <dl className="listing-specs">
            {listing.property_type && <Detail term="Type" value={listing.property_type} icon={<Building2 size={17} aria-hidden="true" />} />}
            {listing.bedrooms != null && <Detail term="Bedrooms" value={formatNumber(listing.bedrooms)} icon={<BedDouble size={17} aria-hidden="true" />} />}
            {listing.full_bathrooms != null && <Detail term="Full baths" value={formatNumber(listing.full_bathrooms)} icon={<Bath size={17} aria-hidden="true" />} />}
            {listing.half_bathrooms != null && <Detail term="Half baths" value={formatNumber(listing.half_bathrooms)} icon={<Bath size={17} aria-hidden="true" />} />}
            {listing.interior_square_feet != null && <Detail term="Interior" value={`${listing.interior_square_feet.toLocaleString()} sq ft`} icon={<Maximize size={17} aria-hidden="true" />} />}
            {listing.available_date && <Detail term="Available" value={formatDate(listing.available_date)} icon={<CalendarDays size={17} aria-hidden="true" />} />}
            {listing.lease_term && <Detail term="Lease" value={listing.lease_term} icon={<Home size={17} aria-hidden="true" />} />}
            {listing.neighborhood && <Detail term="Neighborhood" value={listing.neighborhood} icon={<MapPin size={17} aria-hidden="true" />} />}
          </dl>
          )}
          {listing.amenities?.length > 0 && <ul className="amenity-list" aria-label="Amenities" role="list">{listing.amenities.map((amenity) => <li key={amenity}>{amenity}</li>)}</ul>}
        </div>
      )}
    </article>
  );
}

function ListingCard({ listing, preview = false, priority = false, eager = priority }) {
  const title = listing.listing_headline || `${listing.property_name} ${listing.unit_name}`;
  const photos = useListingPhotos(listing.unit_id, preview);
  const imageSrc = photos[0]?.url || getPropertyImageBySlug(listing.property_slug);
  return (
    <li className="public-listing-card">
      <div className="public-listing-card-media">
        {imageSrc ? (
          <PropertyImage src={imageSrc} alt={photos[0]?.label || (photos.length ? `Photo of ${listing.property_name}` : `Exterior of ${listing.property_name}`)} priority={priority} eager={eager} sizes="(max-width: 52rem) 650px, 450px" />
        ) : (
          <Building2 size={28} aria-label={`Image unavailable for ${listing.property_name}`} />
        )}
        <span className={`listing-status listing-status-${listing.listing_status}`}>{getListingStatusLabel(listing.listing_status)}</span>
        {!preview && <div className="listing-card-contact"><ListingInquiry listing={listing} /></div>}
      </div>
      <a className="public-listing-card-content" href={getPublicListingPath(listing.property_slug, listing.unit_slug)}>
        <h2>{title}</h2>
        {listing.display_address && <p><MapPin size={16} aria-hidden="true" /> {listing.display_address}</p>}
        {(listing.neighborhood || listing.available_date) && (
          <div className="listing-card-details">
            {listing.neighborhood && <span><MapPin size={15} aria-hidden="true" /> {listing.neighborhood}</span>}
            {listing.available_date && <span><CalendarDays size={15} aria-hidden="true" /> Available {formatDate(listing.available_date)}</span>}
          </div>
        )}
        <div className="listing-card-specs">
          {listing.bedrooms != null && <span>{formatNumber(listing.bedrooms)} bd</span>}
          {listing.full_bathrooms != null && <span>{formatNumber(listing.full_bathrooms)} ba</span>}
          {listing.interior_square_feet != null && <span>{listing.interior_square_feet.toLocaleString()} sq ft</span>}
        </div>
        {listing.rent_display_type !== "contact" && <p className="listing-rent">{formatRent(listing)}</p>}
      </a>
      {preview && <p className="preview-card-note">Preview</p>}
    </li>
  );
}

function Detail({ term, value, icon }) {
  return <div><dt>{icon}{term}</dt><dd>{value}</dd></div>;
}

function PreviewNotice({ listings }) {
  const unpublished = listings.some((listing) => !isPublicListing(listing));
  return unpublished ? <p className="listing-preview-notice">Preview only. This listing is not currently visible on the public site.</p> : null;
}

function isPublicListing(listing) {
  return listing.listing_published && ["available", "coming-soon"].includes(listing.listing_status);
}

function PublicNotFound() {
  return <section className="public-empty"><h1>That listing is not available.</h1><p>Browse current Tree City Rentals homes below.</p><a className="secondary-link" href={getPublicListingPath("")}>View available homes</a></section>;
}

function formatRent(listing) {
  if (listing.rent_display_type === "contact") return "Contact for rent";
  if (listing.monthly_rent == null) return "Rent details coming soon";
  const rent = `$${listing.monthly_rent.toLocaleString()}`;
  return listing.rent_display_type === "starting-at" ? `Starting at ${rent} / month` : `${rent} / month`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatNumber(value) {
  return Number.isInteger(Number(value)) ? String(value) : Number(value).toFixed(1);
}

function getListingStatusLabel(status) {
  const labels = { available: "Available", "coming-soon": "Coming soon", occupied: "Occupied", "off-market": "Off market" };
  return labels[status] || "Listing";
}
