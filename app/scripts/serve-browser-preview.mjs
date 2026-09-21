import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { browserSourceDigest } from './browser-source-digest.mjs';

const targets = {
  local: { port: 8081, directory: '.local/browser-dist', api: 'http://127.0.0.1:54321' },
  development: {
    port: 8082,
    directory: '.local/browser-development',
    api: 'https://rwfmqthrpbkizcofullh.supabase.co',
  },
  staging: {
    port: 8083,
    directory: '.local/browser-staging',
    api: 'https://kircmwdkcdcozckrwfid.supabase.co',
  },
};
const target = targets[process.argv[2]];
assert.ok(target, 'Choose local, development, or staging explicitly');
const root = path.resolve(target.directory);
const manifest = JSON.parse(readFileSync(path.join(root, 'acceptance-build.json'), 'utf8'));
assert.equal(manifest.apiOrigin, target.api);
assert.equal(manifest.sourceDigest, browserSourceDigest(), 'Rebuild this environment first');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    let route = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (/^\/invite\/[a-f0-9]{64}$/.test(route)) route = '/invite/[token].html';
    else if (/^\/loan\/[a-f0-9-]{36}\/repayment$/.test(route)) route = '/loan/[id]/repayment.html';
    else if (/^\/loan\/[a-f0-9-]{36}$/.test(route)) route = '/loan/[id].html';
    else if (route === '/') route = '/index.html';
    else if (route === '/auth') route = '/auth/index.html';
    let file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep) || path.basename(file) === 'acceptance-build.json') {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
  } catch {
    res.writeHead(400).end();
  }
});
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE' ? 'Preview port is already in use' : 'Preview server failed',
  );
  process.exit(1);
});
server.listen(target.port, '127.0.0.1', () =>
  console.log(`${process.argv[2]}: http://127.0.0.1:${target.port}`),
);
// Open this URL in an ordinary browser. Leaving Playwright attached causes
// unattended native confirmation dialogs to be automatically dismissed.
