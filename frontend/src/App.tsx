import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { JobsQuery } from './api/client.js';
import { useLocationQuery } from './hooks/useLocationQuery.js';
import { useJobCatalog } from './hooks/useJobCatalog.js';
import { useJobDetail } from './hooks/useJobDetail.js';
import { CompanyLogo } from './components/CompanyLogo.js';

function relativeDate(value: string) {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 3_600_000));

  return hours < 1 ? 'just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

const workplaceNames = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: 'Not specified',
};

const coverageNames = {
  not_onboarded: 'Not connected',
  partial: 'Awaiting source audit',
  stale: 'Refresh overdue',
  blocked: 'Refresh failed',
  healthy: 'Up to date',
  demo: 'Demo source',
};

export function App() {
  const { params, update } = useLocationQuery();
  const view = params.get('view') === 'companies' ? 'companies' : 'jobs';
  const selectedId = params.get('job');

  const [queryInput, setQueryInput] = useState(params.get('q') ?? '');
  const [companySearch, setCompanySearch] = useState('');

  const q = params.get('q');
  const companyFilter = params.get('company');
  const categoryFilter = params.get('category');
  const workplaceFilter = params.get('workplace');

  const query: JobsQuery = useMemo(() => {
    const result: JobsQuery = { limit: 20 };

    if (q) {
      result.q = q;
    }

    if (companyFilter) {
      result.company = companyFilter;
    }

    if (categoryFilter) {
      result.category = categoryFilter;
    }

    if (workplaceFilter) {
      result.workplace = workplaceFilter;
    }

    return result;
    // Only filters affect the request, not navigation between a listing and its details.
  }, [q, companyFilter, categoryFilter, workplaceFilter]);

  useEffect(() => {
    setQueryInput(params.get('q') ?? '');
  }, [params]);

  const {
    companies,
    categories,
    jobs,
    total,
    nextCursor,
    mode,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
  } = useJobCatalog(query);

  const { selected, detailError } = useJobDetail(selectedId);

  const nameOf = (slug: string) => companies.find((company) => company.slug === slug)?.name ?? slug;

  const logoOf = (slug: string) => companies.find((company) => company.slug === slug)?.logoUrl;

  const categoryOf = (slug: string) =>
    categories.find((category) => category.slug === slug)?.name ?? slug;

  const connected = companies.filter((company) => company.sources.length).length;

  const clear = () => {
    setQueryInput('');

    update({
      q: null,
      company: null,
      category: null,
      workplace: null,
      job: null,
    });
  };

  return (
    <div className="app-shell">
      <header className="header">
        <a
          className="brand"
          href="/"
          aria-label="Jobbely home"
        >
          <span className="brand-icon">
            <BriefcaseBusiness
              size={20}
              strokeWidth={2.2}
            />
          </span>
          jobbely<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === 'jobs' ? 'nav-link active' : 'nav-link'}
            onClick={() => update({ view: null, job: null })}
          >
            Browse jobs
          </button>
          <button
            className={view === 'companies' ? 'nav-link active' : 'nav-link'}
            onClick={() => update({ view: 'companies', job: null })}
          >
            Companies <span className="nav-count">60</span>
          </button>
        </nav>
        <span className="header-note">
          <span className="status-dot" /> Direct from the source
        </span>
      </header>
      <main>
        {mode === 'demo' && (
          <div className="demo-banner">
            <CircleHelp size={15} />
            <span>
              Preview mode · All listings below are synthetic examples. Live source coverage has not
              been verified.
            </span>
          </div>
        )}
        {!selectedId && (
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span className="short-line" /> A clearer view of what’s next
              </div>
              <h1>
                {view === 'jobs' ? (
                  <>
                    Good work starts
                    <br />
                    with the right <span>opportunity.</span>
                  </>
                ) : (
                  <>
                    The companies.
                    <br />
                    <span>The original source.</span>
                  </>
                )}
              </h1>
              <p>
                {view === 'jobs'
                  ? 'Explore opportunities from the companies you care about. Full descriptions, original teams, and a clear view of every source.'
                  : 'Every target company, in one place. See which sources are connected and exactly where coverage stands.'}
              </p>
            </div>
            <aside className="hero-aside">
              <div className="large-metric">
                60<span>companies on our radar</span>
              </div>
              <div className="hero-aside-bottom">
                <span>{connected} configured companies</span>
                <ArrowDown size={17} />
              </div>
            </aside>
          </section>
        )}
        {error && (
          <div
            className="error-state"
            role="alert"
          >
            {error}
            <button onClick={refresh}>Try again</button>
          </div>
        )}
        {selectedId ? (
          <section className="detail-section">
            <button
              className="back-button"
              onClick={() => update({ job: null })}
            >
              <ArrowLeft size={16} /> Back to opportunities
            </button>
            {detailError ? (
              <div
                className="empty-state"
                role="alert"
              >
                {detailError}
              </div>
            ) : !selected ? (
              <div
                className="empty-state"
                role="status"
              >
                Loading the full description…
              </div>
            ) : (
              <>
                <div className="detail-heading">
                  <CompanyLogo
                    name={nameOf(selected.companySlug)}
                    logoUrl={logoOf(selected.companySlug)}
                  />
                  <div>
                    <div className="company-label">{nameOf(selected.companySlug)}</div>
                    <h1>{selected.title}</h1>
                    <div className="job-meta">
                      <span>
                        <MapPin size={14} />
                        {selected.locations.join(' · ') || 'Location not specified'}
                      </span>
                      <span>{workplaceNames[selected.workplace]}</span>
                    </div>
                  </div>
                </div>
                <div className="detail-grid">
                  <article
                    className="description"
                    dangerouslySetInnerHTML={{
                      __html: selected.descriptionHtml,
                    }}
                  />
                  <aside className="detail-sidebar">
                    <div className="sidebar-eyebrow">At a glance</div>
                    <dl>
                      <dt>Function</dt>
                      <dd>{categoryOf(selected.classification.category)}</dd>
                      <dt>Company department</dt>
                      <dd>{selected.departments.join(' / ') || 'Not provided'}</dd>
                      <dt>Employment</dt>
                      <dd>
                        {selected.employment === 'unknown' ? 'Not specified' : selected.employment}
                      </dd>
                      <dt>First seen</dt>
                      <dd>{new Date(selected.firstSeenAt).toLocaleDateString()}</dd>
                      <dt>Last checked</dt>
                      <dd>{relativeDate(selected.lastSeenAt)}</dd>
                    </dl>
                    {mode !== 'postgres' ? (
                      <p className="small-note">
                        This example is not an active vacancy. Visit the company’s careers page to
                        explore real opportunities.
                      </p>
                    ) : selected.status === 'closed' ? (
                      <p className="small-note">
                        This vacancy is closed. Check the original posting for current availability.
                      </p>
                    ) : (
                      <a
                        className="primary-button"
                        href={selected.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Apply on company site <ArrowUpRight size={16} />
                      </a>
                    )}
                    <a
                      className="source-link"
                      href={
                        mode === 'demo'
                          ? companies.find((company) => company.slug === selected.companySlug)
                              ?.careersUrl
                          : selected.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {mode === 'demo' ? 'Visit company careers' : 'View original posting'}
                      <ArrowUpRight size={14} />
                    </a>
                    {selected.missingSince && (
                      <p className="small-note">
                        This vacancy is awaiting availability confirmation.
                      </p>
                    )}
                  </aside>
                </div>
              </>
            )}
          </section>
        ) : view === 'companies' ? (
          <section className="companies-section">
            <div className="section-heading">
              <h2>
                Company directory <span>{companies.length}</span>
              </h2>
              <label className="directory-search">
                <Search size={16} />
                <input
                  aria-label="Find a company"
                  placeholder="Find a company"
                  value={companySearch}
                  onChange={(event) => setCompanySearch(event.target.value)}
                />
              </label>
            </div>
            <div className="company-grid">
              {companies
                .filter((company) =>
                  company.name.toLowerCase().includes(companySearch.toLowerCase()),
                )
                .map((company) => (
                  <article
                    className="company-card"
                    key={company.slug}
                  >
                    <div className="company-card-top">
                      <CompanyLogo
                        name={company.name}
                        logoUrl={company.logoUrl}
                      />
                      <a
                        href={company.careersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit ${company.name} careers`}
                      >
                        <ArrowUpRight size={18} />
                      </a>
                    </div>
                    <h3>{company.name}</h3>
                    <span className={`coverage-badge coverage-${company.status}`}>
                      <span className="status-dot" />
                      {coverageNames[company.status]}
                    </span>
                    <div className="company-card-bottom">
                      <span>
                        {company.jobs} {mode === 'demo' ? 'examples' : 'listings'}
                      </span>
                      <button
                        onClick={() =>
                          update({
                            view: null,
                            company: company.slug,
                            job: null,
                          })
                        }
                      >
                        Explore <ChevronRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            {!loading &&
              companies.filter((company) =>
                company.name.toLowerCase().includes(companySearch.toLowerCase()),
              ).length === 0 && <div className="empty-state">No companies match this search.</div>}
          </section>
        ) : (
          <section className="browse-section">
            <div className="search-bar">
              <label className="search-input">
                <Search size={20} />
                <input
                  aria-label="Search job titles, descriptions, or locations"
                  placeholder="Job title, keyword, or location"
                  value={queryInput}
                  onChange={(event) => {
                    setQueryInput(event.target.value);
                    update({ q: event.target.value || null }, true);
                  }}
                />
              </label>
              <div className="search-divider" />
              <SlidersHorizontal
                size={17}
                className="filter-icon"
              />
              <select
                aria-label="Filter by company"
                value={params.get('company') ?? ''}
                onChange={(event) => update({ company: event.target.value || null })}
              >
                <option value="">All companies</option>
                {companies.map((company) => (
                  <option
                    key={company.slug}
                    value={company.slug}
                  >
                    {company.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by function"
                value={params.get('category') ?? ''}
                onChange={(event) => update({ category: event.target.value || null })}
              >
                <option value="">All functions</option>
                {categories.map((category) => (
                  <option
                    key={category.slug}
                    value={category.slug}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by workplace"
                value={params.get('workplace') ?? ''}
                onChange={(event) => update({ workplace: event.target.value || null })}
              >
                <option value="">Any workplace</option>
                {Object.entries(workplaceNames).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="results-heading">
              <h2>
                {loading
                  ? 'Finding opportunities…'
                  : `${total} ${mode === 'demo' ? 'sample opportunities' : 'opportunities'}`}
                <span>
                  {params.get('company')
                    ? `at ${nameOf(params.get('company')!)}`
                    : 'across our sources'}
                </span>
              </h2>
              {Object.keys(query).length > 1 ? (
                <button
                  className="clear-button"
                  onClick={clear}
                >
                  Clear filters <X size={13} />
                </button>
              ) : (
                <span className="sort-note">
                  <Clock3 size={13} /> Most recently checked
                </span>
              )}
            </div>
            <div
              className="job-list"
              aria-busy={loading}
            >
              {loading && jobs.length === 0 ? (
                <div
                  className="empty-state"
                  role="status"
                >
                  Loading opportunities…
                </div>
              ) : (
                jobs.map((job) => (
                  <button
                    className="job-row"
                    disabled={loading}
                    key={job.id}
                    onClick={() => update({ job: job.id })}
                  >
                    <CompanyLogo
                      name={nameOf(job.companySlug)}
                      logoUrl={logoOf(job.companySlug)}
                    />
                    <div className="job-main">
                      <div className="company-label">
                        {nameOf(job.companySlug)}
                        <span className="meta-dot">·</span>
                        <span className="source-department">
                          {job.departments.at(-1) || categoryOf(job.classification.category)}
                        </span>
                      </div>
                      <h3>{job.title}</h3>
                      <div className="job-meta">
                        <span>
                          <MapPin size={13} />
                          {job.locations.join(' · ') || 'Location not specified'}
                        </span>
                        <span className="meta-dot">·</span>
                        <span>{workplaceNames[job.workplace]}</span>
                      </div>
                    </div>
                    <div className="job-end">
                      <span className="function-tag">
                        {categoryOf(job.classification.category)}
                      </span>
                      <span className="checked-label">
                        {mode === 'demo'
                          ? 'Sample listing'
                          : `Checked ${relativeDate(job.lastSeenAt)}`}
                      </span>
                    </div>
                    <span className="row-arrow">
                      <ArrowUpRight size={19} />
                    </span>
                  </button>
                ))
              )}
            </div>
            {!loading && !error && total === 0 && (
              <div className="empty-state">
                <Search size={25} />
                <h3>No matching opportunities yet.</h3>
                <p>Try fewer filters, or check the company directory for source coverage.</p>
                <button
                  className="back-button"
                  onClick={clear}
                >
                  Reset filters
                </button>
              </div>
            )}
            {nextCursor && (
              <button
                className="load-more"
                disabled={loading || loadingMore}
                onClick={() => {
                  void loadMore();
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more opportunities'}
                <ArrowDown size={15} />
              </button>
            )}
            <div className="source-note">
              <Check size={15} />
              <p>
                Original company information. Clear source coverage.{' '}
                <button onClick={() => update({ view: 'companies' })}>
                  See the directory <ArrowUpRight size={12} />
                </button>
              </p>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span className="footer-brand">jobbely.</span>
        <span>A little less searching. A little more possibility.</span>
        <span>
          {mode === 'demo'
            ? 'Synthetic preview · no live extraction'
            : mode === 'postgres'
              ? 'Public employer listings · no AI'
              : 'Connecting to stored listings…'}
        </span>
      </footer>
    </div>
  );
}
