begin;
-- Resolve a maintenance capability only for a signed-in property editor.
-- Does not rotate tokens or change public intake/RLS policies.
create or replace function public.resolve_admin_maintenance_qr(target_token text)
returns table (property_id uuid, unit_id uuid, property_name text, unit_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select property.id, unit.id, property.name, unit.name
  from public.units unit
  join public.properties property
    on property.id = unit.property_id and property.workspace_id = unit.workspace_id
  where auth.uid() is not null
    and target_token ~ '^[A-Za-z0-9_-]{43}$'
    and unit.maintenance_access_enabled
    and unit.maintenance_access_token_hash = encode(extensions.digest(target_token, 'sha256'), 'hex')
    and public.can_edit_property(property.id, property.workspace_id)
  limit 1;
$$;

revoke all on function public.resolve_admin_maintenance_qr(text) from public, anon;
grant execute on function public.resolve_admin_maintenance_qr(text) to authenticated;
commit;
