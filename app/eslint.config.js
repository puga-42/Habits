// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Ember guard (slice 5.5): useThemeColor is the internal engine of the
    // themed primitives only — everything else reads colors via useTokens().
    files: ['**/*.tsx', '**/*.ts'],
    ignores: ['components/themed-text.tsx', 'components/themed-view.tsx', 'hooks/use-theme-color.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/hooks/use-theme-color',
              message:
                'useThemeColor is private to ThemedText/ThemedView — use useTokens() from @/hooks/use-tokens instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Ember guard (see PLAN.md "UI overhaul"): the dead neutral gray and the
    // stock iOS blue were retired in slices 1–5. Colors come from the semantic
    // tokens (useTokens / constants/theme.ts) — never hardcode these again.
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/rgba\\(127, ?127, ?127/i]",
          message:
            'Dead gray retired by the Ember overhaul — use a semantic token (t.hairline*, t.ink*, t.surface*) from useTokens().',
        },
        {
          selector: "Literal[value=/#0A84FF/i]",
          message:
            'Stock iOS blue retired by the Ember overhaul — use t.accent from useTokens().',
        },
      ],
    },
  },
]);
