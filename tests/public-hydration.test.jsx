// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { renderPublicPage } from "../src/prerender";
import App from "../src/App";
const state = vi.hoisted(() => ({ listings: [] }));
vi.mock("../src/lib/supabase", () => ({ isSupabaseConfigured: true, supabase: { rpc: async () => ({ data: true }) } }));
vi.mock("../src/lib/data", () => ({ getSession: async () => null, loadPublicListings: async () => state.listings, watchAuth: () => () => {}, signInWithGoogle: vi.fn() }));
vi.mock("../src/hooks/useListingPhotos", () => ({ useListingPhotos: () => [] }));
let root, container;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); window.history.replaceState({}, "", "/"); });
it("hydrates the generated public HTML, refreshes listing data, and keeps inquiries interactive", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const listing = { property_id: "property", unit_id: "unit", property_name: "Future property", property_slug: "future-property", unit_name: "Main Unit", unit_slug: "main-unit", listing_status: "available", rent_display_type: "exact", monthly_rent: 1250, amenities: [] };
  state.listings = [{ ...listing, monthly_rent: 1400, listing_headline: "Updated home details" }];
  window.history.replaceState({}, "", "/future-property/main-unit/?source=share");
  container = document.createElement("div"); container.innerHTML = renderPublicPage([listing], { propertySlug: listing.property_slug, unitSlug: listing.unit_slug }); document.body.append(container);
  const recoverableError = vi.fn();
  await act(async () => { root = hydrateRoot(container, <StrictMode><App initialListings={[listing]} /></StrictMode>, { onRecoverableError: recoverableError }); });
  expect(recoverableError).not.toHaveBeenCalled(); expect(container.querySelector(".listing-rent")).toBeNull(); expect(container.textContent).toContain("Updated home details");
  expect(container.querySelector(".listing-inquiry-button").textContent).toBe("Ask about this home");
  expect(document.querySelector('link[rel=canonical]').href).toBe("https://treecityrentals.com/future-property/main-unit/");
  expect(document.querySelector('meta[name=description]').content).not.toContain("1,400");
});
