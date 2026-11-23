// @ts-check
import js from '@eslint/js';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginAstro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig(
  {
    ignores: [
      'src/content/posts/.obsidian/**',
      '.worktrees/**',
      '.wt/**',
      'worker-configuration.d.ts',
    ],
  },
  includeIgnoreFile(gitignorePath, {
    gitignoreResolution: true,
    name: 'Imported .gitignore patterns',
  }),
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginAstro.configs['jsx-a11y-recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        dataLayer: false,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
    },
  },
  eslintConfigPrettier,
);
