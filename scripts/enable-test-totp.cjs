// Run only with the separate test project's credentials supplied securely as env.
// Never print credentials, run for live, or commit environment files.
const { cert, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId === 'time2pay-c5c5c' ||
      projectId !== process.env.TIME2PAY_TOTP_TEST_PROJECT_ID ||
      process.env.VERCEL_ENV === 'production') {
    throw Error('Only the explicitly isolated Time2Pay test project is allowed.');
  }
  const keyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!keyBase64 || !clientEmail) throw Error('Test credentials are required.');
  initializeApp({ credential: cert({ projectId, clientEmail,
    privateKey: Buffer.from(keyBase64, 'base64').toString('utf8') }) });
  const manager = getAuth().projectConfigManager();
  const before = await manager.getProjectConfig();
  const otherProviders = (before.multiFactorConfig?.providerConfigs ?? []).filter(p => !p.totpProviderConfig);
  await manager.updateProjectConfig({ multiFactorConfig: {
    ...before.multiFactorConfig,
    providerConfigs: [...otherProviders, { state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 0 } }],
  } });
  const after = await manager.getProjectConfig();
  if (!after.multiFactorConfig?.providerConfigs?.some(p => p.state === 'ENABLED' && p.totpProviderConfig)) {
    throw Error('TOTP configuration not confirmed.');
  }
  console.log('TOTP enabled and verified for the isolated test project.');
}
main().catch(() => { console.error('Test TOTP setup failed. Check the isolated project configuration and permissions.'); process.exitCode = 1; });
