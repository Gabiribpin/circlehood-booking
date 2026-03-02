import { getRedisEnv } from './redis/prefix';

/**
 * Valida consistência entre ambiente Vercel e banco Supabase.
 * Impede que production use staging DB e vice-versa.
 * Chamar no startup da aplicação (ex: instrumentation.ts ou layout.tsx).
 */
export function validateEnvironment(): void {
  const env = getRedisEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  // Extrair project ref do URL (ex: "cuwhyixgkfhioubejtaw" de "https://cuwhyixgkfhioubejtaw.supabase.co")
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1] || 'unknown';

  const productionRef = process.env.SUPABASE_PRODUCTION_REF;

  console.log(
    `[env] environment=${env} database=${projectRef} redis-prefix=${env}`
  );

  if (!productionRef) return; // Sem ref configurado, não consegue validar

  const isProductionDb = projectRef === productionRef;

  // Bloqueio absoluto: preview/staging apontando para production DB
  if (env === 'preview' && isProductionDb) {
    throw new Error(
      `[env] BLOQUEADO: ambiente "${env}" está apontando para o banco de PRODUÇÃO (${projectRef}). ` +
        'Configure NEXT_PUBLIC_SUPABASE_URL para o projeto staging.'
    );
  }

  // Aviso: production apontando para staging DB
  if (env === 'production' && !isProductionDb) {
    console.warn(
      `[env] ⚠️ AVISO: ambiente "production" está usando banco não-production (${projectRef}). ` +
        'Verifique NEXT_PUBLIC_SUPABASE_URL.'
    );
  }
}
