import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/generated/**', '**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
    },
  },
);
