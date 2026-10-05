import { ArrowUpRight, Search } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo.js';
import { CoverageStatus } from './CoverageStatus.js';
import { LoadingSkeleton } from './LoadingSkeleton.js';
import type { Company } from '../api/client.js';

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
  const filtered = companies.filter((company) =>
    company.name.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = [
    {
      name: 'Big tech',
      id: 'big-tech',
      companies: filtered.filter(
        (company) =>
          !financialCompanies.has(company.slug) &&
          !gamingCompanies.has(company.slug) &&
          !aiCompanies.has(company.slug),
      ),
    },
    {
      name: 'Quant',
      id: 'quant',
      companies: filtered.filter((company) => financialCompanies.has(company.slug)),
    },
    {
      name: 'Gaming',
      id: 'gaming',
      companies: filtered.filter((company) => gamingCompanies.has(company.slug)),
    },
    {
      name: 'AI',
      id: 'ai',
      companies: filtered.filter((company) => aiCompanies.has(company.slug)),
    },
  ];

  return (
    <section className="companies-section">
      <div className="section-heading">
        <h2>
          Company directory{' '}
          <span>{loading && companies.length === 0 ? '…' : companies.length}</span>
        </h2>
        <label className="directory-search">
          <Search size={16} />
          <input
            aria-label="Find a company"
            placeholder="Find a company"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
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
              {group.companies.map((company) => (
                <article
                  className="company-card"
                  key={company.slug}
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
        <div className="empty-state">No companies match this search.</div>
      )}
    </section>
  );
}
