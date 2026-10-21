-- Exercises the real worker RPCs using an isolated inquiry. No email is sent.
begin;
update public.listing_inquiry_settings set enabled=true;
update public.units set listing_published=true,listing_status='available' where id=current_setting('test.unit')::uuid;
insert into public.property_members(workspace_id,property_id,email,role)
values ('a0100000-0000-4000-8000-000000000001','a0200000-0000-4000-8000-000000000001','delivery@example.invalid','admin');
select public.submit_listing_inquiry('d0100000-0000-4000-8000-000000000001',current_setting('test.unit')::uuid,'Fixture sender','sender@example.invalid','Controlled inquiry',repeat('b',64));
update public.listing_inquiry_email_outbox set next_attempt_at='-infinity' where request_id='d0100000-0000-4000-8000-000000000001';
do $$
declare d jsonb; payload jsonb;
begin
 d:=public.claim_listing_inquiry_email();
 if d is null or d->>'request_id'<>'d0100000-0000-4000-8000-000000000001' then raise exception 'Controlled delivery fixture was not claimed'; end if;
 payload:=public.prepare_listing_inquiry_email((d->>'id')::uuid,(d->>'attempt_id')::uuid,jsonb_build_object('to',jsonb_build_array(d->>'recipient_email')));
 if payload is null then raise exception 'Assigned admin was rejected during preparation'; end if;
 if not public.finish_listing_inquiry_email((d->>'id')::uuid,(d->>'attempt_id')::uuid,null,'test_retry',true) then raise exception 'Delivery retry did not update'; end if;
 if not exists(select 1 from public.listing_inquiry_email_outbox where id=(d->>'id')::uuid and status='queued' and attempts=1 and next_attempt_at>now()) then raise exception 'Retry/backoff not saved'; end if;
 if public.finish_listing_inquiry_email((d->>'id')::uuid,gen_random_uuid(),'unrelated',null,false) then raise exception 'Stale worker changed delivery'; end if;
end $$;
rollback;
