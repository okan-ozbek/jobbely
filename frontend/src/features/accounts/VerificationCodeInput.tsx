import { useId, useRef } from 'react';

const positions = [0, 1, 2, 3, 4, 5] as const;

export function VerificationCodeInput({
  value,
  onChange,
  email,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  email: string;
  disabled: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const helpId = useId();
  const digits = value.padEnd(6, ' ').split('');

  function fill(index: number, input: string) {
    const numbers = input.replace(/\D/g, '').slice(0, 6);

    if (!numbers) {
      digits[index] = ' ';
      onChange(digits.join('').trimEnd());

      return;
    }

    const start = numbers.length === 6 ? 0 : index;

    for (let offset = 0; offset < numbers.length && start + offset < 6; offset++) {
      digits[start + offset] = numbers[offset] ?? ' ';
    }

    onChange(digits.join('').trimEnd());
    inputs.current[Math.min(5, start + numbers.length)]?.focus();
  }

  return (
    <fieldset
      className="verification-code"
      disabled={disabled}
    >
      <legend>Verification code</legend>
      <div className="verification-code-inputs">
        {positions.map((index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            aria-label={`Verification code digit ${index + 1}`}
            aria-describedby={helpId}
            autoFocus={index === 0}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            required
            pattern="[0-9]"
            maxLength={1}
            value={digits[index]?.trim() ?? ''}
            onFocus={(event) => event.target.select()}
            onChange={(event) => fill(index, event.target.value)}
            onPaste={(event) => {
              event.preventDefault();

              const text = event.clipboardData.getData('text');

              if (/\d/.test(text)) {
                fill(index, text);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault();

                const target = digits[index]?.trim() ? index : Math.max(0, index - 1);

                fill(target, '');
                inputs.current[target]?.focus();
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();

                inputs.current[
                  Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)))
                ]?.focus();
              }
            }}
          />
        ))}
      </div>
      <span
        className="small-note"
        id={helpId}
      >
        Enter the six-digit code sent to {email}. It expires ten minutes after your first request.
      </span>
    </fieldset>
  );
}
