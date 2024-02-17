import { build } from 'esbuild';
import postcss from 'esbuild-postcss';
import { readdirSync } from 'node:fs';

const scripts = readdirSync('scripts').map((file) => `scripts/${file}`);
for (const script of scripts)
    build({
        entryPoints: [script],
        outdir: 'dist/scripts',
        minify: true,
        sourcemap: 'inline',
        banner: {
            js: `// <nowiki>\n// Note: This script was compiled and minified from TypeScript. For a more readable version, see https://github.com/Eejit43/wikipedia-scripts/blob/main/${script}\n`,
        },
        footer: { js: '\n// </nowiki>' },
    });

const styles = readdirSync('styles').map((file) => `styles/${file}`);
for (const style of styles)
    build({
        entryPoints: [style],
        outdir: 'dist/styles',
        minify: true,
        sourcemap: 'inline',
        plugins: [postcss()],
        banner: {
            css: `/* <nowiki> */\n/* Note: This stylesheet was compiled and minified from modern CSS. For a more readable version, see https://github.com/Eejit43/wikipedia-scripts/blob/main/${style} */\n`,
        },
        footer: { css: '\n/* </nowiki> */' },
    });
