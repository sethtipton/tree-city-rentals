import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { canonicalSiteUrl, getPublicPageMetadata } from '../src/lib/publicSeo.js';
import { parsePublicRelease } from '../src/lib/publicRelease.js';
import { createPublicRelease } from './public-release.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

export async function checkPublicPages({ read, siteUrl, expectedRevision, expectedCommit }) {
  const origin = canonicalSiteUrl(siteUrl);
  const manifest = await read('/public-listings.json');
  assert(manifest.status === 200, 'Public release manifest must return 200.');
  const raw = JSON.parse(manifest.body);
  const release = parsePublicRelease(raw);
  if (expectedCommit) assert(raw.sourceRevision === expectedCommit, 'The expected application build is not live yet.');
  assert(createPublicRelease(release.listings).revision === release.revision, 'Public release content hash does not match.');
  if (expectedRevision) assert(release.revision === expectedRevision, 'The expected public release is not live yet.');
  const sitemap = await read('/sitemap.xml');
  assert(sitemap.status === 200, 'Sitemap must return 200.');
  const xml = new JSDOM(sitemap.body, { contentType: 'application/xml' });
  const locations = [...xml.window.document.querySelectorAll('loc')].map(e => e.textContent).sort();
  xml.window.close();
  assert(JSON.stringify(locations) === JSON.stringify(release.paths.map(p => new URL(p, origin).href).sort()), 'Sitemap must contain exactly the released canonical URLs.');
  const robots = await read('/robots.txt');
  assert(robots.status === 200 && robots.body.includes(`Sitemap: ${new URL('sitemap.xml', origin).href}`), 'Robots policy must reference the released sitemap.');
  for (const path of release.paths) {
    const response = await read(path);
    assert(response.status === 200, `${path} must return HTTP 200.`);
    const dom = new JSDOM(response.body, { url: origin });
    const doc = dom.window.document;
    try {
      const [propertySlug = '', unitSlug = ''] = path.split('/').filter(Boolean);
      const metadata = getPublicPageMetadata({ listings: release.listings, propertySlug, unitSlug, siteUrl: origin });
      assert(doc.querySelector('link[rel=canonical]')?.href === new URL(path, origin).href, `${path} has an incorrect canonical.`);
      assert(doc.querySelector('meta[name=robots]')?.content === 'index, follow', `${path} is not indexable.`);
      assert(doc.title === metadata.title && doc.querySelector('meta[name=description]')?.content === metadata.description, `${path} metadata differs from the release.`);
      assert(doc.querySelector('meta[name=public-content-revision]')?.content === release.revision, `${path} has a stale revision.`);
      if (expectedCommit) assert(doc.querySelector('meta[name=public-build-revision]')?.content === expectedCommit, `${path} serves a different application build.`);
      assert(doc.querySelector('#root[data-prerendered-public] main')?.textContent.trim() && doc.querySelector('h1'), `${path} is missing prerendered content.`);
      assert(JSON.stringify(JSON.parse(doc.getElementById('public-listings-data')?.textContent || 'null')) === JSON.stringify(release.listings), `${path} bootstraps a different listing snapshot.`);
      for (const a of doc.querySelectorAll('a[href^="/"]')) assert(release.paths.includes(a.getAttribute('href')), `${path} links outside the published route set.`);
    } finally { dom.window.close(); }
  }
  return { revision: release.revision, urls: release.paths.length };
}

async function main() {
  const option = name => process.argv[process.argv.indexOf(name) + 1];
  const remote = process.argv.includes('--url');
  const siteUrl = remote ? option('--url') : process.env.VITE_PUBLIC_SITE_URL || 'https://treecityrentals.com/';
  const expectedRevision = process.argv.includes('--revision') ? option('--revision') : undefined;
  const expectedCommit = process.argv.includes('--commit') ? option('--commit') : undefined;
  const read = remote ? async path => {
    const url = new URL(path, siteUrl); url.searchParams.set('release-check', expectedRevision || Date.now());
    const r = await fetch(url, { redirect: 'manual', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
    return { status: r.status, body: await r.text() };
  } : async path => ({ status: 200, body: await readFile(join(resolve('dist'), path.endsWith('/') ? `${path}index.html` : path), 'utf8') });
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await checkPublicPages({ read, siteUrl, expectedRevision, expectedCommit });
      if (remote) assert((await read('/__public-release-check-not-found__/')).status === 404, 'Unknown production routes must return HTTP 404.');
      console.info(`Verified ${result.urls} public URLs at revision ${result.revision}.`);
      break;
    } catch (error) {
      if (!remote || attempt === 5) throw error;
      console.info(`Public release check retry ${attempt + 1}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
