import { describe, expect, it } from 'vitest';
import { passwordValidation } from './password-validation.js';

describe('new password requirements', () => {
  it('requires length, a number and a symbol independently', () => {
    expect(passwordValidation('short1!').valid).toBe(false);
    expect(passwordValidation('longpassword!').valid).toBe(false);
    expect(passwordValidation('longpassword1').valid).toBe(false);
    expect(passwordValidation('longpass1!').valid).toBe(true);
    expect(passwordValidation('').rules.every((rule) => !rule.valid)).toBe(true);
  });

  it('counts Unicode code points after normalization, rather than UTF-16 units', () => {
    expect(passwordValidation('😀😀😀😀😀1!').valid).toBe(false);
    expect(passwordValidation('😀😀😀😀😀😀1!').valid).toBe(true);
    expect(passwordValidation('e\u0301e\u0301e\u0301e\u0301e\u03011!').valid).toBe(false);
  });

  it('accepts punctuation or Unicode symbols, but not whitespace as a symbol', () => {
    expect(passwordValidation('password1€').valid).toBe(true);
    expect(passwordValidation('password1 ').valid).toBe(false);
    expect(passwordValidation('password١!').valid).toBe(false);
  });

  it('enforces the upper bound including otherwise valid passwords', () => {
    expect(passwordValidation(`${'a'.repeat(126)}1!`).valid).toBe(true);
    expect(passwordValidation(`${'a'.repeat(127)}1!`).valid).toBe(false);
  });
});
