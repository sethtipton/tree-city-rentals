import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const phase = process.argv[2];
if (!['before', 'after', 'local'].includes(phase)) throw new Error('Use before, after, or local.');
const directory = join('audit-reports/2026-10-21-search-fixes', phase);
mkdirSync(directory, { recursive: true });
const origin = phase === 'local' ? 'http://127.0.0.1:4187' : 'https://treecityrentals.com';
const targets = [{ name: 'home', path: '/' }, ...(phase === 'before' ? [] : [{ name: 'property', path: '/441-park/' }, { name: 'listing', path: '/469-carthage/main-unit/' }])];
const rows = [];
const scrub = value => value.replace(/([?&](?:token|access_token|key)=)[^&\s"'<>\\]+/gi, '$1REDACTED');
for (const target of targets) {
  for (const device of ['mobile', 'desktop']) {
    const count = device === 'mobile' ? 3 : phase === 'before' || target.name === 'property' ? 0 : 1;
    for (let run = 1; run <= count; run++) {
      const base = join(directory, `${target.name}-${device}-${run}`);
      const args = ['-y', 'lighthouse@13.5.0', origin + target.path, '--chrome-flags=--headless --disable-gpu --no-first-run', '--output=json', '--output=html', `--output-path=${base}`, '--only-categories=performance,seo', '--quiet'];
      if (device === 'desktop') args.push('--preset=desktop');
      execFileSync('npx', args, { env: { ...process.env, CHROME_PATH: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 150000 });
      for (const suffix of ['report.json', 'report.html']) { const path = `${base}.${suffix}`; writeFileSync(path, scrub(readFileSync(path, 'utf8'))); }
      const r = JSON.parse(readFileSync(`${base}.report.json`, 'utf8'));
      if (r.runtimeError) throw new Error(r.runtimeError.message);
      const row = { name: target.name, url: origin + target.path, device, run, file: `${base}.report.json`, version: r.lighthouseVersion, browser: r.environment.hostUserAgent, measuredAt: r.fetchTime, performance: r.categories.performance.score * 100, seo: r.categories.seo.score * 100, lcpMs: r.audits['largest-contentful-paint'].numericValue, cls: r.audits['cumulative-layout-shift'].numericValue, tbtMs: r.audits['total-blocking-time'].numericValue, bytes: r.audits['total-byte-weight'].numericValue };
      rows.push(row);
      console.info(JSON.stringify(row));
    }
  }
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const groups = [...new Set(rows.map(r => `${r.name}-${r.device}`))].map(key => {
  const group = rows.filter(r => `${r.name}-${r.device}` === key);
  return { name: group[0].name, url: group[0].url, device: group[0].device, runs: group.length, ...Object.fromEntries(['performance', 'seo', 'lcpMs', 'cls', 'tbtMs', 'bytes'].map(metric => [metric, median(group.map(r => r[metric]))])) };
});
writeFileSync(join(directory, 'summary.json'), `${JSON.stringify({ phase, rows, groups }, null, 2)}\n`);
