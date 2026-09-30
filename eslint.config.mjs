import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

const variableDeclarations = ['const', 'let', 'var'];
const multilineDeclarations = ['multiline-const', 'multiline-let', 'multiline-var'];

const standaloneStatements = [
  'function',
  'class',
  'interface',
  'type',
  'enum',
  'export',
  'block-like',
  'multiline-expression',
];

const callableDeclaration = {
  selector:
    'VariableDeclaration:has(VariableDeclarator > :matches(ArrowFunctionExpression, FunctionExpression))',
};

export default tseslint.config(
  { ignores: ['**/generated/**', '**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: variableDeclarations },
        { blankLine: 'always', prev: variableDeclarations, next: '*' },
        // Consecutive simple declarations form a group; preserve intentional gaps inside it.
        { blankLine: 'any', prev: variableDeclarations, next: variableDeclarations },
        { blankLine: 'always', prev: '*', next: multilineDeclarations },
        { blankLine: 'always', prev: multilineDeclarations, next: '*' },
        { blankLine: 'always', prev: '*', next: standaloneStatements },
        { blankLine: 'always', prev: standaloneStatements, next: '*' },
        { blankLine: 'always', prev: '*', next: callableDeclaration },
        { blankLine: 'always', prev: callableDeclaration, next: '*' },
        { blankLine: 'always', prev: '*', next: ['return', 'throw'] },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
      ],
      '@stylistic/lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: '*', next: 'method' },
            { blankLine: 'always', prev: 'method', next: '*' },
          ],
        },
        { exceptAfterOverload: true },
      ],
    },
  },
);
