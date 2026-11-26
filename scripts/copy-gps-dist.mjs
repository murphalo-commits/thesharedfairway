import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const builtHtmlPath = path.join(root, 'dist-gps', 'gps-entry.html');

if (!fs.existsSync(builtHtmlPath)) {
  console.error(`Missing built GPS bundle at ${builtHtmlPath}`);
  process.exit(1);
}

const html = fs.readFileSync(builtHtmlPath, 'utf8');
const gpsDir = path.join(root, 'gps');
fs.mkdirSync(gpsDir, { recursive: true });

const targets = [
  path.join(gpsDir, 'index.html'),
  path.join(root, 'gps.html'),
];

for (const target of targets) {
  fs.writeFileSync(target, html, 'utf8');
  console.log(`Copied standalone GPS bundle -> ${path.relative(root, target)} (${(html.length / 1024).toFixed(1)} KB)`);
}
