// @ts-check

import sharedConfig from '@eejit/eslint-config-typescript';

/** @type {import('eslint').Linter.Config[]} */
export default [
    ...sharedConfig,
    {
        languageOptions: {
            parserOptions: { project: ['./tsconfig.json', './scripts/tsconfig.json'] },
        },
        rules: {
            'unicorn/catch-error-name': ['error', { ignore: ['errorCode'] }],
        },
    },
];
