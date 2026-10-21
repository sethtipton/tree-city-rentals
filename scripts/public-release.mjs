import { createHash } from 'node:crypto';
import { publicListingSnapshot, publicPath } from '../src/lib/publicSeo.js';

// One revision covers the directory, metadata, route files and sitemap.
export function createPublicRelease(rows) {
  const listings = publicListingSnapshot(rows);
  const paths = [...new Set(['/', ...listings.flatMap(row => [publicPath(row.property_slug), publicPath(row.property_slug, row.unit_slug)])])].sort();
  const content = { version: 1, listings, paths };
  const revision = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return { ...content, revision };
}
