import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(root, 'src/server/index.ts')],
  outfile: path.join(root, 'dist/server/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
  alias: {
    '@shared': path.join(root, 'src/shared'),
    '@server': path.join(root, 'src/server'),
  },
});
