# QR admin routing — first phase

The existing `/maintenance/q/<token>/` URL now sends a signed-in property editor to the existing unit workspace. Public and unauthorized users retain the public intake form. No tokens are generated, rotated, or disabled by this change. No dashboards, tasks, visits, or tracking systems are added.

## Authorization

`resolve_admin_maintenance_qr(target_token text)` is executable only by authenticated callers (not anonymous callers). It requires an authenticated user ID, checks the existing 43-character capability format, hashes the token with SHA-256, checks the active unit capability, and calls `can_edit_property` for that unit's parent property. Denied or unknown tokens return no rows. Authorized callers receive only property/unit IDs and names used by the existing name-based routing helpers.

The narrowly scoped security-definer function uses an empty search path and schema-qualified objects. It returns only explicitly authorized records; it does not change table grants or RLS policies. Normal workspace loaders still enforce existing RLS. Existing tenant-only and viewer-only identities do not satisfy property edit permission. An identity with independently granted owner/admin access retains that access.

The current capability schema does not define a token expiry date; enabled status and rotation govern validity, as before.

## Client and login behavior

`App.jsx` already waits for auth initialization before rendering `MaintenanceQrRoute` and supplies the user and existing Google sign-in callback. The QR route checks authenticated access before rendering the public form. A verified result navigates with `location.replace` to `getScopePath`'s canonical property/unit URL, reusing normal workspace initialization. It does not invent slugs or a separate route. Canonical capitalization is whatever the existing helper produces.

A small Property team / Sign in action uses the existing `signInWithGoogle` flow. Its `next` parameter preserves the exact QR URL. `restoreAuthReturnPath` restores that URL, allowing the same route to evaluate the newly signed-in identity. Stale asynchronous results are ignored after token/user changes or unmount. Resolver errors fall back to existing public validation rather than granting access or blocking intake.

## Files

- `src/components/MaintenanceQrRoute.jsx`: access decision, loading/cancellation, redirect, and existing sign-in action.
- `src/lib/maintenanceQr.js`: authenticated RPC wrapper and verified routing result validation.
- `supabase/migrations/20261007230000_admin_maintenance_qr_routing.sql`: new RPC and execute grants.
- `supabase/schema.sql`: equivalent bootstrap definition.
- `tests/admin-maintenance-qr.test.jsx`: public/admin decisions, auth changes, stale results, invalid tokens, failures.
- `tests/admin-maintenance-qr-resolver.test.js`: routing output and existing OAuth return context.
- `supabase/tests/admin_maintenance_qr.sql`: transactional authorization and capability checks.
- `scripts/test-maintenance-db.mjs`: adds the QR suite and optional `--suite=<name>` selection.

No change to `App.jsx` was needed: it already provides the required auth props and startup gating.

## Rollout

The migration was applied to the linked production Supabase project on October 8, 2026. The admin QR database suite passed both rehearsal and verification after application. Frontend deployment uses the existing GitHub Pages workflow.

1. Review and apply `supabase/migrations/20261007230000_admin_maintenance_qr_routing.sql` to the existing Supabase project (SQL Editor, or normal reviewed migration deployment). Do not rerun the full bootstrap schema against the existing database.
2. Run `node scripts/test-maintenance-db.mjs --linked --suite=admin_maintenance_qr`.
3. Deploy the frontend through the existing GitHub Pages workflow. The workflow already checks required migrations before deployment. No new Edge Function or secrets are required.
4. Check an existing printed QR as an anonymous visitor and as an assigned admin; also sign in from the QR page with the real Google account. Confirm the correct unit opens and existing submissions still succeed.

## Verification

- Lint and production build passed; all 115 Vitest tests passed.
- Linked-database rehearsal passed the new admin QR suite, existing 26 RLS checks, and existing public submission suite. All test transactions rolled back.
- The existing maintenance email suite fails with `Queued before completion`, including when run without this migration. It was not changed by this patch.
- Chrome DevTools confirmed the malformed-QR unavailable state locally, with no console errors.
- Real Google login and a real printed QR scan were not exercised. The production migration is installed; frontend deployment is verified through GitHub Actions.
- The existing production bundle-size warning remains; this patch adds approximately 1.1 KB minified / 0.2 KB gzipped JavaScript compared with the pre-change build.

## Saving and reprinting cards

The QR controls now emphasize **Save PDF or print this card**, explain how to save a PDF in Chrome or the Mac print dialog, and recommend printing at 100% scale and testing the printed code. The print document title includes the property and unit to help name saved files, then restores the app title after printing or cancellation.

An active code cannot be retrieved from its stored hash. Reprint a saved PDF to retain the same code. Rotating without a saved copy invalidates all prior cards. Saving or printing alone never rotates a code.

The printing test verifies repeated printing uses the same generated token and restores the document title. Actual printer output and Google login require a real device/account check.
