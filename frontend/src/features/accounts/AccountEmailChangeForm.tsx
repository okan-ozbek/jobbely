import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { confirmEmailChange, requestEmailChange, resendEmailChange } from '../../api/accounts.js';
import { VerificationCodeInput } from './VerificationCodeInput.js';

export function AccountEmailChangeForm({
  csrfToken,
  onChanged,
  onCancel,
}: {
  csrfToken: string;
  onChanged: () => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sends, setSends] = useState(1);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setTimeout(() => setSeconds((value) => value - 1), 1_000);

    return () => clearTimeout(timer);
  }, [seconds]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const controller = new AbortController();

    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setError('');

    try {
      if (challenge) {
        await confirmEmailChange({ challenge, code }, csrfToken, controller.signal);

        if (!controller.signal.aborted) {
          setCode('');
          await onChanged();
        }
      } else {
        const result = await requestEmailChange(
          { email: email.trim(), password },
          csrfToken,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setChallenge(result.challenge);
          setPassword('');
          setSeconds(60);
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Could not change your email.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  async function resend() {
    const controller = new AbortController();

    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setError('');

    try {
      await resendEmailChange(challenge, csrfToken, controller.signal);

      if (!controller.signal.aborted) {
        setSends((value) => value + 1);
        setSeconds(60);
        setCode('');
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Could not resend your code.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return (
    <section className="account-settings-form">
      <h3>Change your email</h3>
      <p className="small-note">
        Confirm your current password, then verify your new email address. Your other sessions will
        be signed out.
      </p>
      {challenge && (
        <p
          className="small-note"
          role="status"
        >
          A confirmation email was sent to {email.trim()}. Use the latest code.
        </p>
      )}
      <form
        className="account-form"
        aria-busy={busy}
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        {challenge ? (
          <VerificationCodeInput
            value={code}
            onChange={setCode}
            email={email.trim()}
            disabled={busy}
          />
        ) : (
          <>
            <label>
              New email
              <input
                type="email"
                autoComplete="email"
                placeholder="example@jobbely.com"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                maxLength={256}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>
          </>
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
          disabled={busy}
        >
          {busy ? 'Please wait…' : challenge ? 'Confirm new email' : 'Send confirmation code'}
        </button>
      </form>
      {challenge && (
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
      <button
        className="account-text-button"
        disabled={busy}
        onClick={onCancel}
      >
        Back to your details
      </button>
    </section>
  );
}
