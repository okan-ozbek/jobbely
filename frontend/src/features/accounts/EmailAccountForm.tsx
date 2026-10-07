import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
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
}: {
  available: boolean;
  onSignedIn: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
  initialMode?: 'login' | 'reset';
  initialEmail?: string;
  onBack?: () => void;
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
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
    <div className="email-account">
      {!confirmation && mode !== 'reset' && (
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
      {(confirmation || mode === 'reset') && (
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
          <label>
            {mode === 'reset-confirm' ? 'New password' : 'Password'}
            <input
              type="password"
              placeholder="••••••••"
              autoComplete={newPassword ? 'new-password' : 'current-password'}
              required
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {newPassword && (
              <span className="small-note">8–128 characters, including a number and a symbol.</span>
            )}
          </label>
        )}
        {newPassword && (
          <label>
            Confirm password
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              maxLength={256}
              value={repeat}
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
        </button>
      </form>
      {mode === 'login' && (
        <button
          className="account-text-button"
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
          onClick={() => (onBack ? onBack() : changeMode('login'))}
        >
          {onBack ? 'Back to your details' : 'Back to sign in'}
        </button>
      )}
    </div>
  );
}
