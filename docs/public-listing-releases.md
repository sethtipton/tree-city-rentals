# Public listing releases

The public directory, property/listing HTML, metadata, sitemap, and
`public-listings.json` are published in one GitHub Pages artifact. A SHA-256
content revision identifies the allowlisted public facts and canonical routes.
CI also records the source commit so the post-deployment check cannot pass
against an older application build with unchanged listing data.

The browser refreshes its directory from the deployed JSON, never directly from
unreleased Supabase listing rows. Admin editing and previews continue to use
current database records. Public changes become visible after a successful site
release; new links are not exposed while their route files are still missing.
An unavailable manifest leaves already prerendered content usable.

`Refresh Public Listings` checks Supabase against the deployed revision every
five minutes, away from the top of the hour. It requests the existing Pages
workflow only when content differs and no Pages release is already active.
The runner uses the existing public Supabase variables and its short-lived
GitHub token; no deployment credentials are sent to the browser or Supabase.
GitHub can delay scheduled workflows and disables schedules in inactive public
repositories, so this is eventual publication, not an immediate-publication SLA.
Failed comparisons/builds preserve the last deployed public release and fail
visibly in Actions. The next scheduled check retries differences automatically.
Run `Refresh Public Listings` manually in Actions to check immediately.

Before upload, `node scripts/check-public-pages.mjs` verifies the manifest hash,
the exact sitemap URL set, prerendered content, metadata, internal destinations,
and matching revision on every canonical page. After deployment it repeats the
HTTP checks against the expected content and source revisions and verifies a
nonexistent URL returns 404. Production propagation is retried for up to six
attempts.

`npm run build` first creates responsive exterior WebP variants using Sharp.
Generated images are ignored by Git and rebuilt from the preserved original
processed images. Public cards account conservatively for cover cropping and
use eager loading for the first two visible images. Later images remain lazy.

Reproduce mobile Lighthouse medians (three runs per template) with
`node scripts/measure-search-performance.mjs local` or `after`. `before` records
the live homepage before deployment. The CLI is pinned to Lighthouse 13.5.0 to
match the original audit. Raw reports stay under `audit-reports/`; treat field
Core Web Vitals and search outcomes separately from these lab measurements.

References: [workflow dispatch authentication](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
[scheduled workflow limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[responsive images](https://web.dev/learn/design/responsive-images).
