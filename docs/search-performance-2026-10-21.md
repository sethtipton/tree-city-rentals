# Search fixes and Lighthouse comparison — October 21, 2026

Implemented and pushed [1fc9189](https://github.com/sethtipton/tree-city-rentals/commit/1fc91890838ff4fba32fdc7be05af383aa23098a) to `main`.
[Deployment and production checks passed](https://github.com/sethtipton/tree-city-rentals/actions/runs/39542492350).

## Changes delivered

1. **Canonical route guards:** validate every sitemap route's physical HTML,
   headings, metadata, canonical and shared content revision before upload.
   After deployment, check HTTP 200 for all released routes, matching application
   commit and content revision, and HTTP 404 for an unknown route. The earlier
   prerendering release was already live before this commit; this work protects
   it against regression. All five priority URLs, robots.txt and sitemap.xml now
   pass in production; the saved mixed-case listing URL still works.
2. **Coherent publication:** the browser reads the deployed public listing
   snapshot instead of unpublished database changes. Directory links, HTML,
   metadata and sitemap share one revision and Pages artifact. An automated
   five-minute content comparison requests a new release only when necessary,
   without interrupting an active deployment. No new credentials or database
   migrations were needed. Scheduled publication is eventual: GitHub can delay
   checks and disable schedules on inactive public repositories. Operational
   details are in [the release documentation](</Users/sethtipton/Documents/Tree City Rentals/docs/public-listing-releases.md>).
3. **Image loading:** eagerly load and prioritize the first two visible card
   images, retaining lazy loading on subsequent cards. Build responsive WebP
   variants at 480/768/1024px, preserve original assets, and account conservatively
   for cover cropping. Preserve prerendered content if the release JSON cannot
   be fetched.

Validation: lint, production build, **186 tests across 35 suites**, canonical
artifact checks, successful CI database/backend checks and production HTTP checks.
Browser verification confirmed no direct live-listing RPC, working inquiry
opening/closing and listing navigation, and no page errors. No inquiry was sent.
The refresh workflow correctly deferred while deployment was active, then
[confirmed no content differences after deployment](https://github.com/sethtipton/tree-city-rentals/actions/runs/39542715687).

## Measured comparison

Lighthouse **13.5.0**, Chrome **155**, default simulated mobile throttling
(150ms RTT, 1638.4Kbps, 4× CPU slowdown, 412×823, DPR 1.75). Each mobile value is
the median of **three runs per URL**, calculated separately for each metric.
Measurements ran sequentially. There are 25 new reports: 21 mobile runs and four
desktop checks. Desktop measurements below have one run each.

| Production homepage | Original audit, Oct 20 | Immediately before this commit | After deployment |
|---|---:|---:|---:|
| Mobile Performance | 79 | 85 | **91** |
| Lab LCP | 5.241s | 4.313s | **3.411s** |
| Lab CLS | 0 | 0 | 0 |
| TBT | 0ms | 0ms | 0ms |
| Total transferred | — | 686,613 bytes | **498,852 bytes** |

The fresh before/after sample shows **6 score points**, **20.9% lower LCP** and
**27.3% less transfer**. Versus the original audit, the homepage gains 12 score
points and LCP falls 34.9%; that longer interval also includes the earlier
prerendering and inquiry-overlay releases, so its full benefit is not attributed
to this commit. Production homepage LCP varied from **1.771s to 4.176s** after
deployment; the best single run scored 100, but the reported median is 91.

| Current production URL | Mobile Performance | Lab LCP | CLS | TBT |
|---|---:|---:|---:|---:|
| `/` | **91** | **3.411s** | 0 | 0ms |
| `/441-park/` | **97** | **2.389s** | 0 | 0ms |
| `/469-carthage/main-unit/` | **98** | **2.278s** | .0252 | 0ms |

Earlier production property/detail requests returned HTTP 404, so they have no
valid original production performance baseline. Compare their matching local
production-build templates separately:

| Local template | Previous score → current | Previous LCP → current |
|---|---:|---:|
| Directory | 88 → **91** | 3.829s → **3.454s** |
| Property | 94 → **98** | 3.003s → **2.253s** |
| Listing | 93 → **98** | 3.153s → **2.253s** |

Current production desktop: directory **100 / .672s LCP**; listing
**100 / .670s LCP**. Mobile SEO is 100 on all three tested production templates.
Property/detail mobile LCP is below the 2.5s reference; the directory remains
above it. Lab scores do not establish real-user p75 LCP, INP or CLS. Search
traffic, indexing and conversion changes were not measured.

## Further performance improvements, in order

1. **Test AVIF variants for the directory's exterior photos.** Its current
   mobile image requests still use the 1024px variants: about 131KB for 441 Park
   and 210KB for Carthage. Together they account for roughly two thirds of the
   homepage's transfer. Keep WebP fallbacks and compare equal visual quality,
   transfer and three-run LCP before choosing encoding settings. The repeated
   LCP element remains the second card, now correctly eager and high priority.
   No additional savings estimate has been measured yet.
2. **Reduce the initial public JavaScript.** The current homepage still has
   **81,953 bytes (80KiB) of estimated unused JavaScript**, with Lighthouse's
   estimated 360ms opportunity in the median-LCP run. Isolate anonymous reads
   and defer auth/storage/realtime loading where session behavior permits;
   the main entry still initializes Supabase eagerly. Preserve automatic
   session restoration and inquiry behavior. This is a transfer/loading
   opportunity; median TBT is already zero.
3. **Split workspace CSS out of the public entry.** The shared stylesheet is
   still about **109KB uncompressed / 18KB gzip**. Lighthouse flags about
   **340ms** of potential render-blocking savings. Move operational workspace
   selectors into the lazy workspace import, retaining the public styles and
   shared tokens at startup. Verify first paint, responsive layouts and
   inquiry dialogs after splitting. Lighthouse's savings estimates overlap and
   must not be added or treated as promised speedups.

Supporting measurements are retained in
[comparison JSON](</Users/sethtipton/Documents/Tree City Rentals/docs/search-performance-2026-10-21.json>).
Raw reports and HTTP evidence remain under
[the local evidence directory](</Users/sethtipton/Documents/Tree City Rentals/audit-reports/2026-10-21-search-fixes>).
Reproduce with the committed `scripts/measure-search-performance.mjs` runner.
