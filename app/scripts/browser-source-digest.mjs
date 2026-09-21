import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Prove that browser acceptance exercises the current source, not yesterday's
// export. No .env or credentials enter the digest inputs or the build manifest.
export function browserSourceDigest() {
  const hash = createHash('sha256');
  function add(file) {
    if (!existsSync(file)) return;
    hash
      .update(file.replaceAll(path.sep, '/'))
      .update('\0')
      .update(readFileSync(file))
      .update('\0');
  }
  function walk(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (!/\.test\./.test(entry.name)) add(file);
    }
  }
  walk('src');
  walk('assets');
  for (const file of [
    'app.config.js',
    'app.json',
    'metro.config.js',
    'babel.config.js',
    'tsconfig.json',
    'package.json',
    'package-lock.json',
  ])
    add(file);
  return hash.digest('hex');
}
