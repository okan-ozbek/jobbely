// A deterministic reading of explicit location labels, not a geocoder. Unknowns stay unknown.
const regionCodes =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );

const names = new Intl.DisplayNames(['en'], { type: 'region' });
const countryNames = new Map(regionCodes.map((code) => [code, names.of(code)!]));

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase('en').replace(/[.]/g, '').replace(/\s+/g, ' ');

const countries = new Map([...countryNames].map(([code, name]) => [normalize(name), code]));

for (const [alias, code] of Object.entries({
  us: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  britain: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  holland: 'NL',
  'the netherlands': 'NL',
  korea: 'KR',
  'south korea': 'KR',
  'czech republic': 'CZ',
  turkey: 'TR',
  vietnam: 'VN',
  taiwan: 'TW',
  'great britain': 'GB',
  uae: 'AE',
  ksa: 'SA',
  usa: 'US',
})) {
  countries.set(alias, code);
}

const alpha3 = new Map(
  Object.entries({
    USA: 'US',
    CAN: 'CA',
    GBR: 'GB',
    NLD: 'NL',
    DEU: 'DE',
    IRL: 'IE',
    IND: 'IN',
    AUS: 'AU',
    POL: 'PL',
    FRA: 'FR',
    ESP: 'ES',
    ITA: 'IT',
    JPN: 'JP',
    MEX: 'MX',
    MYS: 'MY',
    SGP: 'SG',
    SAU: 'SA',
    VNM: 'VN',
    CHN: 'CN',
    PRC: 'CN',
    CHE: 'CH',
    BEL: 'BE',
    SWE: 'SE',
    FIN: 'FI',
    DNK: 'DK',
    NZL: 'NZ',
    BRA: 'BR',
    ARE: 'AE',
    ZAF: 'ZA',
  }),
);

for (const [alias, code] of alpha3) {
  countries.set(normalize(alias), code);
}

const cityAliases = new Map(
  Object.entries({
    nyc: 'New York City',
    'new york': 'New York City',
    sf: 'San Francisco',
    sea: 'Seattle',
    atl: 'Atlanta',
    chi: 'Chicago',
    bangalore: 'Bengaluru',
  }),
);

const cityName = (value: string) => cityAliases.get(normalize(value)) ?? value;

const usStates = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(
    ' ',
  ),
);

const canadaProvinces = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));

const subdivisions = new Set(
  'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York State|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington State|West Virginia|Wisconsin|Wyoming|Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Nova Scotia|Ontario|Prince Edward Island|Quebec|Saskatchewan|Northwest Territories|Nunavut|Yukon'
    .split('|')
    .map(normalize),
);

const excluded =
  /^(?:remote|hybrid|on[ -]?site|home|anywhere|worldwide|global|emea|apac|europe|multiple locations|various locations|north america|latam|united states|united kingdom|canada|australia|united states of america)$/i;

export interface CatalogLocation {
  country: string | null;
  city: string | null;
}

