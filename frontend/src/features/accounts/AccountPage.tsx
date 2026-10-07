import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { Account } from '../../api/accounts.js';
import type { AccountAction } from './AccountMenu.js';
import { AccountActivity } from './AccountActivity.js';
import { AccountBilling } from './AccountBilling.js';
import { AccountPreferences, ResumeLibrary } from './AccountMocks.js';
import './account-page.css';

const sections = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, preview: false },
  { key: 'details', label: 'Your details', icon: UserRound, preview: false },
  { key: 'billing', label: 'Plan & billing', icon: CreditCard, preview: false },
  { key: 'resume', label: 'Your resume', icon: FileText, preview: true },
  { key: 'preferences', label: 'Preferences', icon: Bell, preview: true },
] as const;

export function AccountPage({
  account,
  error,
  notice,
  busy,
  section,
  onSection,
  onAction,
  onSignIn,
  onPricing,
}: {
  account: Account | null | undefined;
  error: string;
  notice: string;
  busy: boolean;
  section: string | null;
  onSection: (section: string) => void;
  onAction: (action: AccountAction) => void;
  onSignIn: () => void;
  onPricing: () => void;
}) {
  const active = sections.find((item) => item.key === section) ?? sections[0];
  const user = account?.user;

  if (!user) {
    return (
      <section className="account-page account-gate">
        <span className="dashboard-feature-icon">
          <UserRound size={26} />
        </span>
        <h1>Your next chapter, organized.</h1>
        {account === undefined && !error ? (
          <p role="status">Loading your account…</p>
        ) : error ? (
          <>
            <p
              className="account-error"
              role="alert"
            >
              {error}
            </p>
            <button
              className="primary-button"
              onClick={() => onAction('refresh')}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <p>One space for your details, your plan and what comes next.</p>
            <button
              className="primary-button"
              onClick={onSignIn}
            >
              Sign in to your space <ArrowRight size={16} />
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="account-page">
      <div className="account-page-layout">
        <aside className="account-sidebar">
          <div className="account-sidebar-identity">
            <span className="account-avatar">{(user.email?.[0] ?? 'J').toUpperCase()}</span>
            <div>
              <strong>Your workspace</strong>
              <span>{user.email ?? 'Connected account'}</span>
            </div>
          </div>
          <span className="account-sidebar-label">Account</span>
          <nav aria-label="Account sections">
            {sections.map(({ key, label, icon: Icon, preview }) => (
              <button
                key={key}
                aria-current={active.key === key ? 'page' : undefined}
                onClick={() => onSection(key)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {preview && <span className="sidebar-preview">Demo</span>}
              </button>
            ))}
          </nav>
          <div className="account-sidebar-bottom">
            <div className="sidebar-plan-note">
              <Sparkles size={18} />
              <strong>A little more possibility.</strong>
              <p>Find your rhythm with Pro.</p>
              <button onClick={onPricing}>
                Explore the plans <ArrowUpRight size={14} />
              </button>
            </div>
            <button
              className="account-signout"
              disabled={busy}
              onClick={() => onAction('signout')}
            >
              <LogOut size={17} />
              {busy ? 'Please wait…' : 'Sign out'}
            </button>
          </div>
        </aside>
        <div className="account-page-content">
          <div className="account-page-heading">
            <div>
              <span className="account-breadcrumb">
                Your account <span>/</span> {active.label}
              </span>
              <h1>
                {active.key === 'overview'
                  ? 'Your next chapter, organized.'
                  : active.key === 'details'
                    ? 'The details that make it yours.'
                    : active.key === 'billing'
                      ? 'A plan for what comes next.'
                      : active.key === 'resume'
                        ? 'Your story. Ready to go.'
                        : 'On your terms.'}
              </h1>
              <p>
                {active.key === 'overview'
                  ? 'A little clarity, a little momentum. All in your own space.'
                  : active.key === 'details'
                    ? 'Manage your account and keep your sign-in details up to date.'
                    : active.key === 'billing'
                      ? 'Your subscription, payment details and billing history.'
                      : active.key === 'resume'
                        ? 'A preview of a simpler way to keep your resume close.'
                        : 'A preview of how Jobbely could keep you in the loop.'}
              </p>
            </div>
            <span className="account-member-badge">
              <ShieldCheck size={14} />
              Basic member
            </span>
          </div>
          {error && (
            <p
              className="account-error"
              role="alert"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              className="dashboard-feedback"
              role="status"
            >
              {notice}
            </p>
          )}
          <div
            key={active.key}
            className="account-section-content"
          >
            {active.key === 'overview' ? (
              <>
                <AccountActivity />
                <div className="overview-bottom-grid">
                  <section className="dashboard-plan-card">
                    <div>
                      <span className="plan-eyebrow">Your current plan</span>
                      <h2>
                        Basic<span>Free</span>
                      </h2>
                      <p>All the essentials for a clearer next step.</p>
                    </div>
                    <button
                      className="dashboard-button"
                      onClick={() => onSection('billing')}
                    >
                      View your plan <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="dashboard-panel overview-details">
                    <span className="dashboard-feature-icon">
                      <UserRound size={20} />
                    </span>
                    <div>
                      <h2>Make yourself at home.</h2>
                      <p>{user.email ?? 'Your connected account'}</p>
                    </div>
                    <button
                      className="dashboard-text-button"
                      onClick={() => onSection('details')}
                    >
                      Manage your details <ArrowRight size={14} />
                    </button>
                  </section>
                </div>
              </>
            ) : active.key === 'details' ? (
              <>
                <section className="dashboard-panel account-personal-details">
                  <div className="dashboard-panel-heading">
                    <div>
                      <h2>Your sign-in details</h2>
                      <p>A secure home for your account.</p>
                    </div>
                    <ShieldCheck size={20} />
                  </div>
                  <div className="dashboard-detail-row">
                    <span className="dashboard-feature-icon">
                      <Mail size={19} />
                    </span>
                    <div>
                      <span>Email address</span>
                      <strong>{user.email ?? 'No email supplied by your sign-in provider'}</strong>
                    </div>
                    {user.hasPassword && (
                      <button
                        className="dashboard-button"
                        disabled={busy}
                        onClick={() => onAction('email')}
                      >
                        Change email
                      </button>
                    )}
                  </div>
                  <div className="dashboard-detail-row">
                    <span className="dashboard-feature-icon">
                      <ShieldCheck size={19} />
                    </span>
                    <div>
                      <span>Password</span>
                      <strong aria-label={user.hasPassword ? 'Password is hidden' : undefined}>
                        {user.hasPassword ? '••••••••' : 'Managed by your sign-in provider'}
                      </strong>
                    </div>
                    {user.hasPassword && (
                      <button
                        className="dashboard-button"
                        disabled={busy}
                        onClick={() => onAction('reset')}
                      >
                        Reset password
                      </button>
                    )}
                  </div>
                  <p className="dashboard-muted-note">
                    {user.hasPassword
                      ? 'Email changes require your current password and a confirmation code. A password reset signs out your existing sessions.'
                      : 'Your sign-in credentials are managed by your connected provider.'}
                  </p>
                </section>
                <section className="dashboard-panel account-danger-zone">
                  <div>
                    <h2>Close this chapter.</h2>
                    <p>
                      Deleting your account permanently removes your sign-in details and clears your
                      resume from this tab.
                    </p>
                  </div>
                  <button
                    className="account-danger-button"
                    disabled={busy}
                    onClick={() => onAction('delete')}
                  >
                    Delete account
                  </button>
                </section>
              </>
            ) : active.key === 'billing' ? (
              <AccountBilling
                accountKey={user.id}
                onPricing={onPricing}
              />
            ) : active.key === 'resume' ? (
              <ResumeLibrary />
            ) : (
              <AccountPreferences />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
