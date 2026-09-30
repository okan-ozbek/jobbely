# Decision: shared readable formatting

**Status:** Implemented, 30 September 2026.

## Decision and rationale

Use one root Prettier configuration for backend/frontend TypeScript, TSX, configuration files and supporting text files. The formatter produces consistent layout automatically; ESLint handles code-quality rules that require syntax changes or diagnostics. Both package-local commands inherit the root formatting configuration.

The style uses two spaces, a 100-column wrapping target, single quotes in JavaScript/TypeScript, semicolons, trailing commas, parenthesized arrow parameters, and one JSX attribute per line. Long expressions and object definitions wrap consistently. Prettier retains necessary exceptions to the wrapping target, such as long string literals; it does not rename variables or redesign functions.

ESLint requires braces around every conditional/loop body and strict equality. This makes nested control flow explicit alongside the existing recommended TypeScript rules, type-only imports and ban on explicit `any`. The format command applies ESLint fixes before Prettier lays out the resulting code.

## Vertical whitespace

Use one blank line between functions (including assigned arrow functions), classes, type/interface declarations, class methods, and the import section and implementation. Separate variable-declaration groups from executable statements, and give multiline declarations and operations their own space. Add a blank line before returns/throws and around control-flow blocks when adjacent statements exist.

Consecutive simple variables and class fields may form a compact group. Keep related values together and add intentional blank lines between different concerns, such as metadata state, result state and loading/error state. Existing group boundaries are preserved; the formatter cannot infer a variable's conceptual role from its name.

These rules are enforced using ESLint Stylistic's [statement padding](https://eslint.style/rules/padding-line-between-statements) and [class-member spacing](https://eslint.style/rules/lines-between-class-members). Only rules compatible with Prettier are enabled; no competing indentation or quote formatter is introduced. Prettier preserves these blank lines and normalizes repeated empty lines.

## Commands and editor behavior

From the repository root:

```sh
pnpm format
pnpm format:check
pnpm lint
```

`pnpm format` runs `lint:fix` and then Prettier, applying vertical spacing and layout in one command. Root formatting scans the repository, including `backend/prisma.config.ts` and `frontend/vite.config.ts`. Package-local formatting applies the same sequence to the selected package, including its configuration files. `format:check` checks Prettier layout; `lint` checks spacing and quality rules. `pnpm check` runs both read-only checks and fails on drift without rewriting files.

An editor using the Prettier formatter discovers `.prettierrc.json` automatically. Enable that editor's format-on-save option if desired. `.editorconfig` supplies matching indentation/newline defaults, and `.gitattributes` preserves LF text endings across Git checkouts on Windows and other systems.

## Exclusions and invariants

Root and package ignore files exclude generated Prisma/OpenAPI code, dependencies, builds, coverage, environment files and local data. The generated contract, lockfile and original MVP plan retain their separate ownership/exclusions. Source changes do not require manually reformatting generated code.

Formatting, blank-line insertion and brace insertion must preserve application behavior. Keep stylistic rules compatible with Prettier; avoid a second formatter or rules that repeatedly undo its output. Broader refactors should be reviewed separately from formatting.

## Implementation and verification

[Prettier settings](../.prettierrc.json), [editor defaults](../.editorconfig), [Git line endings](../.gitattributes), [root ignores](../.prettierignore), [backend ignores](../backend/.prettierignore), [frontend ignores](../frontend/.prettierignore), [ESLint rules](../eslint.config.mjs), [scripts](../package.json).

Verify with formatting checks, lint and strict types. Behavior tests cover the control-flow paths affected by explicit brace insertion. See [QUALITY.md](QUALITY.md) for the full verification sequence.
