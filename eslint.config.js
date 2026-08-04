// ESLint, configured to find bugs rather than to have opinions.
//
// There is deliberately **no stylistic rule set and no Prettier** here. This
// codebase carries a lot of long-form explanatory comment — the reasoning behind a
// decision, kept next to the code it constrains — and a formatter would reflow or
// churn that for no correctness gain. The rules below are the ones that catch
// things a reviewer would call a defect:
//
//   - `react-hooks/exhaustive-deps` — stale closures, the commonest real React bug
//   - `react-hooks/rules-of-hooks` — conditional hooks
//   - `no-unused-vars` — dead bindings, usually the residue of a refactor
//   - the typescript-eslint recommended set, minus its type-aware rules (those need
//     a full type-check per lint run; `npm run typecheck` already does that)
//
// If you want a formatter, that is a project decision, not a drive-by one: it
// touches every file and should land as its own change with nothing else in it.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    // Assets, build output, and generated files are not ours to lint.
    //
    // `.venv/**` matters more than it looks: the CT pipeline's Python virtualenv is
    // 5.1 GB, gitignored, and carries third-party JavaScript (preact, matplotlib's
    // web backend) shipped inside pip packages. ESLint descends into dot-directories
    // and does not read `.gitignore`, so without this it reports ~92 problems in
    // code that is not ours and is not in the repository.
    ignores: ['dist/**', 'public/**', 'node_modules/**', 'docs/**', '**/.venv/**'],
  },
  // The app: browser globals, React rules.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Underscore-prefixed args are a deliberate "unused on purpose" marker,
      // which the GLSL attribute aliases and a few callbacks rely on.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  // The asset pipeline: Node scripts, no React, and they are allowed to be blunt.
  {
    files: ['scripts/**/*.{mjs,ts}', '*.config.{js,ts}', 'vite.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // `try { … } catch {}` is a real idiom in the pipeline scripts and every use
      // of it here is deliberate: killing an already-dead Chrome from an `exit`
      // handler, or polling a DevTools port that is not listening yet. The loop's
      // own timeout is what reports genuine failure, so a per-attempt error is
      // noise. Swallowing anything wider than that is not covered by this — an
      // empty catch around real work is still a defect, just not one this rule
      // can tell apart.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
)
