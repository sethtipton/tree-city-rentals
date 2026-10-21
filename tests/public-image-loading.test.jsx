import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { PublicSite } from '../src/components/PublicListings';
vi.mock('../src/hooks/useListingPhotos', () => ({ useListingPhotos: () => [] }));

it('loads both initially visible directory images eagerly while later cards remain lazy', () => {
  const listings = Array.from({ length: 3 }, (_, index) => ({ property_id: `p${index}`, unit_id: `u${index}`, property_name: '441 Park', property_slug: '441-park', unit_name: `Unit ${index}`, unit_slug: `unit-${index}`, listing_status: 'available' }));
  const dom = new JSDOM(renderToStaticMarkup(<PublicSite listings={listings} previewRoute={{ propertySlug: '', unitSlug: '' }} />));
  const images = [...dom.window.document.querySelectorAll('.public-listing-card img')];
  expect(images.map(img => img.getAttribute('loading'))).toEqual(['eager', 'eager', 'lazy']);
  expect(images.map(img => img.getAttribute('fetchPriority'))).toEqual(['high', 'high', 'auto']);
  dom.window.close();
});
