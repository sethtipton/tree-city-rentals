import { useEffect, useState } from "react";
import { getListingAvailabilityWarning } from "../lib/listingAvailability";

export function ListingAvailabilityWarnings({ units, properties = [] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return units.map(unit => {
    const warning = getListingAvailabilityWarning(unit, now);
    if (!warning) return null;
    const property = properties.find(candidate => candidate.id === unit.property_id);
    return <p key={unit.id} className="listing-availability-warning" role="status">{property ? `${property.name} · ` : ""}{warning}</p>;
  });
}
