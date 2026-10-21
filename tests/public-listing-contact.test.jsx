// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ListingDetail, PublicSite } from "../src/components/PublicListings";
import { supabase } from "../src/lib/supabase";
vi.mock("../src/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../src/hooks/useListingPhotos", () => ({ useListingPhotos: () => [] }));
const listing = { unit_id: "unit", property_id: "property", property_name: "Test property", property_slug: "test-property", unit_slug: "main-unit", unit_name: "Main Unit", listing_status: "available", amenities: [], monthly_rent: 1400 };
let root, container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  supabase.rpc.mockResolvedValue({ data: true, error: null });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });
it.each([["exact", "$1,400 / month"], ["starting-at", "Starting at $1,400 / month"], ["contact", "Contact for rent"]])("keeps the %s price and a separate inquiry action", async (rent_display_type, price) => {
  const send = vi.fn().mockResolvedValue();
  await act(async () => root.render(<ListingDetail listing={{ ...listing, rent_display_type }} inquirySend={send} />));
  expect(container.querySelector(".listing-rent").textContent).toBe(price);
  const button = container.querySelector(".listing-inquiry-button"); expect(button.textContent).toBe("Ask about this home");
  await act(async () => button.click()); expect(container.querySelector("dialog").open).toBe(true);
  container.querySelector('[name="name"]').value = "Test visitor";
  container.querySelector('[name="email"]').value = "visitor@example.test";
  container.querySelector('[name="message"]').value = "Can I arrange a viewing?";
  await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(send).toHaveBeenCalledOnce(); expect(container.textContent).toContain("Inquiry received");
});
it("shows an action when the exact rent has not been entered yet", async () => {
  await act(async () => root.render(<ListingDetail listing={{ ...listing, rent_display_type: "exact", monthly_rent: null }} />));
  expect(container.textContent).toContain("Rent details coming soon"); expect(container.querySelector(".listing-inquiry-button")).not.toBeNull();
});
it("places directory inquiry buttons outside the listing navigation links", async () => {
  await act(async () => root.render(<PublicSite listings={[{ ...listing, rent_display_type: "exact" }]} />));
  const button = container.querySelector(".listing-inquiry-button");
  expect(button).not.toBeNull(); expect(button.closest("a")).toBeNull();
  expect(container.querySelector(".public-listing-card > a").getAttribute("href")).toBe("/test-property/main-unit/");
});
it("retains the unavailable-recipient guard for priced listings", async () => {
  supabase.rpc.mockResolvedValue({ data: false });
  await act(async () => root.render(<ListingDetail listing={{ ...listing, rent_display_type: "exact" }} />));
  expect(container.querySelector(".listing-rent").textContent).toContain("$1,400");
  expect(container.querySelector(".listing-inquiry-button")).toBeNull();
});
it("does not offer real inquiries inside private listing previews", async () => {
  await act(async () => root.render(<ListingDetail listing={listing} preview />));
  expect(container.querySelector(".listing-inquiry-button")).toBeNull(); expect(supabase.rpc).not.toHaveBeenCalled();
});
