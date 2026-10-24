// Run only with the separate test project's credentials supplied securely as env.
// Never print credentials, run for live, or commit environment files.
const { cert, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
async function main() {
  if (process.env.TIME2PAY_CONFIGURE_TEST_TOTP !== "true") return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId === 'time2pay-c5c5c' ||
      projectId !== process.env.TIME2PAY_TOTP_TEST_PROJECT_ID ||
      process.env.VERCEL_ENV === 'production') {
    throw Error('Only the explicitly isolated Time2Pay test project is allowed.');
  }
  const credentials = JSON.parse(process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON || 'null');
  if (!credentials || credentials.project_id !== projectId ||
      typeof credentials.client_email !== 'string' ||
      !credentials.client_email.endsWith(`@${projectId}.iam.gserviceaccount.com`)) {
    throw Error('Test credentials are required.');
  }
  const app = initializeApp({ credential: cert(credentials) }, 'time2pay-totp-config');
  const manager = getAuth(app).projectConfigManager();
  const before = await manager.getProjectConfig();
  const otherProviders = (before.multiFactorConfig?.providerConfigs ?? []).filter(p => !p.totpProviderConfig);
  const current = before.multiFactorConfig?.providerConfigs?.find(p => p.totpProviderConfig);
  if (current?.state === 'ENABLED' && current.totpProviderConfig.adjacentIntervals === 0) {
    console.log('Isolated test TOTP configuration already verified.'); return;
  }
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
main().catch(error => {
  const safeCode = typeof error?.code === 'string' ? error.code :
    (error instanceof SyntaxError ? 'INVALID_JSON' : 'UNCLASSIFIED');
  console.error('Test TOTP setup failed. Code:', safeCode, 'Check the isolated project configuration and permissions.');
  process.exitCode = 1;
});
