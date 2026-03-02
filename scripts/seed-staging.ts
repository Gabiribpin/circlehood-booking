/**
 * Seed script for staging environment.
 *
 * Creates a test professional with services, working hours, WhatsApp config,
 * and contacts so E2E tests can run against the staging deployment.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=<staging> SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/seed-staging.ts
 *
 * Or with .env.staging:
 *   npx dotenv -e .env.staging -- npx tsx scripts/seed-staging.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SEED_EMAIL = 'rita@teste.com';
const SEED_PASSWORD = 'Teste1234';
const SEED_SLUG = 'salao-da-rita-staging';

async function seed() {
  console.log('Seeding staging database...');
  console.log(`  Supabase: ${SUPABASE_URL}`);

  // ── 1. Create auth user ─────────────────────────────────────────
  let userId: string;

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === SEED_EMAIL);

  if (existing) {
    userId = existing.id;
    console.log(`  Auth user already exists: ${userId}`);
  } else {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Salao da Rita', role: 'professional' },
    });

    if (authError) throw new Error(`Auth user creation failed: ${authError.message}`);
    userId = authData.user.id;
    console.log(`  Auth user created: ${userId}`);
  }

  // ── 2. Create professional profile ──────────────────────────────
  const { data: existingProf } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let professionalId: string;

  if (existingProf) {
    professionalId = existingProf.id;
    console.log(`  Professional already exists: ${professionalId}`);
  } else {
    const { data: prof, error: profError } = await supabase
      .from('professionals')
      .insert({
        user_id: userId,
        business_name: 'Salao da Rita',
        slug: SEED_SLUG,
        email: SEED_EMAIL,
        category: 'hair',
        city: 'Dublin',
        country: 'IE',
        currency: 'eur',
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (profError) throw new Error(`Professional creation failed: ${profError.message}`);
    professionalId = prof.id;
    console.log(`  Professional created: ${professionalId}`);
  }

  // ── 3. Create service ───────────────────────────────────────────
  const { data: existingSvc } = await supabase
    .from('services')
    .select('id')
    .eq('professional_id', professionalId)
    .limit(1)
    .maybeSingle();

  if (existingSvc) {
    console.log(`  Service already exists: ${existingSvc.id}`);
  } else {
    const { error: svcError } = await supabase.from('services').insert([
      {
        professional_id: professionalId,
        name: 'Corte de Cabelo',
        duration_minutes: 60,
        price: 50,
        is_active: true,
        sort_order: 1,
      },
      {
        professional_id: professionalId,
        name: 'Escova',
        duration_minutes: 45,
        price: 35,
        is_active: true,
        sort_order: 2,
      },
    ]);

    if (svcError) throw new Error(`Service creation failed: ${svcError.message}`);
    console.log('  2 services created');
  }

  // ── 4. Create working hours (Mon-Fri 09:00-18:00) ──────────────
  const { data: existingHours } = await supabase
    .from('working_hours')
    .select('id')
    .eq('professional_id', professionalId)
    .limit(1)
    .maybeSingle();

  if (existingHours) {
    console.log('  Working hours already exist');
  } else {
    const days = [1, 2, 3, 4, 5]; // Mon-Fri
    const { error: hoursError } = await supabase.from('working_hours').insert(
      days.map((day) => ({
        professional_id: professionalId,
        day_of_week: day,
        start_time: '09:00',
        end_time: '18:00',
        is_available: true,
      }))
    );

    if (hoursError) throw new Error(`Working hours creation failed: ${hoursError.message}`);
    console.log('  Working hours created (Mon-Fri 09:00-18:00)');
  }

  // ── 5. Create WhatsApp config ───────────────────────────────────
  const { data: existingWa } = await supabase
    .from('whatsapp_config')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingWa) {
    console.log(`  WhatsApp config already exists: ${existingWa.id}`);
  } else {
    const { error: waError } = await supabase.from('whatsapp_config').insert({
      user_id: userId,
      professional_id: professionalId,
      evolution_instance: `prof-${userId.substring(0, 12).replace(/-/g, '')}`,
      evolution_api_url: process.env.EVOLUTION_API_URL ?? 'https://evo.placeholder.test',
      evolution_api_key: process.env.EVOLUTION_API_KEY ?? 'staging-key-placeholder',
      is_active: false,
      bot_enabled: true,
      webhook_secret: crypto.randomUUID(),
    });

    if (waError) throw new Error(`WhatsApp config creation failed: ${waError.message}`);
    console.log('  WhatsApp config created');
  }

  // ── 6. Create test contacts ─────────────────────────────────────
  const { count: contactCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('professional_id', professionalId);

  if (contactCount && contactCount > 0) {
    console.log(`  Contacts already exist (${contactCount})`);
  } else {
    const { error: contactError } = await supabase.from('contacts').insert([
      { professional_id: professionalId, name: 'Cliente Teste A', phone: '+353851111111', use_bot: true },
      { professional_id: professionalId, name: 'Cliente Teste B', phone: '+353852222222', use_bot: false },
      { professional_id: professionalId, name: 'Familia Teste', phone: '+353853333333', use_bot: false },
    ]);

    if (contactError) throw new Error(`Contact creation failed: ${contactError.message}`);
    console.log('  3 contacts created (1 bot=true, 2 bot=false)');
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\nStaging seed complete!');
  console.log(`  Email: ${SEED_EMAIL}`);
  console.log(`  Password: ${SEED_PASSWORD}`);
  console.log(`  Slug: ${SEED_SLUG}`);
  console.log(`  Professional ID: ${professionalId}`);
  console.log(`  User ID: ${userId}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
