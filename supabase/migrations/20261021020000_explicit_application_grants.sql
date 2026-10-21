begin;

-- Older hosted projects supplied these grants through default privileges.
-- Declare the application's table access so a fresh migration replay works too.
-- Row-level policies continue to decide which records each user can access.
grant select, insert, update, delete on
  public.activity_log,
  public.attachments,
  public.items,
  public.maintenance_analyses,
  public.maintenance_attachment_case_links,
  public.maintenance_attachments,
  public.maintenance_request_entries,
  public.maintenance_request_events,
  public.maintenance_requests,
  public.properties,
  public.property_members,
  public.tenant_memberships,
  public.units,
  public.user_property_preferences,
  public.workspace_members,
  public.workspaces
to authenticated, service_role;

-- Listing-image writes have their own narrower authenticated grants.
grant select, insert, update, delete on public.listing_images to service_role;

commit;
