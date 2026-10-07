import { describe, expect, it } from 'vitest';
import { validNewPassword } from './password.js';

describe('new password requirements', () => {
  it.each(['Abcdef1!', '1!aaaaaa', `${'é'.repeat(126)}1!`, 'Abcdef1💜', 'e\u0301abcde1!'])(
    'accepts valid password %s',
    (password) => {
      expect(validNewPassword(password)).toBe(true);
    },
  );

  it.each([
    'Abcde1!',
    'Abcdefgh!',
    'Abcdefg1',
    'Abcdef1 ',
    `${'é'.repeat(127)}1!`,
    '',
    '１２３４５６７!',
  ])('rejects invalid password %s', (password) => {
    expect(validNewPassword(password)).toBe(false);
  });
});
