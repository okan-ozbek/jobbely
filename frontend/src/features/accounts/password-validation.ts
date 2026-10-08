export function passwordValidation(value: string) {
  const normalized = value.normalize('NFC');
  const length = [...normalized].length;

  const rules = [
    { label: '8–128 characters', valid: length >= 8 && length <= 128 },
    { label: 'A number', valid: /[0-9]/.test(normalized) },
    { label: 'A symbol', valid: /[\p{P}\p{S}]/u.test(normalized) },
  ];

  return { rules, valid: rules.every((rule) => rule.valid) };
}
