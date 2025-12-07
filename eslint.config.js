// @ts-check

import sharedConfig from '@eejit/eslint-config-typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
    sharedConfig,
    {
        languageOptions: { parserOptions: { project: ['./tsconfig.json', './scripts/tsconfig.json'] } },
        rules: { 'unicorn/catch-error-name': ['error', { ignore: ['errorCode'] }] },
    },
    globalIgnores(['dist/*', 'scripts/AFCRHS.ts', 'scripts/pageswap.ts']),
);
