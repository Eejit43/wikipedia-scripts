import { build } from 'esbuild';
import postcss from 'esbuild-postcss';

build({ entryPoints: ['scripts/*.ts'], outdir: 'dist/scripts', sourcemap: 'inline' });
build({ entryPoints: ['styles/*.css'], outdir: 'dist/styles', plugins: [postcss()], sourcemap: 'inline' });
