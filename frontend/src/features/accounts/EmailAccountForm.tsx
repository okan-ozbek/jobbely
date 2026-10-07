import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { ApiError } from '../../api/client.js';
import {
  registerPasswordAccount,
  confirmPasswordAccount,
  passwordSignIn,
  requestPasswordReset,
  completePasswordReset,
  resendEmailCode,
} from '../../api/accounts.js';
import { VerificationCodeInput } from './VerificationCodeInput.js';

type Mode = 'login' | 'register' | 'reset' | 'confirm' | 'reset-confirm';

export function EmailAccountForm({
  available,
  onSignedIn,
  onPasswordReset,
  initialMode = 'login',
  initialEmail = '',
  onBack,
  showHeading = true,
  workspace = false,
  headingId,
}: {
  available: boolean;
  onSignedIn: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
  initialMode?: 'login' | 'reset';
  initialEmail?: string;
  onBack?: () => void;
  showHeading?: boolean;
  workspace?: boolean;
  headingId?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [sends, setSends] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();
  const passwordHintId = useId();
  const active = useRef<AbortController | null>(null);
  const confirmation = mode === 'confirm' || mode === 'reset-confirm';
  const newPassword = mode === 'register' || mode === 'reset-confirm';

  useEffect(() => () => active.current?.abort(), []);

  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1_000)));

    tick();

    const timer = setInterval(tick, 1_000);

    return () => clearInterval(timer);
  }, [resendAt]);

  function changeMode(next: Mode) {
    active.current?.abort();
    setMode(next);
    setPassword('');
    setRepeat('');
    setCode('');
    setChallenge('');
    setError('');
    setMessage('');
    setBusy(false);
    setSends(1);
    setShowPassword(false);
    setResendAt(0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    const normalizedPassword = password.normalize('NFC');

    if (
      newPassword &&
      ([...normalizedPassword].length < 8 ||
        [...normalizedPassword].length > 128 ||
        !/[0-9]/.test(normalizedPassword) ||
        !/[\p{P}\p{S}]/u.test(normalizedPassword))
    ) {
      setError('Password is not valid. Use 8–128 characters, including a number and a symbol.');

      return;
    }

    if (newPassword && password !== repeat) {
      setError('Passwords do not match.');

      return;
    }

    active.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    setBusy(true);
    setError('');

    try {
      if (mode === 'login') {
        await passwordSignIn({ email: email.trim(), password }, controller.signal);

        if (!controller.signal.aborted) {
          setPassword('');
          await onSignedIn();
        }
      } else if (mode === 'register' || mode === 'reset') {
        const result =
          mode === 'register'
            ? await registerPasswordAccount(
                {
                  email: email.trim(),
                  password,
                },
                controller.signal,
              )
            : await requestPasswordReset({ email: email.trim() }, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setChallenge(result.challenge);

        setMessage(
          mode === 'register'
            ? `Check ${email.trim()} for your confirmation email. If you already have an account, sign in instead.`
            : result.message,
        );

        setPassword('');
        setRepeat('');
        setCode('');
        setResendAt(Date.now() + 60_000);
        setSends(1);
        setMode(mode === 'register' ? 'confirm' : 'reset-confirm');
      } else if (mode === 'confirm') {
        await confirmPasswordAccount({ challenge, code }, controller.signal);

        if (!controller.signal.aborted) {
          setCode('');
          await onSignedIn();
        }
      } else {
        await completePasswordReset({ challenge, code, password }, controller.signal);

        if (!controller.signal.aborted) {
          await onPasswordReset();
          changeMode('login');
          setMessage('Password updated. Sign in with your new password.');
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (
          mode === 'confirm' &&
          failure instanceof ApiError &&
          failure.code === 'account_exists'
        ) {
          changeMode('login');
          setMessage(failure.message);

          return;
        }

        setError(failure instanceof Error ? failure.message : 'Please try again.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  async function resend() {
    active.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    setBusy(true);
    setError('');

    try {
      await resendEmailCode(challenge, controller.signal);

      if (!controller.signal.aborted) {
        setSends((value) => value + 1);
        setResendAt(Date.now() + 60_000);
        setCode('');

        setMessage(
          'A new code was requested. Use the latest email; the previous code no longer works.',
        );
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Could not resend the code.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return (
    <div className={`email-account${workspace ? ' auth-email-account' : ''}`}>
      {workspace && (
        <div className="auth-form-heading">
          <span className="auth-form-eyebrow">Your Jobbely account</span>
          <h2 id={headingId}>
            {mode === 'register'
              ? 'Create an account.'
              : mode === 'login'
                ? 'Welcome back.'
                : confirmation
                  ? 'Check your inbox.'
                  : 'A fresh start.'}
          </h2>
          {mode === 'login' || mode === 'register' ? (
            <p>
              {mode === 'login' ? 'New to Jobbely?' : 'Already have an account?'}{' '}
              <button
                className="auth-inline-link"
                disabled={busy}
                onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          ) : (
            <p>
              {mode === 'confirm'
                ? 'One small step. Confirm your email to get started.'
                : mode === 'reset-confirm'
                  ? 'Enter your email code and choose a new password.'
                  : 'We’ll help you get back to your account.'}
            </p>
          )}
        </div>
      )}
      {!workspace && !confirmation && mode !== 'reset' && (
        <div className="account-mode-buttons">
          <button
            type="button"
            aria-pressed={mode === 'login'}
            onClick={() => changeMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === 'register'}
            onClick={() => changeMode('register')}
          >
            Create account
          </button>
        </div>
      )}
      {!workspace && showHeading && (confirmation || mode === 'reset') && (
        <h3>{mode === 'confirm' ? 'Confirm your email' : 'Reset your password'}</h3>
      )}
      {message && (
        <p
          className="small-note"
          role="status"
        >
          {message}
        </p>
      )}
      {!available && <p className="small-note">Email sign-in is currently unavailable.</p>}
      <form
        className="account-form"
        onSubmit={(event) => {
          void submit(event);
        }}
        aria-busy={busy}
      >
        {!confirmation && (
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              placeholder="example@jobbely.com"
              required
              maxLength={254}
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        )}
        {confirmation && (
          <VerificationCodeInput
            value={code}
            onChange={setCode}
            email={email.trim()}
            disabled={busy}
          />
        )}
        {(mode === 'login' || newPassword) && (
          <div className="account-password-label">
            <label htmlFor={passwordId}>
              {mode === 'reset-confirm' ? 'New password' : 'Password'}
            </label>
            <div className="auth-password-field">
              <input
                id={passwordId}
                aria-describedby={newPassword ? passwordHintId : undefined}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete={newPassword ? 'new-password' : 'current-password'}
                required
                maxLength={256}
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="auth-password-toggle"
                disabled={busy}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {newPassword && (
              <span
                id={passwordHintId}
                className="small-note"
              >
                8–128 characters, including a number and a symbol.
              </span>
            )}
          </div>
        )}
        {newPassword && (
          <label>
            Confirm password
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              maxLength={256}
              value={repeat}
              disabled={busy}
              onChange={(event) => setRepeat(event.target.value)}
            />
          </label>
        )}
        {error && (
          <p
            className="account-error"
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={!available || busy}
          type="submit"
        >
          {busy
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in with email'
              : mode === 'register'
                ? 'Create account'
                : mode === 'confirm'
                  ? 'Confirm email'
                  : mode === 'reset'
                    ? 'Send reset code'
                    : 'Save new password'}
          {workspace && !busy && <ArrowRight size={17} />}
        </button>
      </form>
      {mode === 'login' && (
        <button
          className="account-text-button"
          disabled={busy}
          onClick={() => changeMode('reset')}
        >
          Forgot password?
        </button>
      )}
      {confirmation && (
        <button
          className="account-text-button"
          disabled={busy || seconds > 0 || sends >= 3}
          onClick={() => {
            void resend();
          }}
        >
          {seconds > 0
            ? `Resend code in ${seconds}s`
            : sends >= 3
              ? 'Resend limit reached'
              : 'Resend code'}
        </button>
      )}
      {(confirmation || mode === 'reset') && (
        <button
          className="account-text-button"
          disabled={busy}
          onClick={() => (onBack ? onBack() : changeMode('login'))}
        >
          {onBack ? 'Back to your details' : 'Back to sign in'}
        </button>
      )}
      {mode === 'confirm' && (
        <button
          className="account-text-button"
          disabled={busy}
          onClick={() => changeMode('register')}
        >
          Start registration again
        </button>
      )}
    </div>
  );
}
