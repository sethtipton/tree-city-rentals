import { publicListingSnapshot, publicPath } from './publicSeo.js';

export function parsePublicRelease(value) {
  if (value?.version !== 1 || !/^[a-f0-9]{64}$/.test(value.revision) || !Array.isArray(value.paths)) {
    throw new Error('The public listing release is invalid.');
  }
  const listings = publicListingSnapshot(value.listings);
  const paths = [...new Set(['/', ...listings.flatMap(row => [publicPath(row.property_slug), publicPath(row.property_slug, row.unit_slug)])])].sort();
  if (JSON.stringify(paths) !== JSON.stringify(value.paths)) throw new Error('Public listing routes do not match the released directory.');
  return { revision: value.revision, paths, listings };
}

export async function loadReleasedPublicListings() {
  const response = await fetch(`${import.meta.env.BASE_URL}public-listings.json`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Available homes could not be loaded.');
  return parsePublicRelease(await response.json()).listings;
}
