// Runs the whole browser test suite in sequence and prints a summary.
// Needs: dev server on :5173 (`npm run dev`) for the debug-API suites, and optionally
// `npm run build && npm run preview` on :4173 for the production smoke test.
// usage: node tests/e2e/run-e2e.mjs [--no-prod] [--gallery]
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const suites = [
  ['UI layout audit (3 resolutions)', ['tests/e2e/ui-audit.mjs']],
  ['Functional checks', ['tests/e2e/functional.mjs']],
  ['Playthrough: good ending @1920x1080', ['tests/e2e/playthrough.mjs', 'good', 'PTGOOD', '1920x1080']],
  ['Playthrough: bad ending @1366x768', ['tests/e2e/playthrough.mjs', 'bad', 'PTBAD', '1366x768']],
  ['Playthrough: secret ending @2560x1440', ['tests/e2e/playthrough.mjs', 'secret', 'PTSECRET', '2560x1440']],
];
if (args.includes('--gallery')) suites.push(['Anomaly screenshot gallery', ['tests/e2e/anomaly-gallery.mjs']]);
if (!args.includes('--no-prod')) suites.push(['Production smoke (vite preview)', ['tests/e2e/prod-smoke.mjs']]);

const summary = [];
for (const [name, argv] of suites) {
  console.log(`\n=== ${name} ===`);
  const t = Date.now();
  const r = spawnSync(process.execPath, argv, { stdio: 'inherit' });
  summary.push({ name, ok: r.status === 0, sec: ((Date.now() - t) / 1000).toFixed(0) });
}
console.log('\n=== summary ===');
for (const s of summary) console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.name} (${s.sec}s)`);
process.exit(summary.every((s) => s.ok) ? 0 : 1);
