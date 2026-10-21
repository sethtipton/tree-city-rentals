-- Pricing remains editable internally and is absent from the anonymous RPC.
update public.units set monthly_rent=1400,listing_published=true,listing_status='available'
where id=current_setting('test.unit')::uuid;
do $$ begin
 if (select monthly_rent from public.units where id=current_setting('test.unit')::uuid)<>1400 then
  raise exception 'Internal monthly rent must remain stored';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='units' and column_name='rent_display_type') then
  raise exception 'Retired rent display setting must not exist';
 end if;
end $$;
set local role anon;
do $$ declare payload jsonb; begin
 select to_jsonb(listing) into payload from public.get_public_listings() listing where unit_id=current_setting('test.unit')::uuid;
 if payload is null then raise exception 'Published fixture must be readable anonymously'; end if;
 if payload ? 'monthly_rent' or payload ? 'rent_display_type' then raise exception 'Internal pricing must not enter the public response'; end if;
end $$;
reset role;