export function catalogLocation(label: string): CatalogLocation {
  const remoteScope = label.trim().match(/^(?:remote|virtual)\s*\(([^)]+)\)$/i);

  if (remoteScope) {
    const scope = remoteScope[1]!;

    return {
      country:
        countries.get(normalize(scope)) ??
        (regionCodes.includes(scope) && !usStates.has(scope) && !canadaProvinces.has(scope)
          ? scope
          : null),
      city: null,
    };
  }

  let cleaned = label
    .trim()
    .replace(/\s*\((?:remote|hybrid|on[ -]?site|virtual|home mix)\)\s*/gi, '')
    .replace(
      /^(?:remote|virtual|hybrid|on[ -]?site)\s*(?:(?:in|from)\s+(?:the\s+)?)?[-–:|, ]\s*/i,
      '',
    )
    .replace(/\s+(?:locations|remote)$/i, '')
    .trim();

  // Explicit office labels such as NL-Amsterdam and US-CA-Menlo Park carry a country prefix.
  const prefix = cleaned.match(/^([A-Z]{2,3})[-_.]\s*/);

  const prefixCountry = prefix
    ? (alpha3.get(prefix[1]!) ?? (regionCodes.includes(prefix[1]!) ? prefix[1]! : null))
    : null;

  if (prefixCountry) {
    cleaned = cleaned
      .slice(prefix![0].length)
      .replace(/^[A-Z]{2}[-_.]/, '')
      .replace(/[-_](?:MSO|WW|HQ)$/i, '');
  }

  const parenthetical = cleaned.match(/^(.*?)\s*\(([A-Z]{2,3})\)$/);

  if (parenthetical) {
    cleaned = `${parenthetical[1]}, ${parenthetical[2]}`;
  }

  const office = cleaned.match(/^[A-Z]{2,4}\s*\((.+)\)$/);

  if (office && office[1]!.includes(',')) {
    cleaned = office[1]!;
  }

  const parts = cleaned.split(/\s*(?:,|\||\s[-–]\s)\s*/).filter(Boolean);
  const namedCountry = parts.findIndex((part) => countries.has(normalize(part)));

  const countryPart =
    namedCountry >= 0
      ? namedCountry
      : parts.findIndex(
          (part, index) =>
            regionCodes.includes(part) &&
            parts.length > 1 &&
            (index === 0 || (!usStates.has(part) && !canadaProvinces.has(part))),
        );

  const explicit =
    prefixCountry ??
    (countryPart < 0
      ? null
      : (countries.get(normalize(parts[countryPart]!)) ?? parts[countryPart]!));

  const inferred =
    !explicit && parts.length > 1 && !regionCodes.includes(parts.at(-1)!)
      ? usStates.has(parts.at(-1)!)
        ? 'US'
        : canadaProvinces.has(parts.at(-1)!)
          ? 'CA'
          : null
      : null;

  const country = explicit ?? inferred;

  const candidates = parts.filter(
    (part, index) =>
      index !== countryPart &&
      !excluded.test(part) &&
      !usStates.has(part) &&
      !canadaProvinces.has(part) &&
      !regionCodes.includes(part) &&
      !subdivisions.has(normalize(part)) &&
      !countries.has(normalize(part)) &&
      !/^(?:\d+|n\/?a|home office|all offices|distributed|in-office|amer|namer|apjc|eu|north|south|northeast|southeast|west coast|central|republic of)$/i.test(
        part,
      ) &&
      !/\b(?:remote|virtual|locations|home office|select locations|or)\b/i.test(part),
  );

  const city =
    country === 'SG' && cleaned.toLowerCase() === 'singapore'
      ? 'Singapore'
      : country === 'HK' && cleaned.toLowerCase() === 'hong kong'
        ? 'Hong Kong'
        : candidates[0]
          ? cityName(candidates[0])
          : null;

  return { country, city };
}

export function catalogLocations(labels: string[]): CatalogLocation[] {
  const locations = labels.flatMap((label) => label.split(/\s*;\s*/).map(catalogLocation));

  const countryOnly = [
    ...new Set(
      locations
        .filter((location) => location.country && !location.city)
        .map((location) => location.country),
    ),
  ];

  const uniqueCountries = new Set(locations.map((location) => location.country).filter(Boolean));
  const inherited = countryOnly.length === 1 && uniqueCountries.size === 1 ? countryOnly[0]! : null;

  return locations.map((location) => ({ ...location, country: location.country ?? inherited }));
}

export function catalogCountryName(code: string) {
  return countryNames.get(code) ?? code;
}

export function matchesCatalogLocation(labels: string[], country?: string, city?: string) {
  return (
    (!country && !city) ||
    catalogLocations(labels).some((location) => {
      return (
        (!country || location.country === country.toUpperCase()) &&
        (!city ||
          (location.city !== null && normalize(location.city) === normalize(cityName(city))))
      );
    })
  );
}
