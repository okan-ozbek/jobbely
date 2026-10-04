import { describe, expect, it } from 'vitest';
import { catalogLocation, catalogLocations, matchesCatalogLocation } from './locations.js';

describe('public catalog location filters', () => {
  it.each([
    ['Amsterdam, Netherlands', 'NL', 'Amsterdam'],
    ['Remote - United Kingdom', 'GB', null],
    ['San Francisco, CA', null, 'San Francisco'],
    ['Vancouver, BC', 'CA', 'Vancouver'],
    ['CA - Ontario - Toronto', 'CA', 'Toronto'],
    ['United States - California - San Francisco', 'US', 'San Francisco'],
    ['Berlin, DE (Hybrid)', null, 'Berlin'],
    ['Berlin, Germany (Hybrid)', 'DE', 'Berlin'],
    ['NL-Amsterdam', 'NL', 'Amsterdam'],
    ['US-CA-Menlo Park', 'US', 'Menlo Park'],
    ['GB-London', 'GB', 'London'],
    ['Remote (DEU)', 'DE', null],
    ['Remote (CA)', null, null],
    ['Remote Netherlands', 'NL', null],
    ['Amsterdam (NLD)', 'NL', 'Amsterdam'],
    ['Remote', null, null],
    ['EMEA', null, null],
    ['Cambridge', null, 'Cambridge'],
  ])('reads %s without inventing a city or country', (label, country, city) => {
    expect(catalogLocation(label)).toEqual({ country, city });
  });

  it('reads semicolon alternatives and uses one explicit whole-job country without crossing countries', () => {
    expect(
      catalogLocations(['United States', 'San Francisco, California; Seattle, Washington']),
    ).toEqual([
      { country: 'US', city: null },
      { country: 'US', city: 'San Francisco' },
      { country: 'US', city: 'Seattle' },
    ]);

    expect(matchesCatalogLocation(['US-CA-Menlo Park; NL-Amsterdam'], 'NL', 'Menlo Park')).toBe(
      false,
    );

    expect(matchesCatalogLocation(['US-CA-Menlo Park; NL-Amsterdam'], 'NL', 'Amsterdam')).toBe(
      true,
    );
  });

  it('requires country and city to occur in the same location and compares city case insensitively', () => {
    const locations = ['Amsterdam, Netherlands', 'Berlin, Germany'];

    expect(matchesCatalogLocation(locations, 'NL', 'amsterdam')).toBe(true);
    expect(matchesCatalogLocation(locations, 'NL', 'Berlin')).toBe(false);
    expect(matchesCatalogLocation(['Remote'], 'NL')).toBe(false);
  });
});
