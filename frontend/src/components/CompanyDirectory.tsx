import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo.js';
import { CoverageStatus } from './CoverageStatus.js';
import { LoadingSkeleton } from './LoadingSkeleton.js';
import type { Company } from '../api/client.js';
import { GlassSelect } from './GlassSelect.js';
import { moveSurface, resetSurface } from './surface-motion.js';

// Presentation groups do not affect source coverage, matching or employer identity.
const financialCompanies = new Set([
  'jane-street',
  'radix-trading',
  'hrt',
  'five-rings',
  'citadel',
  'two-sigma',
  'headlands',
  'optiver',
  'bloomberg',
  'jpmorgan',
  'goldman-sachs',
  'abn-amro',
  'ing',
]);

const gamingCompanies = new Set(['riot-games', 'blizzard']);
const aiCompanies = new Set(['openai', 'anthropic', 'databricks', 'palantir']);
const groupNames = { 'big-tech': 'Big tech', quant: 'Quant', gaming: 'Gaming', ai: 'AI' };

const statusNames = {
  healthy: 'Coverage verified',
  partial: 'Partial coverage',
  stale: 'Refresh overdue',
  blocked: 'Refresh failed',
  not_onboarded: 'Not connected',
  demo: 'Sample source',
};

function groupOf(slug: string) {
  return financialCompanies.has(slug)
    ? 'quant'
    : gamingCompanies.has(slug)
      ? 'gaming'
      : aiCompanies.has(slug)
        ? 'ai'
        : 'big-tech';
}

export function CompanyDirectory({
  companies,
  loading,
  error,
  mode,
  search,
  onSearch,
  onOpenJobs,
}: {
  companies: Company[];
  loading: boolean;
  error: string | null;
  mode: 'demo' | 'postgres' | null;
  search: string;
  onSearch: (value: string) => void;
  onOpenJobs: (slug: string) => void;
}) {
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [listingsFilter, setListingsFilter] = useState('');
  const [sort, setSort] = useState('directory');

  const filtered = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!groupFilter || groupOf(company.slug) === groupFilter) &&
      (!statusFilter || company.status === statusFilter) &&
      (!listingsFilter || (listingsFilter === 'with' ? company.jobs > 0 : company.jobs === 0)),
  );

  if (sort !== 'directory') {
    filtered.sort(
      (a, b) => (sort === 'listings' ? b.jobs - a.jobs : 0) || a.name.localeCompare(b.name),
    );
  }

  const hasFilters = !!(
    search ||
    groupFilter ||
    statusFilter ||
    listingsFilter ||
    sort !== 'directory'
  );

  const clear = () => {
    onSearch('');
    setGroupFilter('');
    setStatusFilter('');
    setListingsFilter('');
    setSort('directory');
  };

  const groups = Object.entries(groupNames).map(([id, name]) => ({
    id,
    name,
    companies: filtered.filter((company) => groupOf(company.slug) === id),
  }));

  return (
    <section className="companies-section">
      <div className="section-heading">
        <h2>
          Company directory{' '}
          <span>
            {loading && companies.length === 0 ? '…' : `${filtered.length} of ${companies.length}`}
          </span>
        </h2>
        {hasFilters && (
          <button
            className="clear-button"
            onClick={clear}
          >
            Clear filters <X size={13} />
          </button>
        )}
      </div>
      <div className="search-controls directory-controls">
        <label className="search-input">
          <Search size={16} />
          <input
            aria-label="Find a company"
            placeholder="Find a company"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <div className="filter-row directory-filter-row">
          <label className="filter-field">
            <span>Group</span>
            <GlassSelect
              aria-label="Filter company group"
              value={groupFilter}
              onValueChange={setGroupFilter}
            >
              <option value="">All groups</option>
              {Object.entries(groupNames).map(([value, name]) => (
                <option
                  key={value}
                  value={value}
                >
                  {name}
                </option>
              ))}
            </GlassSelect>
          </label>
          <label className="filter-field">
            <span>Source status</span>
            <GlassSelect
              aria-label="Filter company source status"
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <option value="">All source statuses</option>
              {Object.entries(statusNames).map(([value, name]) => (
                <option
                  key={value}
                  value={value}
                >
                  {name}
                </option>
              ))}
            </GlassSelect>
          </label>
          <label className="filter-field">
            <span>{mode === 'demo' ? 'Sample listings' : 'Stored listings'}</span>
            <GlassSelect
              aria-label="Filter company listings"
              value={listingsFilter}
              onValueChange={setListingsFilter}
            >
              <option value="">All companies</option>
              <option value="with">With listings</option>
              <option value="without">Without listings</option>
            </GlassSelect>
          </label>
          <label className="filter-field">
            <span>Sort within groups</span>
            <GlassSelect
              aria-label="Sort companies"
              value={sort}
              onValueChange={setSort}
            >
              <option value="directory">Directory order</option>
              <option value="name">Name A–Z</option>
              <option value="listings">Most listings</option>
            </GlassSelect>
          </label>
        </div>
      </div>
      {loading && companies.length === 0 && (
        <LoadingSkeleton
          kind="companies"
          label="Loading companies…"
          count={8}
        />
      )}
      {groups
        .filter((group) => group.companies.length > 0)
        .map((group) => (
          <section
            className="company-directory-group"
            aria-labelledby={group.id}
            key={group.id}
          >
            <h3
              className="company-group-heading"
              id={group.id}
            >
              {group.name} <span>{group.companies.length}</span>
            </h3>
            <div
              className="company-grid"
              aria-busy={loading}
            >
              {group.companies.map((company, index) => (
                <article
                  className="company-card"
                  key={company.slug}
                  style={{ '--card-delay': `${Math.min(index, 12) * 28}ms` } as CSSProperties}
                  onPointerMove={moveSurface}
                  onPointerLeave={resetSurface}
                >
                  <div className="company-card-top">
                    <a
                      className="company-logo-link"
                      href={company.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${company.name} careers via logo`}
                    >
                      <CompanyLogo
                        name={company.name}
                        logoUrl={company.logoUrl}
                      />
                    </a>
                    <a
                      href={company.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${company.name} careers`}
                    >
                      <ArrowUpRight size={18} />
                    </a>
                  </div>
                  <div className="company-card-name">
                    <h4>{company.name}</h4>
                    <CoverageStatus company={company} />
                  </div>
                  <div className="company-card-bottom">
                    <span>
                      <strong>{company.jobs.toLocaleString()}</strong>{' '}
                      {mode === 'demo' ? 'examples' : 'listings'}
                    </span>
                    <button
                      aria-label={`View ${company.name} jobs`}
                      onClick={() => onOpenJobs(company.slug)}
                    >
                      View jobs <ArrowUpRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>No companies match these filters.</p>
          <button
            className="clear-button"
            onClick={clear}
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
