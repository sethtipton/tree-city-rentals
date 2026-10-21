begin;

-- Monthly rent remains an internal unit fact. Public listings expose no price.
-- Drop/recreate is required because the public RPC return shape is changing.
drop function public.get_public_listings();
alter table public.units drop column rent_display_type;

create or replace function public.get_public_listings()
returns table (
  property_id uuid,
  unit_id uuid,
  property_name text,
  property_slug text,
  unit_name text,
  unit_slug text,
  property_type text,
  listing_headline text,
  listing_status text,
  display_address text,
  city text,
  state text,
  neighborhood text,
  available_date date,
  lease_term text,
  bedrooms numeric,
  full_bathrooms numeric,
  half_bathrooms numeric,
  interior_square_feet integer,
  listing_description text,
  amenities text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    property.id,
    unit.id,
    coalesce(nullif(property.public_name, ''), property.name),
    public.listing_slug(property.name),
    unit.name,
    public.listing_slug(unit.name),
    nullif(property.property_type, ''),
    coalesce(
      nullif(unit.listing_headline, ''),
      concat_ws(' ', coalesce(nullif(property.public_name, ''), property.name), nullif(unit.unit_number, ''), nullif(unit.name, 'Main Unit'))
    ),
    unit.listing_status,
    case unit.address_visibility
      when 'full' then concat_ws(', ',
        nullif(concat_ws(' ', nullif(property.street_address, ''), nullif(unit.unit_number, '')), ''),
        nullif(concat_ws(', ', nullif(property.city, ''), nullif(property.state, '')), ''),
        nullif(property.postal_code, '')
      )
      when 'approximate' then coalesce(
        nullif(property.neighborhood, ''),
        nullif(concat_ws(', ', nullif(property.city, ''), nullif(property.state, '')), '')
      )
      else nullif(concat_ws(', ', nullif(property.city, ''), nullif(property.state, '')), '')
    end,
    nullif(property.city, ''),
    nullif(property.state, ''),
    nullif(property.neighborhood, ''),
    unit.available_date,
    nullif(unit.lease_term, ''),
    unit.bedrooms,
    unit.full_bathrooms,
    unit.half_bathrooms,
    unit.interior_square_feet,
    nullif(unit.listing_description, ''),
    array_remove(unit.amenities, '')
  from public.units unit
  join public.properties property on property.id = unit.property_id
  where unit.listing_published
    and unit.listing_status in ('available', 'coming-soon')
  order by
    case unit.listing_status when 'available' then 0 else 1 end,
    unit.available_date nulls last,
    property.sort_order,
    unit.sort_order;
$$;

revoke all on function public.get_public_listings() from public;
grant execute on function public.get_public_listings() to anon, authenticated;
notify pgrst, 'reload schema';

commit;
