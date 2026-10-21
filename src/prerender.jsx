import { renderToString } from "react-dom/server";
import { PublicSite } from "./components/PublicListings";

export function renderPublicPage(listings, route) {
  return renderToString(<PublicSite listings={listings} previewRoute={route} />);
}
