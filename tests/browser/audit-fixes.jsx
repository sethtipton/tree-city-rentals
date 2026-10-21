// Local browser fixture: callbacks simulate failures and never submit requests.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TenantRequestComposer } from "../../src/components/TenantMaintenanceApp";
import { ListingWorkspace } from "../../src/components/ListingWorkspace";
import { useSignedAttachmentUrls } from "../../src/hooks/useSignedAttachmentUrls";
import "../../src/index.css";
import "../../src/App.css";
const property = { id: "a0200000-0000-4000-8000-000000000001", name: "Fixture home" };
const unit = { id: "", property_id: property.id, name: "DOWN", listing_published: true, listing_status: "coming-soon", available_date: "2020-01-01", amenities: [], listing_headline: "Private listing preview" };
let signingAttempt = 0;
async function signer() { signingAttempt++; if (signingAttempt === 1) throw new Error("simulated network failure"); return "Attachment recovered"; }
export function Fixture() {
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState("");
  const urls = useSignedAttachmentUrls([{ storage_path: "fixture-photo" }], signer);
  async function submit({ submission }) {
    submission.id ||= crypto.randomUUID();
    setAttempts(value => value + 1);
    if (attempts === 0) { setMessage("Simulated upload failure. Please retry."); return false; }
    setMessage("Request received. Retry identity preserved."); return true;
  }
  return <main className="app-shell"><h1>Audit regression checks</h1><p>Local fixture. No requests or emails are sent.</p>
    <TenantRequestComposer title="Report fixture problem" propertyId={property.id} unitId={unit.id} onSubmit={submit} submitLabel="Submit request" />
    <p role="status">{message}</p><p>Submission attempts: {attempts}</p>
    <p role="status">{urls["fixture-photo"] || "Temporary attachment failure; retrying automatically…"}</p>
    <ListingWorkspace property={property} units={[unit]} selectedUnit={unit} view="listing" />
  </main>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
