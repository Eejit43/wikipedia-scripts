import { build } from 'esbuild';
import postcss from 'esbuild-postcss';
import { glob } from 'glob';

build({ entryPoints: await glob('scripts/*.ts'), outdir: 'dist/scripts' });

build({ entryPoints: await glob('styles/*.css'), outdir: 'dist/styles', plugins: [postcss()] });
