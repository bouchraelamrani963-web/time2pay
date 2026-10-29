// Public synthetic values only. No Firebase/Neon/Resend credential is usable.
module.exports.productionRecoveryEnv={
 VERCEL_ENV:'production',TIME2PAY_RECOVERY_ENABLED:'true',TIME2PAY_RECOVERY_DATABASE_ID:'time2pay-production',
 TIME2PAY_REQUIRE_TOTP:'true',TIME2PAY_TOTP_SETUP_ENABLED:'true',
 FIREBASE_PROJECT_ID:'time2pay-c5c5c',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-c5c5c',
 FIREBASE_CLIENT_EMAIL:'synthetic@time2pay-c5c5c.iam.gserviceaccount.com',
 FIREBASE_PRIVATE_KEY_BASE64:'synthetic-not-a-key',NEXT_PUBLIC_FIREBASE_API_KEY:'synthetic-public-key',
 DATABASE_URL:'postgresql://synthetic:synthetic@ep-withered-flower-alwyxd3z-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require',
 DIRECT_URL:'postgresql://synthetic:synthetic@ep-withered-flower-alwyxd3z.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require',
 TIME2PAY_RECOVERY_HASH_SECRET:'synthetic-hash-secret-never-use-in-an-account-123456789',
 CRON_SECRET:'synthetic-different-cron-secret-never-use-in-production-123456789',
 TIME2PAY_SECURITY_NOTICES_ENABLED:'true',RESEND_API_KEY:'synthetic-not-a-resend-key',
 INVOICE_FROM_EMAIL:'Time2Pay <synthetic@time2pay.nl>'
};
