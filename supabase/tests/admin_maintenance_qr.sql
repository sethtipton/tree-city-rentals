begin;
-- Isolated fixtures: this suite always rolls back, including the rehearsed migration.
insert into public.workspaces(id,name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','Admin QR routing tests');
insert into public.properties(id,workspace_id,name) values
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','QR assigned'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb72','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','QR other');
insert into public.units(id,workspace_id,property_id,name,maintenance_access_token_hash,maintenance_access_enabled) values
('cccccccc-cccc-cccc-cccc-cccccccccc71','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71','UP',encode(extensions.digest(repeat('A',43),'sha256'),'hex'),true),
('cccccccc-cccc-cccc-cccc-cccccccccc72','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71','DOWN',encode(extensions.digest(repeat('B',43),'sha256'),'hex'),true),
('cccccccc-cccc-cccc-cccc-cccccccccc73','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb72','MAIN',encode(extensions.digest(repeat('C',43),'sha256'),'hex'),true);
insert into public.property_members(workspace_id,property_id,email,role) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71','qr-admin@example.test','admin'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71','qr-viewer@example.test','viewer');
insert into public.workspace_members(workspace_id,email,role) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','qr-owner@example.test','owner');
insert into public.tenant_memberships(workspace_id,property_id,unit_id,email) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71','cccccccc-cccc-cccc-cccc-cccccccccc71','qr-tenant@example.test');

do $$ begin
 if has_function_privilege('anon','public.resolve_admin_maintenance_qr(text)','execute') then raise exception 'Anonymous resolver access'; end if;
 if not has_function_privilege('authenticated','public.resolve_admin_maintenance_qr(text)','execute') then raise exception 'Authenticated resolver unavailable'; end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111171',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111171","email":"qr-admin@example.test","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select unit_id from public.resolve_admin_maintenance_qr(repeat('A',43))) is distinct from 'cccccccc-cccc-cccc-cccc-cccccccccc71'::uuid then raise exception 'Admin UP route incorrect'; end if;
 if (select unit_id from public.resolve_admin_maintenance_qr(repeat('B',43))) is distinct from 'cccccccc-cccc-cccc-cccc-cccccccccc72'::uuid then raise exception 'Admin DOWN route incorrect'; end if;
 if exists(select 1 from public.resolve_admin_maintenance_qr(repeat('C',43))) then raise exception 'Other property exposed'; end if;
 if exists(select 1 from public.resolve_admin_maintenance_qr('bad')) or exists(select 1 from public.resolve_admin_maintenance_qr(repeat('D',43))) then raise exception 'Invalid token accepted'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111171","email":"qr-owner@example.test","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.resolve_admin_maintenance_qr(repeat('C',43))) <> 1 then raise exception 'Owner access denied'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111171","email":"qr-viewer@example.test","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.resolve_admin_maintenance_qr(repeat('A',43))) then raise exception 'Unauthorized identity exposed routing data: qr-viewer@example.test'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111171","email":"qr-tenant@example.test","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.resolve_admin_maintenance_qr(repeat('A',43))) then raise exception 'Unauthorized identity exposed routing data: qr-tenant@example.test'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111171","email":"qr-outsider@example.test","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.resolve_admin_maintenance_qr(repeat('A',43))) then raise exception 'Unauthorized identity exposed routing data: qr-outsider@example.test'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111171","email":"qr-owner@example.test","role":"authenticated"}',true);
update public.units set maintenance_access_enabled=false where id='cccccccc-cccc-cccc-cccc-cccccccccc71';
update public.units set maintenance_access_token_hash=encode(extensions.digest(repeat('E',43),'sha256'),'hex') where id='cccccccc-cccc-cccc-cccc-cccccccccc72';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.resolve_admin_maintenance_qr(repeat('A',43))) then raise exception 'Disabled token accepted'; end if;
 if exists(select 1 from public.resolve_admin_maintenance_qr(repeat('B',43))) then raise exception 'Rotated token accepted'; end if;
 if (select unit_id from public.resolve_admin_maintenance_qr(repeat('E',43))) is distinct from 'cccccccc-cccc-cccc-cccc-cccccccccc72'::uuid then raise exception 'Replacement token incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.resolve_admin_maintenance_qr(repeat('E',43))) then raise exception 'Missing identity accepted'; end if;
end $$;
reset role;
select 'Admin QR authorization, unit selection, disabled/rotated tokens, and disclosure checks passed' as result;
rollback;
