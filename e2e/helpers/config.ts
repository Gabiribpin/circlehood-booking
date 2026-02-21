/**
 * Constantes de teste — Salão da Rita (conta de teste permanente)
 */
export const TEST = {
  BASE_URL: process.env.TEST_BASE_URL ?? 'https://circlehood-booking.vercel.app',
  USER_ID: '4aa855dd-5c8d-4905-b51d-7671fc4a3b5b',
  PROFESSIONAL_ID: 'e8c8391f-22c0-4dbf-b0b2-718bb2b40974',
  PHONE: '353830326180',
  EVOLUTION_INSTANCE: 'prof-4aa855dd5c8d',
  CRON_SECRET: process.env.CRON_SECRET ?? '',
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  REDIS_URL: process.env.REDIS_URL ?? '',
};
