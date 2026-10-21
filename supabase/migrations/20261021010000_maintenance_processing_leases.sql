begin;

-- A short-lived, per-request claim serializes transcription, retries and analysis.
-- The Edge Function has a 110-second deadline, below this 180-second lease.
create table public.maintenance_processing_leases (
  maintenance_request_id uuid primary key references public.maintenance_requests(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.maintenance_processing_leases enable row level security;
revoke all on public.maintenance_processing_leases from public, anon, authenticated;
grant all on public.maintenance_processing_leases to service_role;

create function public.claim_maintenance_processing(target_request_id uuid, force_reanalysis boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare lease_token uuid := gen_random_uuid(); acquired uuid;
begin
  if not public.can_access_maintenance_request(target_request_id)
    or (force_reanalysis and not public.can_manage_maintenance_request(target_request_id)) then
    raise exception 'maintenance_processing_forbidden' using errcode = '42501';
  end if;
  insert into public.maintenance_processing_leases(maintenance_request_id, token, expires_at)
  values (target_request_id, lease_token, clock_timestamp() + interval '180 seconds')
  on conflict (maintenance_request_id) do update
    set token = excluded.token, expires_at = excluded.expires_at
    where maintenance_processing_leases.expires_at <= clock_timestamp()
  returning token into acquired;
  if acquired is null then return jsonb_build_object('status', 'already-processing'); end if;
  return jsonb_build_object('status', 'claimed', 'token', acquired);
end;
$$;

create function public.release_maintenance_processing(target_request_id uuid, lease_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_maintenance_request(target_request_id) then
    raise exception 'maintenance_processing_forbidden' using errcode = '42501';
  end if;
  delete from public.maintenance_processing_leases where maintenance_request_id = target_request_id and token = lease_token;
  return found;
end;
$$;
revoke all on function public.claim_maintenance_processing(uuid, boolean) from public, anon;
revoke all on function public.release_maintenance_processing(uuid, uuid) from public, anon;
grant execute on function public.claim_maintenance_processing(uuid, boolean) to authenticated;
grant execute on function public.release_maintenance_processing(uuid, uuid) to authenticated;
commit;
