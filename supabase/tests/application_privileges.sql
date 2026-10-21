begin;
do $$
declare table_name text; privilege text;
begin
  foreach table_name in array array[
    'activity_log', 'attachments', 'items', 'maintenance_analyses',
    'maintenance_attachment_case_links', 'maintenance_attachments',
    'maintenance_request_entries', 'maintenance_request_events',
    'maintenance_requests', 'properties', 'property_members',
    'tenant_memberships', 'units', 'user_property_preferences',
    'workspace_members', 'workspaces'
  ] loop
    if not (select relrowsecurity from pg_class where oid = format('public.%I', table_name)::regclass) then
      raise exception 'Application table % must have row-level security', table_name;
    end if;
    foreach privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not has_table_privilege('authenticated', format('public.%I', table_name), privilege)
        or not has_table_privilege('service_role', format('public.%I', table_name), privilege) then
        raise exception 'Missing % grant for application table %', privilege, table_name;
      end if;
    end loop;
  end loop;
  foreach table_name in array array[
    'listing_inquiries', 'listing_inquiry_email_outbox', 'listing_inquiry_settings',
    'maintenance_email_outbox', 'maintenance_processing_leases', 'maintenance_public_submissions'
  ] loop
    if has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('anon', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Protected table % is exposed to an API role', table_name;
    end if;
  end loop;
end $$;
select 'Application grants, row-level security, and protected-table boundaries passed' as result;
rollback;
