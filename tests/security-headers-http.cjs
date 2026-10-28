// Exercise real HTTP responses from the built application, not a config mock.
// Only a disposable CI environment may run this local server.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

async function run() {
  assert.equal(process.env.CI, 'true', 'Disposable CI only');
  assert.notEqual(process.env.VERCEL_ENV, 'production', 'Never Production');
  assert.match(process.env.DATABASE_URL || '', /^postgresql:\/\/recovery_ci:disposable_ci_only@127\.0\.0\.1:5432\/time2pay_recovery_ci$/);
  const server = spawn(process.execPath,
    [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '0'],
    { env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(server, 'exit');
  let origin;
  try {
    origin = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Local server readiness timeout')), 30000);
      let output = '';
      server.stdout.on('data', data => {
        output = (output + data.toString()).slice(-4000);
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match && /Ready/.test(output)) {
          clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`);
        }
      });
      server.on('error', error => { clearTimeout(timeout); reject(error); });
      server.on('exit', () => { clearTimeout(timeout); reject(new Error('Local server exited before readiness')); });
      // Drain stderr without copying potentially sensitive environment diagnostics.
      server.stderr.on('data', () => {});
    });
    for (const path of ['/login', '/forgot-password', '/recover', '/api/auth/session']) {
      const response = await fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200, `Unexpected status on ${path}`);
      const policy = response.headers.get('content-security-policy'); assert.ok(policy);
      const directives = new Map(policy.split(';').map(d => {
        const [name, ...values] = d.trim().split(/\s+/); return [name, values];
      }));
      assert.deepEqual(directives.get('frame-ancestors'), ["'none'"]);
      assert.deepEqual(directives.get('form-action'), ["'self'"]);
      assert.deepEqual(directives.get('base-uri'), ["'self'"]);
      assert.deepEqual(directives.get('object-src'), ["'none'"]);
      // Firebase Auth and Next.js remain supported; strict script/network CSP
      // needs a separately tested nonce/origin policy, rather than an unsafe guess.
      assert.equal(directives.has('default-src'), false);
      assert.equal(directives.has('connect-src'), false);
      assert.equal(directives.has('script-src'), false);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.equal(response.headers.has('x-powered-by'), false);
      assert.equal(new URL(response.url).origin, origin);
      await response.text();
      console.log('SECURITY_HEADERS_HTTP_OK', path);
    }
  } finally {
    server.kill('SIGTERM');
    await Promise.race([exited, new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { server.kill('SIGKILL'); reject(new Error('Local server did not stop')); }, 5000);
      exited.then(() => { clearTimeout(timeout); resolve(); }, reject);
    })]);
  }
}
run().catch(error => { console.error('SECURITY_HEADERS_HTTP_FAILED', error.name); process.exitCode = 1; });
