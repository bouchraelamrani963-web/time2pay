// Explicit integration rehearsal. Never run during a normal build or in Production.
// Only a newly created synthetic user may be modified or deleted by this script.
const assert = require('node:assert/strict');
const { randomBytes, createHmac } = require('node:crypto');

function checkEnvironment(env) {
  assert.equal(env.VERCEL_ENV, 'preview', 'Preview only');
  assert.equal(env.VERCEL_GIT_COMMIT_REF, 'codex/time2pay-stripe-test', 'Acceptance branch only');
  for (const name of ['FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'TIME2PAY_TOTP_TEST_PROJECT_ID']) {
    assert.equal(env[name], 'time2pay-preview', 'Isolated project only');
  }
  assert.equal(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'time2pay-preview.firebaseapp.com');
  assert.ok(env.NEXT_PUBLIC_FIREBASE_API_KEY && env.NEXT_PUBLIC_FIREBASE_APP_ID);
  const credential = JSON.parse(env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON || 'null');
  assert.equal(credential?.project_id, 'time2pay-preview');
  assert.ok(credential.client_email?.endsWith('@time2pay-preview.iam.gserviceaccount.com'));
  assert.ok(credential.private_key?.startsWith('-----BEGIN PRIVATE KEY-----'));
  return credential;
}

function totp(secret, now = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    const n = alphabet.indexOf(char); assert.ok(n >= 0);
    bits += n.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

async function freshCode(secret) {
  const remaining = 30000 - Date.now() % 30000;
  if (remaining < 4000) await new Promise(resolve => setTimeout(resolve, remaining + 500));
  return totp(secret);
}

function actionCode(link) {
  const url = new URL(link);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'time2pay-preview.firebaseapp.com');
  const code = url.searchParams.get('oobCode'); assert.ok(code); return code;
}

async function run(env = process.env) {
  const credential = checkEnvironment(env); // Must precede any SDK initialization/network call.
  const { cert, initializeApp, deleteApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const client = require('firebase/app'), auth = require('firebase/auth');
  const adminApp = initializeApp({ credential: cert(credential) }, 'isolated-reset-rehearsal');
  const admin = getAuth(adminApp);
  const clientApp = client.initializeApp({ apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID, projectId: 'time2pay-preview',
    authDomain: 'time2pay-preview.firebaseapp.com' }, 'isolated-reset-rehearsal');
  const sdk = auth.initializeAuth(clientApp, { persistence: auth.inMemoryPersistence });
  const email = 'delivered@resend.dev';
  const uid = 'time2pay-reset-rehearsal-' + randomBytes(12).toString('hex');
  const oldPassword = 'Aa9!' + randomBytes(24).toString('base64url');
  const newPassword = 'Bb8!' + randomBytes(24).toString('base64url');
  let created = false;
  try {
    // Never reuse or overwrite a test account that was present before this run.
    await assert.rejects(admin.getUserByEmail(email), error => error.code === 'auth/user-not-found');
    await admin.createUser({ uid, email, password: oldPassword, emailVerified: false,
      displayName: 'Disposable Time2Pay reset rehearsal' });
    created = true;
    console.log('T2P_PREVIEW_RESET_USER_CREATED');
    const initial = await auth.signInWithEmailAndPassword(sdk, email, oldPassword);
    assert.equal(initial.user.uid, uid); // Also checks the actual client API key's project binding.
    await auth.sendEmailVerification(initial.user);
    console.log('T2P_PREVIEW_VERIFICATION_MAIL_ACCEPTED');
    // Admin-generated links stay in memory. This tests the real handler, not inbox delivery.
    await auth.applyActionCode(sdk, actionCode(await admin.generateEmailVerificationLink(email)));
    await auth.reload(initial.user);
    assert.equal(initial.user.emailVerified, true);
    console.log('T2P_PREVIEW_EMAIL_VERIFIED');
    const mfa = auth.multiFactor(initial.user);
    const secret = await auth.TotpMultiFactorGenerator.generateSecret(await mfa.getSession());
    await mfa.enroll(auth.TotpMultiFactorGenerator.assertionForEnrollment(secret, await freshCode(secret.secretKey)), 'Rehearsal authenticator');
    const before = (await admin.getUser(uid)).multiFactor.enrolledFactors.map(f => f.uid);
    assert.equal(before.length, 1);
    await auth.signOut(sdk);
    console.log('T2P_PREVIEW_TOTP_ENROLLED');
    await auth.sendPasswordResetEmail(sdk, email);
    console.log('T2P_PREVIEW_RESET_MAIL_ACCEPTED');
    const resetCode = actionCode(await admin.generatePasswordResetLink(email));
    assert.equal(await auth.verifyPasswordResetCode(sdk, resetCode), email);
    await auth.confirmPasswordReset(sdk, resetCode, newPassword);
    await assert.rejects(auth.verifyPasswordResetCode(sdk, resetCode), error =>
      ['auth/invalid-action-code', 'auth/expired-action-code'].includes(error.code));
    console.log('T2P_PREVIEW_RESET_CODE_USED_ONCE');
    await assert.rejects(auth.signInWithEmailAndPassword(sdk, email, oldPassword), error =>
      ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password'].includes(error.code));
    assert.deepEqual((await admin.getUser(uid)).multiFactor.enrolledFactors.map(f => f.uid), before);
    console.log('T2P_PREVIEW_OLD_PASSWORD_REJECTED_TOTP_PRESERVED');
    let challenge;
    try { await auth.signInWithEmailAndPassword(sdk, email, newPassword); }
    catch (error) { assert.equal(error.code, 'auth/multi-factor-auth-required'); challenge = error; }
    assert.ok(challenge, 'New password must still require TOTP');
    const resolver = auth.getMultiFactorResolver(sdk, challenge);
    const factor = resolver.hints.find(f => f.factorId === 'totp'); assert.ok(factor);
    const signedIn = await resolver.resolveSignIn(auth.TotpMultiFactorGenerator.assertionForSignIn(factor.uid, await freshCode(secret.secretKey)));
    assert.equal(signedIn.user.uid, uid);
    console.log('T2P_PREVIEW_NEW_PASSWORD_AND_TOTP_OK');
    const token = await signedIn.user.getIdToken(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    await admin.revokeRefreshTokens(uid);
    await assert.rejects(admin.verifyIdToken(token, true), error => error.code === 'auth/id-token-revoked');
    console.log('T2P_PREVIEW_SESSION_REVOCATION_OK');
  } finally {
    try {
      await auth.signOut(sdk);
      if (created) {
        const record = await admin.getUser(uid);
        assert.equal(record.uid, uid); assert.equal(record.email, email);
        await admin.deleteUser(uid); // Only the exact synthetic user created above.
        console.log('T2P_PREVIEW_RESET_USER_REMOVED');
      }
    } finally {
      await client.deleteApp(clientApp); await deleteApp(adminApp);
    }
  }
  console.log('T2P_PREVIEW_PASSWORD_RESET_REHEARSAL_OK');
}

module.exports = { checkEnvironment, totp };
if (require.main === module) run().catch(error => {
  // Never print passwords, action links, TOTP secrets, tokens, credentials or provider payloads.
  console.error('T2P_PREVIEW_PASSWORD_RESET_REHEARSAL_FAILED', error.code || error.name || 'UNKNOWN');
  process.exitCode = 1;
});
