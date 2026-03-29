import fs from 'node:fs';
import path from 'node:path';

import { build } from 'esbuild';

const projectRoot = process.cwd();
const outdir = path.join(projectRoot, 'dist', 'src', 'desktop', 'renderer');

await fs.promises.mkdir(outdir, { recursive: true });

await build({
  entryPoints: [path.join(projectRoot, 'src', 'desktop', 'renderer', 'index.tsx')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome126',
  jsx: 'automatic',
  outfile: path.join(outdir, 'bundle.js'),
  loader: {
    '.css': 'css',
  },
  legalComments: 'none',
});

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; script-src 'self';" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>El Bruto Control</title>
    <link rel="stylesheet" href="./bundle.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="./bundle.js"></script>
  </body>
</html>
`;

await fs.promises.writeFile(path.join(outdir, 'index.html'), html, 'utf8');

