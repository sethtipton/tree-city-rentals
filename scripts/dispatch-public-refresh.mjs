import { execFileSync } from 'node:child_process';

// Do not cancel a code deployment, or repeatedly dispatch while one is queued.
const runs = JSON.parse(execFileSync('gh', ['run', 'list', '--workflow', 'deploy-pages.yml', '--limit', '30', '--json', 'status'], { encoding: 'utf8' }));
if (runs.some(run => run.status !== 'completed')) {
  console.info('A Pages release is already pending; the next content check will retry.');
} else {
  execFileSync('gh', ['workflow', 'run', 'deploy-pages.yml', '--ref', 'main'], { stdio: 'inherit' });
  console.info('Requested a Pages release for changed public listings.');
}
