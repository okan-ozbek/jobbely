import { scrollToSection } from './components/motion.js';
import { CompanyDirectory } from './components/CompanyDirectory.js';
import { LoadingSkeleton } from './components/LoadingSkeleton.js';
import { GlassSelect } from './components/GlassSelect.js';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, CircleHelp, MapPin, Search, X } from 'lucide-react';
import type { JobsQuery, ResumeAnalysis } from './api/client.js';
import { useLocationQuery } from './hooks/useLocationQuery.js';
import { useJobCatalog } from './hooks/useJobCatalog.js';
import { useJobDetail } from './hooks/useJobDetail.js';
import { CompanyLogo } from './components/CompanyLogo.js';
import { ResumeWorkbench } from './features/resume/ResumeWorkbench.js';
import { useResumeAnalysis } from './features/resume/useResumeAnalysis.js';
import { JobProfileComparison } from './features/resume/JobProfileComparison.js';

function relativeDate(value: string) {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 3_600_000));

  return hours < 1 ? 'just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

const workplaceNames = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: 'Work arrangement not listed',
};

export function App() {
  const { params, update } = useLocationQuery();
  const resumeState = useResumeAnalysis();
  const [reviewedAnalysis, setReviewedAnalysis] = useState<ResumeAnalysis | null>(null);

  const comparisonAnalysis =
    reviewedAnalysis === resumeState.analysis && !resumeState.loading && !resumeState.error
      ? reviewedAnalysis
      : null;

  const view =
    params.get('view') === 'resume'
      ? 'resume'
      : params.get('view') === 'companies'
        ? 'companies'
        : params.get('view') === 'jobs' || params.has('job') || params.has('company')
          ? 'jobs'
          : 'resume';

  const selectedId = view === 'resume' ? null : params.get('job');

  const [queryInput, setQueryInput] = useState(params.get('q') ?? '');
  const [companySearch, setCompanySearch] = useState('');

  const q = params.get('q');
  const companyFilter = params.get('company');
  const categoryFilter = params.get('category');
  const workplaceFilter = params.get('workplace');
  const countryFilter = params.get('country');
  const cityFilter = params.get('city');

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

    if (countryFilter) {
      result.country = countryFilter;
    }

    if (cityFilter) {
      result.city = cityFilter;
    }

    return result;
    // Only filters affect the request, not navigation between a listing and its details.
  }, [q, companyFilter, categoryFilter, workplaceFilter, countryFilter, cityFilter]);

  useEffect(() => {
    setQueryInput(params.get('q') ?? '');
  }, [params]);

  const {
    companies,
    categories,
    locations,
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

  const clear = () => {
    setQueryInput('');

    update({
      q: null,
      company: null,
      category: null,
      workplace: null,
      country: null,
      city: null,
      job: null,
    });
  };

  return (
    <div className={`app-shell view-${view}`}>
      <div
        className="ambient-light"
        aria-hidden="true"
      />
      <a
        className="skip-link"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="header">
        <a
          className="brand"
          href="/"
          aria-label="Jobbely home"
          onClick={(event) => {
            event.preventDefault();
            update({ view: 'resume', job: null, company: null, from: null });
          }}
        >
          jobbely<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === 'companies' ? 'nav-link active' : 'nav-link'}
            aria-current={view === 'companies' ? 'page' : undefined}
            onClick={() => update({ view: 'companies', job: null, from: null })}
          >
            Companies
          </button>
        </nav>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
      >
        {mode === 'demo' && view !== 'resume' && (
          <div className="demo-banner">
            <CircleHelp size={15} />
            <span>Preview mode. These are sample listings, not active vacancies.</span>
          </div>
        )}
        {!selectedId && view !== 'resume' && (
          <section className="hero">
            <div className="hero-title">
              <h1>
                {view === 'jobs' ? (
                  <>
                    Find your
                    <br />
                    <span>next role.</span>
                  </>
                ) : (
                  <>
                    Your next chapter.
                    <br />
                    <span>Great company.</span>
                  </>
                )}
              </h1>
            </div>
            <p>
              {view === 'jobs'
                ? 'Explore roles from the companies you care about. Direct from their job boards.'
                : 'Explore the companies on Jobbely. Every role leads back to the original job site.'}
            </p>
          </section>
        )}
        {error && view !== 'resume' && (
          <div
            className="error-state"
            role="alert"
          >
            {error}
            <button onClick={refresh}>Try again</button>
          </div>
        )}
        <div hidden={view !== 'resume'}>
          {view === 'resume' && params.get('job') && (
            <button
              className="back-button"
              disabled={!comparisonAnalysis}
              onClick={() => update({ view: 'jobs' })}
            >
              Return to this job
            </button>
          )}
          <ResumeWorkbench
            state={resumeState}
            onReviewed={setReviewedAnalysis}
            openJob={(id) => update({ view: 'jobs', job: id, from: 'resume' })}
          />
        </div>
        {view === 'resume' ? null : selectedId ? (
          <section className="detail-section">
            <button
              className="back-button"
              onClick={() => {
                const returnToResume = params.get('from') === 'resume';

                update({ view: returnToResume ? 'resume' : 'jobs', job: null, from: null });

                if (returnToResume) {
                  requestAnimationFrame(() => {
                    const matches = document.querySelector<HTMLElement>('.matches-anchor');

                    if (matches) {
                      scrollToSection(matches);
                    }
                  });
                }
              }}
            >
              <ArrowLeft size={16} />{' '}
              {params.get('from') === 'resume' ? 'Back to resume' : 'Back to jobs'}
            </button>
            {detailError ? (
              <div
                className="empty-state"
                role="alert"
              >
                {detailError}
              </div>
            ) : !selected ? (
              <LoadingSkeleton
                kind="detail"
                label="Loading the full description…"
              />
            ) : (
              <>
                <div className="detail-heading">
                  <CompanyLogo
                    name={nameOf(selected.companySlug)}
                    logoUrl={logoOf(selected.companySlug)}
                  />
                  <div>
                    <div className="company-label">
                      {nameOf(selected.companySlug)}
                      {selected.status === 'closed' && <span className="closed-label">Closed</span>}
                    </div>
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
                  <JobProfileComparison
                    job={selected}
                    analysis={comparisonAnalysis}
                    reviewResume={() => update({ view: 'resume' })}
                  />
                  <aside className="detail-sidebar">
                    <h2 className="sidebar-heading">The details</h2>
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
                    {mode === 'demo' ? (
                      <p className="small-note">
                        This example is not an active vacancy. Visit the company’s careers page to
                        explore real opportunities.
                      </p>
                    ) : mode !== 'postgres' ? (
                      <p className="small-note">
                        Availability could not be confirmed. Check the original posting.
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
          <CompanyDirectory
            companies={companies}
            loading={loading}
            error={error}
            mode={mode}
            search={companySearch}
            onSearch={setCompanySearch}
            onOpenJobs={(slug) => update({ view: 'jobs', company: slug, job: null, from: null })}
          />
        ) : (
          <section className="browse-section">
            <div className="search-controls">
              <div className="search-bar">
                <label className="search-input">
                  <Search size={20} />
                  <input
                    aria-label="Search job titles, descriptions, or locations"
                    placeholder="Role, keyword or location"
                    value={queryInput}
                    onChange={(event) => {
                      setQueryInput(event.target.value);
                      update({ q: event.target.value || null }, true);
                    }}
                  />
                </label>
              </div>
              <div className="filter-row">
                <label className="filter-field">
                  <span>Company</span>
                  <GlassSelect
                    disabled={loading}
                    aria-label="Filter by company"
                    value={params.get('company') ?? ''}
                    onValueChange={(value) => update({ company: value || null })}
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
                  </GlassSelect>
                </label>
                <label className="filter-field">
                  <span>Function</span>
                  <GlassSelect
                    disabled={loading}
                    aria-label="Filter by function"
                    value={params.get('category') ?? ''}
                    onValueChange={(value) => update({ category: value || null })}
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
                  </GlassSelect>
                </label>
                <label className="filter-field">
                  <span>Workplace</span>
                  <GlassSelect
                    disabled={loading}
                    aria-label="Filter by workplace"
                    value={params.get('workplace') ?? ''}
                    onValueChange={(value) => update({ workplace: value || null })}
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
                  </GlassSelect>
                </label>
                <label className="filter-field">
                  <span>Country</span>
                  <GlassSelect
                    disabled={loading}
                    aria-label="Filter by country"
                    value={countryFilter ?? ''}
                    onValueChange={(value) => update({ country: value || null, city: null })}
                  >
                    <option value="">All countries</option>
                    {locations.countries.map((country) => (
                      <option
                        key={country.value}
                        value={country.value}
                      >
                        {country.name}
                      </option>
                    ))}
                  </GlassSelect>
                </label>
                <label className="filter-field">
                  <span>City</span>
                  <GlassSelect
                    disabled={loading}
                    aria-label="Filter by city"
                    value={cityFilter ?? ''}
                    onValueChange={(value) => update({ city: value || null })}
                  >
                    <option value="">All cities</option>
                    {locations.cities.map((city) => (
                      <option
                        key={city.value}
                        value={city.value}
                      >
                        {city.value}
                      </option>
                    ))}
                  </GlassSelect>
                </label>
              </div>
            </div>
            <div className="results-heading">
              <h2>
                {loading
                  ? 'Finding jobs…'
                  : `${total.toLocaleString()} ${mode === 'demo' ? 'sample jobs' : total === 1 ? 'job' : 'jobs'}`}
                <span>
                  {params.get('company')
                    ? `at ${nameOf(params.get('company')!)}`
                    : 'from company sources'}
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
                <span className="sort-note">Recently checked</span>
              )}
            </div>
            <div
              className="job-list"
              aria-busy={loading}
            >
              {loading ? (
                <LoadingSkeleton
                  kind="jobs"
                  label="Loading jobs…"
                  count={5}
                />
              ) : (
                jobs.map((job) => (
                  <button
                    className="job-row"
                    disabled={loading}
                    key={job.id}
                    onClick={() => update({ job: job.id, from: 'jobs' })}
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
            {loadingMore && (
              <LoadingSkeleton
                kind="jobs"
                label="Loading more jobs…"
                count={2}
              />
            )}
            {!loading && !error && total === 0 && (
              <div className="empty-state">
                <Search size={25} />
                <h3>No matching jobs.</h3>
                <p>Try fewer filters, or check the company directory for source coverage.</p>
                <button
                  className="back-button"
                  onClick={clear}
                >
                  Clear filters
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
                {loadingMore ? 'Loading…' : 'Load more jobs'}
                <ArrowDown size={15} />
              </button>
            )}
          </section>
        )}
      </main>
      <footer>
        <span className="footer-brand">
          jobbely<span>.</span>
        </span>
        <span>
          {mode === 'demo'
            ? 'Sample listings · preview mode'
            : mode === 'postgres'
              ? 'Original listings. Direct sources.'
              : 'Connecting to company sources…'}
        </span>
      </footer>
    </div>
  );
}
