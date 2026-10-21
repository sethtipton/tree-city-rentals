-- All listing suites use isolated records, never the family's live properties.
insert into public.workspaces(id,name) values ('a0100000-0000-4000-8000-000000000001','Listing regression workspace');
insert into public.properties(id,workspace_id,name) values ('a0200000-0000-4000-8000-000000000001','a0100000-0000-4000-8000-000000000001','Listing regression property');
insert into public.units(id,workspace_id,property_id,name) values ('a0300000-0000-4000-8000-000000000001','a0100000-0000-4000-8000-000000000001','a0200000-0000-4000-8000-000000000001','Main Unit');
select set_config('test.unit','a0300000-0000-4000-8000-000000000001',true);
select set_config('test.unit_id','a0300000-0000-4000-8000-000000000001',true);
