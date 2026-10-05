import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { Account, SignInProvider } from '../../api/accounts.js';
import { currentAccount, signInProviders, signOut, startSignIn } from '../../api/accounts.js';
import { ApiError } from '../../api/client.js';
import './accounts.css';
import { EmailAccountForm } from './EmailAccountForm.js';

const names = { github: 'GitHub', linkedin: 'LinkedIn' };

export function AccountMenu({ onSessionEnd }: { onSessionEnd: () => void }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [providers, setProviders] = useState<{ name: SignInProvider; available: boolean }[]>([]);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState<{ provider: SignInProvider; url: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef<AbortController | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const userId = useRef<string | null>(null);
  const ended = useRef(onSessionEnd);
  const titleId = useId();

  useEffect(() => {
    ended.current = onSessionEnd;
  }, [onSessionEnd]);

  const refresh = useCallback(async () => {
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
      }

      if (!userId.current && result.user) {
        setOpen(false);
        setLink(null);
      }

      userId.current = result.user?.id ?? null;
      setAccount(result);
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
      }

      setError(failure instanceof Error ? failure.message : 'Could not load your account.');
    }
  }, []);

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

  async function logout() {
    if (!account?.csrfToken) {
      return;
    }

    active.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    setLoading(true);
    setError('');

    try {
      await signOut(account.csrfToken, controller.signal);

      if (!controller.signal.aborted) {
        readRequest.current?.abort();
        ended.current();
        userId.current = null;
        setAccount(null);
        setLink(null);
        setOpen(false);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Could not sign out.');
      }
    } finally {
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
          setOpen(true);
        }}
      >
        {account?.user ? 'Account' : 'Sign in'}
      </button>
      <dialog
        className="account-dialog"
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false);
          active.current?.abort();
        }}
      >
        <div className="account-dialog-heading">
          <h2 id={titleId}>{account?.user ? 'Your account' : 'Welcome to Jobbely'}</h2>
          <button
            className="icon-button"
            aria-label="Close account dialog"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        {account?.user ? (
          <>
            {account.user.username && <p>{account.user.username}</p>}
            <p>{account.user.email ?? 'You’re signed in.'}</p>
            <p className="small-note">Free account. Your resume stays in this tab.</p>
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() => {
                void logout();
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="small-note">Your resume stays in this tab.</p>
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
