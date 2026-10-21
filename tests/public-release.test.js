import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPublicRelease } from '../scripts/public-release.mjs';
import { parsePublicRelease, loadReleasedPublicListings } from '../src/lib/publicRelease.js';
import { generatePublicPages } from '../scripts/public-pages.mjs';
import { checkPublicPages } from '../scripts/check-public-pages.mjs';
import { renderPublicPage } from '../src/prerender.jsx';

const listing = { property_id: 'property', unit_id: 'unit', property_name: 'New house', property_slug: 'new-house', unit_name: 'Main Unit', unit_slug: 'main-unit', listing_status: 'available', rent_display_type: 'contact', monthly_rent: 9999 };
let directory;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'public-release-'));
  await mkdir(join(directory, '.vite'));
  await writeFile(join(directory, '.vite/manifest.json'), '{}');
  await writeFile(join(directory, 'index.html'), '<!doctype html><html><head></head><body><div id="root"></div></body></html>');
  await generatePublicPages({ distDir: directory, listings: [listing], renderPage: renderPublicPage });
});
afterAll(async () => rm(directory, { recursive: true, force: true }));
const read = async path => ({ status: 200, body: await readFile(join(directory, path.endsWith('/') ? `${path}index.html` : path), 'utf8') });

it('versions all public facts and routes together without private fields or hidden rents', () => {
  const release = createPublicRelease([{ ...listing, private_note: 'private' }]);
  expect(release.paths).toEqual(['/', '/new-house/', '/new-house/main-unit/']);
  expect(JSON.stringify(release)).not.toContain('private'); expect(JSON.stringify(release)).not.toContain('9999');
  expect(createPublicRelease([{ ...listing, private_note: 'changed' }]).revision).toBe(release.revision);
  expect(createPublicRelease([{ ...listing, listing_description: 'Changed description' }]).revision).not.toBe(release.revision);
  expect(createPublicRelease([{ ...listing, listing_published: false }]).paths).toEqual(['/']);
});
it('does not expose a new database listing until its route is in the published artifact', async () => {
  const released = createPublicRelease([listing]);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => released });
  vi.stubGlobal('fetch', fetcher);
  try {
    expect(await loadReleasedPublicListings()).toEqual(released.listings);
    expect(fetcher.mock.calls[0][0]).toBe('/public-listings.json');
    expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
    expect(() => parsePublicRelease({ ...released, paths: ['/'] })).toThrow('routes');
  } finally { vi.unstubAllGlobals(); }
});
it('checks actual generated files, canonical metadata, revision and sitemap as one release', async () => {
  expect((await checkPublicPages({ read, siteUrl: 'https://treecityrentals.com/' })).urls).toBe(3);
});
it.each([
  ['HTTP 404', async p => p === '/new-house/main-unit/' ? { status: 404, body: '' } : read(p)],
  ['unindexed page', async p => { const r = await read(p); return p === '/new-house/' ? { ...r, body: r.body.replace('index, follow', 'noindex, follow') } : r; }],
  ['stale page', async p => { const r = await read(p); return p === '/new-house/' ? { ...r, body: r.body.replace(/name="public-content-revision" content="[a-f0-9]+"/, 'name="public-content-revision" content="old"') } : r; }],
  ['missing sitemap route', async p => { const r = await read(p); return p === '/sitemap.xml' ? { ...r, body: r.body.replace('<url><loc>https://treecityrentals.com/new-house/</loc></url>', '') } : r; }],
])('blocks a release with %s', async (_name, alteredRead) => {
  await expect(checkPublicPages({ read: alteredRead, siteUrl: 'https://treecityrentals.com/' })).rejects.toThrow();
});
