import { build, type Plugin } from 'esbuild';
import postcss from 'esbuild-postcss';
import { readdirSync } from 'node:fs';

const cssImportPlugin: Plugin = {
    name: 'css-import',
    setup(builder) {
        // eslint-disable-next-line unicorn/prevent-abbreviations
        builder.onLoad({ filter: /\.css$/ }, async (args) => {
            if (args.with.type === 'css') {
                const result = await build({
                    bundle: true,
                    entryPoints: [args.path],
                    minify: builder.initialOptions.minify,
                    plugins: [postcss()],
                    write: false,
                });

                return { contents: result.outputFiles[0].text, loader: 'text' };
            }
        });
    },
};

const scripts = readdirSync('scripts')
    .filter((fileOrDirectory) => fileOrDirectory !== 'tsconfig.json')
    .map((fileOrDirectory) =>
        fileOrDirectory.endsWith('.ts') ? `scripts/${fileOrDirectory}` : `scripts/${fileOrDirectory}/${fileOrDirectory}.ts`,
    );

for (const script of scripts)
    void build({
        entryPoints: [script],
        outdir: 'dist/scripts',
        minify: true,
        bundle: true,
        sourcemap: 'inline',
        plugins: [cssImportPlugin],
        banner: {
            js: `// <nowiki>\n// Note: This script was compiled and minified from TypeScript. For a more readable version, see https://github.com/Eejit43/wikipedia-scripts/blob/main/${script}\n`,
        },
        footer: { js: '\n// </nowiki>' },
    });

// eslint-disable-next-line no-console
console.log(`Successfully compiled ${scripts.length} script${scripts.length === 1 ? '' : 's'}!`);
