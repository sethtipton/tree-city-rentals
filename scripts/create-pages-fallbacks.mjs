import { loadEnv } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { fetchPublicListings, generatePublicPages } from "./public-pages.mjs";

const env = { ...loadEnv("production", process.cwd(), "VITE_"), ...process.env };
const offline = process.argv.includes("--offline");
const listings = offline ? [] : await fetchPublicListings({ url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY });
const renderPage = offline ? undefined : (await import(pathToFileURL(resolve("node_modules/.cache/tree-city-prerender/prerender.js")).href)).renderPublicPage;
const result = await generatePublicPages({ distDir: resolve("dist"), listings, siteUrl: env.VITE_PUBLIC_SITE_URL || undefined, renderPage, offline });
console.info(`Generated public pages: ${result.listings} listings, ${result.properties} properties, ${result.sitemapUrls} sitemap URLs.`);
