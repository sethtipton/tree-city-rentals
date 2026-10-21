// Local fixture: sample prices and a simulated sender. Never sends email.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ListingDetail } from "../../src/components/PublicListings";
import { loadPublicListings } from "../../src/lib/data";
import "../../src/index.css";
import "../../src/App.css";
const attempts = new Map();
async function simulateSend(payload) {
  const count = (attempts.get(payload.id) || 0) + 1;
  attempts.set(payload.id, count);
  if (count === 1) throw new Error("Simulated connection failure. No email was sent.");
}
export function MarketingFixture() {
  const [listing, setListing] = useState(null);
  useEffect(() => { loadPublicListings().then(rows => setListing(rows[0] || null)); }, []);
  return <main className="public-site"><h1>Local listing marketing checks</h1><p>Sample prices. No emails are sent.</p>
    {listing ? [1400, null].map(amount => <section key={String(amount)} aria-label={`Internal rent ${amount}`}><h2>Internal rent stays private</h2><ListingDetail listing={{ ...listing, monthly_rent: amount }} inquirySend={simulateSend} /></section>) : <p role="status">Loading a public listing fixture…</p>}
  </main>;
}
createRoot(document.getElementById("root")).render(<MarketingFixture />);
