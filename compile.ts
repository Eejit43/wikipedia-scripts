import { build } from 'esbuild';
import postcss from 'esbuild-postcss';

build({ entryPoints: ['scripts/*.ts'], outdir: 'dist/scripts', minify: true, sourcemap: 'inline' });
build({ entryPoints: ['styles/*.css'], outdir: 'dist/styles', minify: true, sourcemap: 'inline', plugins: [postcss()] });
