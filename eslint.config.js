import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'progress'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // La propia configuración de ESLint no entra en el proyecto de TypeScript.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.ts', 'dashboard/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // `core/` debe poder ejecutarse en Node: nada de DOM, window, Date ni Math.random.
    files: ['src/core/**/*.ts', 'src/data/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core/ y data/ deben ser puros (sin navegador).' },
        { name: 'document', message: 'core/ y data/ deben ser puros (sin DOM).' },
        { name: 'localStorage', message: 'La persistencia vive en persistence/.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Usa el PRNG con semilla de core/rng.ts.' },
        { object: 'Date', property: 'now', message: 'El tiempo entra como parámetro.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="Date"]',
          message: 'El tiempo entra como parámetro.',
        },
      ],
    },
  },
  prettier,
);
