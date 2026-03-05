import { z } from 'zod';

/**
 * Zod schema for critical environment variables.
 * Validates presence at build/startup time to fail fast
 * instead of crashing at runtime with cryptic errors.
 *
 * Only includes vars that are truly required for the app to function.
 * Optional services (Stripe, Resend, etc.) are not required here.
 */

const serverEnvSchema = z.object({
  // Supabase (required for all DB operations)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Admin auth
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),

  // Cron protection
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates server-side environment variables.
 * Call during startup (e.g., instrumentation.ts or API routes).
 * Returns parsed env object or throws with descriptive error.
 */
export function validateServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Missing or invalid environment variables:\n${errors}`);
  }
  return result.data;
}

/**
 * Validates client-side (NEXT_PUBLIC_) environment variables.
 */
export function validateClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Missing or invalid client environment variables:\n${errors}`);
  }
  return result.data;
}
