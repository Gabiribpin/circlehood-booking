/**
 * Environment validation — blocks deployment if configuration is inconsistent.
 *
 * Called from instrumentation.ts at server startup.
 * Prevents catastrophic misconfigurations like production running against staging DB.
 */

const REQUIRED_PRODUCTION = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EVOLUTION_WEBHOOK_STRICT',
];

const REQUIRED_ALL = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export function validateEnvironment() {
  const env = process.env.NODE_ENV ?? 'development';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  // CRITICAL: Never allow production with staging database
  if (env === 'production' && supabaseUrl.includes('staging')) {
    throw new Error(
      'FATAL: Production environment detected with staging database URL. Deployment blocked.'
    );
  }

  // CRITICAL: Webhook strict mode required in production
  if (env === 'production' && process.env.EVOLUTION_WEBHOOK_STRICT !== 'true') {
    console.warn(
      '[env-validation] WARNING: EVOLUTION_WEBHOOK_STRICT is not "true" in production. ' +
      'Webhook requests without auth headers will be accepted.'
    );
  }

  // Check required env vars
  const required = env === 'production' ? REQUIRED_PRODUCTION : REQUIRED_ALL;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && env === 'production') {
    throw new Error(`Missing required env vars in ${env}: ${missing.join(', ')}`);
  } else if (missing.length > 0) {
    console.warn(`[env-validation] Missing env vars in ${env} (non-fatal): ${missing.join(', ')}`);
  }
}
