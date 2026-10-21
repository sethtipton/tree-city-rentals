import { appendFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
import { fetchPublicListings } from './public-pages.mjs';
import { createPublicRelease } from './public-release.mjs';
import { parsePublicRelease } from '../src/lib/publicRelease.js';
import { canonicalSiteUrl } from '../src/lib/publicSeo.js';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const release = createPublicRelease(await fetchPublicListings({ url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY }));
const url = new URL('public-listings.json', canonicalSiteUrl(env.VITE_PUBLIC_SITE_URL));
url.searchParams.set('content-check', Date.now());
const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
if (!response.ok && response.status !== 404) throw new Error(`Could not check published content (HTTP ${response.status}).`);
const deployed = response.ok ? parsePublicRelease(await response.json()) : null;
const changed = release.revision !== deployed?.revision;
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
console.info(changed ? 'Public listing changes require a Pages release.' : 'Public listings match the deployed release.');
