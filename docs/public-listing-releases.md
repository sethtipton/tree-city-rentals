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

Monthly rent is internal unit data. Public listing responses, snapshots,
metadata, pages and AI listing-copy inputs exclude it. The former rent display
type setting and its database column have been removed; internal monthly rent
values are preserved.

After saving listing edits, open **GitHub → Actions → Publish Public Site →
Run workflow**, select `main`, and run it. The published site updates when the
build and deployment finish. There is no polling schedule or automatic content
check. Failed builds preserve the previous public release and fail visibly in
Actions; correct the issue and run the workflow again.

`publish-public-site.yml` builds and validates the frontend, deploys Pages, and
checks the live canonical routes. It does not call backend tests or deploy
Supabase functions. It supports both manual dispatch and reusable workflow calls.
Normal pushes to `main` run `Deploy Application`, which deploys the backend and
then calls the same public-site workflow. The shared Pages concurrency group
serializes publication runs.

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

References: [reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows),
[responsive images](https://web.dev/learn/design/responsive-images).
