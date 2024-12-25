// @ts-check

import sharedConfig from '@eejit/eslint-config-typescript';
import typescriptEslint from 'typescript-eslint';

export default typescriptEslint.config(sharedConfig, {
    languageOptions: { parserOptions: { project: ['./tsconfig.json', './scripts/tsconfig.json'] } },
    rules: { 'unicorn/catch-error-name': ['error', { ignore: ['errorCode'] }] },
});
