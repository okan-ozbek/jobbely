import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { Account, SignInProvider } from '../../api/accounts.js';
import {
  currentAccount,
  deleteAccount,
  signInProviders,
  signOut,
  startSignIn,
} from '../../api/accounts.js';
import { ApiError } from '../../api/client.js';
import './accounts.css';
import { EmailAccountForm } from './EmailAccountForm.js';
import { AccountEmailChangeForm } from './AccountEmailChangeForm.js';
import { PricingPlans } from './PricingPlans.js';

const names = { github: 'GitHub', linkedin: 'LinkedIn' };

export function AccountMenu({
  onSessionEnd,
  onDeleted,
  openRequest = 0,
  onAccountChange,
}: {
  onSessionEnd: () => void;
  onDeleted: () => void;
  openRequest?: number;
  onAccountChange?: (userId: string | null) => void;
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [providers, setProviders] = useState<{ name: SignInProvider; available: boolean }[]>([]);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [panel, setPanel] = useState<'details' | 'plans' | 'email' | 'reset'>('details');
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState<{ provider: SignInProvider; url: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef<AbortController | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const userId = useRef<string | null>(null);
  const mutating = useRef(false);
  const ended = useRef(onSessionEnd);
  const accountChanged = useRef(onAccountChange);
  const titleId = useId();

  useEffect(() => {
    ended.current = onSessionEnd;
  }, [onSessionEnd]);

  useEffect(() => {
    accountChanged.current = onAccountChange;
  }, [onAccountChange]);

  const refresh = useCallback(async () => {
    if (mutating.current) {
      return;
    }

    readRequest.current?.abort();

    const controller = new AbortController();

    readRequest.current = controller;

    try {
      const result = await currentAccount(controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      if (userId.current && userId.current !== result.user?.id) {
        ended.current();
        setConfirmDelete(false);
        setDeleteText('');
        setPanel('details');
      }

      if (!userId.current && result.user) {
        setOpen(false);
        setLink(null);
      }

      userId.current = result.user?.id ?? null;
      setAccount(result);
      accountChanged.current?.(result.user?.id ?? null);
      setError('');
    } catch (failure) {
      if (controller.signal.aborted) {
        return;
      }

      if (failure instanceof ApiError && failure.code === 'authentication_required') {
        if (userId.current) {
          ended.current();
        }

        userId.current = null;
        setAccount(null);
        accountChanged.current?.(null);
      }

      setError(failure instanceof Error ? failure.message : 'Could not load your account.');
    }
  }, []);

  useEffect(() => {
    if (openRequest > 0) {
      setPanel('details');
      setConfirmDelete(false);
      setOpen(true);
      void refresh();
    }
  }, [openRequest, refresh]);

  useEffect(() => {
    void refresh();

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      active.current?.abort();
      readRequest.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) {
      dialog.current?.close();

      return;
    }

    dialog.current?.showModal();

    const controller = new AbortController();

    setLoading(true);

    signInProviders(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProviders(result.items);
          setEmailAvailable(result.emailAvailable);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Could not load sign-in options.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [open]);

  async function begin(provider: SignInProvider) {
    active.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    setLoading(true);
    setError('');
    setLink(null);

    try {
      const url = await startSignIn(provider, controller.signal);

      if (!controller.signal.aborted) {
        setLink({ provider, url });
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Could not sign in.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  async function endAccount(remove = false) {
    if (!account?.csrfToken) {
      return;
    }

    if (remove && (!confirmDelete || deleteText !== 'DELETE')) {
      return;
    }

    active.current?.abort();
    readRequest.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    mutating.current = true;
    setLoading(true);
    setError('');

    try {
      if (remove) {
        await deleteAccount(account.csrfToken, controller.signal);
      } else {
        await signOut(account.csrfToken, controller.signal);
      }

      if (!controller.signal.aborted) {
        readRequest.current?.abort();
        ended.current();
        userId.current = null;
        setAccount(null);
        accountChanged.current?.(null);
        setLink(null);
        setConfirmDelete(false);
        setDeleteText('');
        setOpen(false);

        if (remove) {
          onDeleted();
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (remove && failure instanceof ApiError && failure.code === 'authentication_required') {
          setConfirmDelete(false);
          setDeleteText('');
          setPanel('details');
          setNotice('');
        }

        setError(
          failure instanceof Error
            ? failure.message
            : remove
              ? 'Could not delete your account. Please try again.'
              : 'Could not sign out.',
        );
      }
    } finally {
      mutating.current = false;

      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <button
        className="nav-link"
        onClick={() => {
          setLink(null);
          setConfirmDelete(false);
          setDeleteText('');
          setOpen(true);
        }}
      >
        {account?.user ? 'Account' : 'Sign in'}
      </button>
      <dialog
        className={`account-dialog${account?.user && !confirmDelete && (panel === 'details' || panel === 'plans') ? ' account-dialog-settings' : ''}`}
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (mutating.current) {
            event.preventDefault();
          }
        }}
        onClose={() => {
          setOpen(false);
          setConfirmDelete(false);
          setDeleteText('');
          setPanel('details');
          active.current?.abort();
        }}
      >
        <div className="account-dialog-heading">
          <h2 id={titleId}>{account?.user ? 'Your account' : 'Welcome to Jobbely'}</h2>
          <button
            className="icon-button"
            aria-label="Close account dialog"
            disabled={loading && mutating.current}
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        {account?.user ? (
          <>
            {confirmDelete ? (
              <form
                className="account-form account-delete-confirmation"
                onSubmit={(event) => {
                  event.preventDefault();
                  void endAccount(true);
                }}
                aria-busy={loading}
              >
                <h3>Delete your account?</h3>
                <p>{account.user.email ?? 'You’re signed in.'}</p>
                <p className="small-note">
                  This permanently removes your account and sign-in details, signs you out of all
                  sessions, and clears the resume from this tab. This cannot be undone.
                </p>
                <label>
                  Type DELETE to confirm
                  <input
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    value={deleteText}
                    onChange={(event) => setDeleteText(event.target.value)}
                    disabled={loading}
                  />
                </label>
                <div className="account-actions">
                  <button
                    className="account-danger-button"
                    type="submit"
                    disabled={loading || deleteText !== 'DELETE'}
                  >
                    {loading ? 'Deleting…' : 'Permanently delete'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {(panel === 'details' || panel === 'plans') && (
                  <div className="account-mode-buttons">
                    <button
                      aria-pressed={panel === 'details'}
                      onClick={() => setPanel('details')}
                    >
                      Your details
                    </button>
                    <button
                      aria-pressed={panel === 'plans'}
                      onClick={() => setPanel('plans')}
                    >
                      Plans &amp; billing
                    </button>
                  </div>
                )}
                {panel === 'email' && account.csrfToken ? (
                  <AccountEmailChangeForm
                    csrfToken={account.csrfToken}
                    onCancel={() => setPanel('details')}
                    onChanged={async () => {
                      await refresh();
                      setPanel('details');

                      setNotice(
                        'Your email was updated. Your other sessions have been signed out.',
                      );
                    }}
                  />
                ) : panel === 'reset' ? (
                  <>
                    <EmailAccountForm
                      available={emailAvailable}
                      initialMode="reset"
                      initialEmail={account.user.email ?? ''}
                      onBack={() => setPanel('details')}
                      onSignedIn={refresh}
                      onPasswordReset={async () => {
                        await refresh();
                        setPanel('details');
                        setNotice('Password updated. Sign in with your new password.');
                      }}
                    />
                  </>
                ) : panel === 'plans' ? (
                  <PricingPlans
                    signedIn
                    accountKey={account.user.id}
                    onSignIn={() => {
                      setOpen(false);
                      void refresh();
                    }}
                  />
                ) : (
                  <>
                    <section className="account-details">
                      <h3>Your details</h3>
                      <div className="account-detail-row">
                        <div>
                          <span className="small-note">Email address</span>
                          <p>
                            {account.user.email ?? 'No email supplied by your sign-in provider'}
                          </p>
                        </div>
                        {account.user.hasPassword && (
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setNotice('');
                              setPanel('email');
                            }}
                          >
                            Change email
                          </button>
                        )}
                      </div>
                      <div className="account-detail-row">
                        <div>
                          <span className="small-note">Password</span>
                          <p
                            aria-label={account.user.hasPassword ? 'Password is hidden' : undefined}
                          >
                            {account.user.hasPassword
                              ? '••••••••'
                              : 'Managed by your sign-in provider'}
                          </p>
                        </div>
                        {account.user.hasPassword && (
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setNotice('');
                              setPanel('reset');
                            }}
                          >
                            Reset password
                          </button>
                        )}
                      </div>
                    </section>
                    <section className="account-current-plan">
                      <div>
                        <span className="plan-eyebrow">Your current plan</span>
                        <h3>
                          Basic <span>Free</span>
                        </h3>
                        <p className="small-note">Job discovery, resume review and matching.</p>
                      </div>
                      <button
                        className="secondary-button"
                        onClick={() => setPanel('plans')}
                      >
                        Explore plans
                      </button>
                    </section>
                  </>
                )}
                {(panel === 'details' || panel === 'plans') && (
                  <div className="account-footer-actions">
                    <div className="account-actions">
                      <button
                        className="secondary-button"
                        disabled={loading}
                        onClick={() => {
                          void endAccount();
                        }}
                      >
                        Sign out
                      </button>
                      <button
                        className="account-danger-button"
                        disabled={loading}
                        onClick={() => {
                          setConfirmDelete(true);
                          setDeleteText('');
                          setError('');
                        }}
                      >
                        Delete account
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {open && (
              <EmailAccountForm
                available={emailAvailable}
                onSignedIn={refresh}
                onPasswordReset={refresh}
              />
            )}
            {providers.some((provider) => provider.available) && (
              <div className="account-provider-buttons">
                {(['github', 'linkedin'] as const).map((provider) => (
                  <button
                    key={provider}
                    className="secondary-button"
                    disabled={
                      loading || !providers.find((item) => item.name === provider)?.available
                    }
                    onClick={() => {
                      void begin(provider);
                    }}
                  >
                    Sign in with {names[provider]}
                  </button>
                ))}
              </div>
            )}
            {link && (
              <a
                className="primary-button account-continue"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue with {names[link.provider]} <ArrowUpRight size={16} />
              </a>
            )}
          </>
        )}
        {loading && (
          <p
            className="small-note"
            role="status"
          >
            Please wait…
          </p>
        )}
        {notice && (
          <p
            className="small-note"
            role="status"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            className="account-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </dialog>
    </>
  );
}
