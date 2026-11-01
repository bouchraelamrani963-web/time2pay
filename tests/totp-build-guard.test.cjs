const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('scripts/enable-test-totp.cjs', 'utf8');
const project = 'synthetic-isolated-project';
const enabled = {
  TIME2PAY_CONFIGURE_TEST_TOTP: 'true', VERCEL_ENV: 'preview',
  FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_PROJECT_ID: project,
  TIME2PAY_TOTP_TEST_PROJECT_ID: project,
  FIREBASE_TEST_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: project, client_email: `synthetic@${project}.iam.gserviceaccount.com`,
  }),
};
async function run(env) {
  let loads = 0, writes = 0;
  const messages = [], process = { env, exitCode: 0 };
  const manager = {
    getProjectConfig: async () => ({ multiFactorConfig: { providerConfigs: [
      { state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 0 } },
    ] } }),
    updateProjectConfig: async () => { writes++; },
  };
  vm.runInNewContext(source, { process,
    console: { log: (...args) => messages.push(args), error: (...args) => messages.push(args) },
    require: name => {
      loads++;
      if (name === 'firebase-admin/app') return { cert: value => value, initializeApp: () => ({}) };
      if (name === 'firebase-admin/auth') return { getAuth: () => ({ projectConfigManager: () => manager }) };
      throw Error('Unexpected dependency');
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { loads, writes, code: process.exitCode, messages };
}
test('disabled setup loads no Admin SDK even with production/test settings present', async () => {
  for (const flag of [undefined, 'false', 'TRUE']) {
    const result = await run({ ...enabled, VERCEL_ENV: 'production', TIME2PAY_CONFIGURE_TEST_TOTP: flag });
    assert.equal(result.code, 0); assert.equal(result.loads, 0); assert.equal(result.writes, 0);
  }
});
test('production, development and unspecified deployment contexts reject before Admin access', async () => {
  for (const context of ['production', 'development', undefined, '']) {
    const result = await run({ ...enabled, VERCEL_ENV: context });
    assert.equal(result.code, 1); assert.equal(result.loads, 0); assert.equal(result.writes, 0);
  }
});
test('known production project is rejected even when labeled preview', async () => {
  const result = await run({ ...enabled, FIREBASE_PROJECT_ID: 'time2pay-c5c5c',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-c5c5c', TIME2PAY_TOTP_TEST_PROJECT_ID: 'time2pay-c5c5c' });
  assert.equal(result.code, 1); assert.equal(result.loads, 0);
});
test('missing or mismatching server, client and isolated project IDs reject before Admin access', async () => {
  for (const key of ['FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'TIME2PAY_TOTP_TEST_PROJECT_ID']) {
    for (const value of [undefined, 'wrong-project']) {
      const result = await run({ ...enabled, [key]: value });
      assert.equal(result.code, 1); assert.equal(result.loads, 0);
    }
  }
});
test('invalid credentials fail without printing credential content', async () => {
  for (const credentials of ['invalid-secret-sentinel', JSON.stringify({ project_id: 'wrong', client_email: 'secret-sentinel' })]) {
    const result = await run({ ...enabled, FIREBASE_TEST_SERVICE_ACCOUNT_JSON: credentials });
    assert.equal(result.code, 1); assert.equal(result.loads, 0);
    assert.doesNotMatch(JSON.stringify(result.messages), /sentinel/);
  }
});
test('explicit matching preview setup can inspect an already-enabled synthetic provider without writing', async () => {
  const result = await run(enabled);
  assert.equal(result.code, 0); assert.equal(result.loads, 2); assert.equal(result.writes, 0);
});
