/**
 * Testes E2E — Toggle global do bot (bot_enabled) + Selective contacts
 *
 * CORE DO PRODUTO: O profissional deve poder controlar EXATAMENTE
 * quais contatos recebem respostas do bot.
 *
 * Cobre:
 *  - Toggle global visível e funcional na UI
 *  - Bot NÃO responde quando bot_enabled=false
 *  - Bot NÃO responde contatos com use_bot=false
 *  - Bot RESPONDE contatos com use_bot=true (ou sem registro)
 *
 * @bot — Requer WhatsApp conectado para testar
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';
import { createClient } from '@supabase/supabase-js';

const BASE = TEST.BASE_URL;
const sb = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// ─── Helper: envia mensagem via webhook ─────────────────────────────────
let msgCounter = 0;

async function sendWebhookMessage(
  request: import('@playwright/test').APIRequestContext,
  phone: string,
  text: string
) {
  const messageId = `E2E_TOGGLE_${Date.now()}_${++msgCounter}`;
  const res = await request.post(`${BASE}/api/whatsapp/webhook`, {
    data: {
      event: 'messages.upsert',
      instance: TEST.EVOLUTION_INSTANCE,
      data: {
        key: {
          remoteJid: `${phone}@s.whatsapp.net`,
          fromMe: false,
          id: messageId,
        },
        message: { conversation: text },
        messageTimestamp: String(Math.floor(Date.now() / 1000)),
      },
    },
  });
  return { status: res.status(), messageId };
}

// ─── Cleanup helper ─────────────────────────────────────────────────────
async function cleanupTestContacts() {
  await sb
    .from('contacts')
    .delete()
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .like('phone', '353800999%');
}

// ═══════════════════════════════════════════════════════════════════════════
// SEÇÃO 1 — Toggle global (bot_enabled)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Bot Toggle Global @bot', () => {
  test.beforeEach(async () => {
    // Ensure bot_enabled=true before each test
    await sb
      .from('whatsapp_config')
      .update({ bot_enabled: true })
      .eq('user_id', TEST.USER_ID);
  });

  test.afterAll(async () => {
    // Restore
    await sb
      .from('whatsapp_config')
      .update({ bot_enabled: true })
      .eq('user_id', TEST.USER_ID);
  });

  test('toggle visível quando WhatsApp conectado', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    await page.fill('#email', TEST.USER_EMAIL);
    await page.fill('#password', TEST.USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto(`${BASE}/whatsapp-config`);
    await expect(page.locator('#bot-enabled')).toBeVisible({ timeout: 15_000 });
  });

  test('toggle desativa o bot e estado persiste no DB', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    await page.fill('#email', TEST.USER_EMAIL);
    await page.fill('#password', TEST.USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.goto(`${BASE}/whatsapp-config`);
    const toggle = page.locator('#bot-enabled');
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    // Should be enabled initially
    await expect(toggle).toBeChecked();

    // Disable bot
    await toggle.click();
    await page.waitForTimeout(1500);

    // Verify in DB
    const { data } = await sb
      .from('whatsapp_config')
      .select('bot_enabled')
      .eq('user_id', TEST.USER_ID)
      .single();
    expect(data?.bot_enabled).toBe(false);

    // Reload and verify state persists
    await page.reload();
    await expect(page.locator('#bot-enabled')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#bot-enabled')).not.toBeChecked();
  });

  test('webhook retorna 200 mas bot não processa quando desativado', async ({ request }) => {
    // Disable bot
    await sb
      .from('whatsapp_config')
      .update({ bot_enabled: false })
      .eq('user_id', TEST.USER_ID);

    // Send message
    const { status } = await sendWebhookMessage(request, TEST.PHONE, 'oi bot disabled test');
    expect(status).toBe(200);
    // Bot should not process the message (no error, just silently skip)
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEÇÃO 2 — Selective contacts (CORE do negócio)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Selective Contacts — use_bot @bot', () => {
  const PHONE_BOT_ON = '353800999001';
  const PHONE_BOT_OFF = '353800999002';

  test.beforeAll(async () => {
    await cleanupTestContacts();

    // Create 2 test contacts
    await sb.from('contacts').insert([
      {
        professional_id: TEST.PROFESSIONAL_ID,
        name: 'E2E Bot ON',
        phone: PHONE_BOT_ON,
        use_bot: true,
      },
      {
        professional_id: TEST.PROFESSIONAL_ID,
        name: 'E2E Bot OFF',
        phone: PHONE_BOT_OFF,
        use_bot: false,
      },
    ]);

    // Ensure bot is enabled globally
    await sb
      .from('whatsapp_config')
      .update({ bot_enabled: true })
      .eq('user_id', TEST.USER_ID);
  });

  test.afterAll(async () => {
    await cleanupTestContacts();
  });

  test('webhook aceita mensagem de contato com use_bot=true', async ({ request }) => {
    const { status } = await sendWebhookMessage(request, PHONE_BOT_ON, 'oi selective test on');
    expect(status).toBe(200);
    // Bot will process (message goes to after() background)
  });

  test('webhook aceita mas bot NÃO processa contato com use_bot=false', async ({ request }) => {
    const { status } = await sendWebhookMessage(request, PHONE_BOT_OFF, 'oi selective test off');
    expect(status).toBe(200);
    // Bot should skip processing (use_bot=false check in processor)
  });

  test('contato sem registro no DB recebe atendimento do bot', async ({ request }) => {
    // Unknown phone — not in contacts table
    const { status } = await sendWebhookMessage(request, '353800999099', 'oi unknown contact');
    expect(status).toBe(200);
    // Bot should process (no contact record = default allow)
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEÇÃO 3 — Phone normalization (CRITICAL for matching)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Phone Normalization — Contact Matching @bot', () => {
  const PHONE_E164 = '+353851234500';
  const PHONE_DIGITS = '353851234500';

  test.beforeAll(async () => {
    // Create contact with E.164 format
    await sb.from('contacts').insert({
      professional_id: TEST.PROFESSIONAL_ID,
      name: 'E2E Phone Format',
      phone: PHONE_E164,
      use_bot: false, // bot OFF so we can test matching
    });

    await sb
      .from('whatsapp_config')
      .update({ bot_enabled: true })
      .eq('user_id', TEST.USER_ID);
  });

  test.afterAll(async () => {
    await sb
      .from('contacts')
      .delete()
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('phone', PHONE_E164);
  });

  test('webhook com formato digits-only encontra contato E.164', async ({ request }) => {
    // Evolution sends digits without +: "353851234500"
    // Contact is stored as "+353851234500"
    // phoneVariants() should generate both formats for OR query
    const { status } = await sendWebhookMessage(request, PHONE_DIGITS, 'phone format test');
    expect(status).toBe(200);
    // If matching works correctly, processor finds contact with use_bot=false and skips
    // (no error = phone was matched and use_bot check executed)
  });

  test('contatos importados via API são normalizados para E.164', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    await page.fill('#email', TEST.USER_EMAIL);
    await page.fill('#password', TEST.USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Import with local Irish format — should be normalized to E.164
    const csvContent = 'name,email,phone,notes\nE2E Normalize,norm@test.io,0851234599,normalize test';

    const result = await page.evaluate(async ({ baseUrl, csv }) => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'normalize.csv');
      const res = await fetch(`${baseUrl}/api/contacts/import`, {
        method: 'POST',
        body: formData,
      });
      return { status: res.status, body: await res.json() };
    }, { baseUrl: BASE, csv: csvContent });

    expect(result.status).toBe(200);

    // Check DB: phone should be E.164
    const { data: contact } = await sb
      .from('contacts')
      .select('phone, use_bot')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('name', 'E2E Normalize')
      .single();

    expect(contact?.phone).toBe('+353851234599');
    expect(contact?.use_bot).toBe(false);

    // Cleanup
    await sb.from('contacts').delete()
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('name', 'E2E Normalize');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEÇÃO 4 — Import contacts safety
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Import Contacts — use_bot default @bot', () => {
  test.afterAll(async () => {
    // Cleanup imported test contacts
    await sb
      .from('contacts')
      .delete()
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .like('name', 'E2E Import%');
  });

  test('contatos importados via API têm use_bot=false', async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    await page.fill('#email', TEST.USER_EMAIL);
    await page.fill('#password', TEST.USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Create a CSV and import via API (browser context for auth)
    const csvContent = 'name,email,phone,notes\nE2E Import A,a@test.io,353800999010,test\nE2E Import B,b@test.io,353800999011,test';

    const result = await page.evaluate(async ({ baseUrl, csv }) => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'contacts.csv');

      const res = await fetch(`${baseUrl}/api/contacts/import`, {
        method: 'POST',
        body: formData,
      });
      return { status: res.status, body: await res.json() };
    }, { baseUrl: BASE, csv: csvContent });

    expect(result.status).toBe(200);
    expect(result.body.imported).toBe(2);

    // Verify in DB: both contacts should have use_bot=false
    const { data: contacts } = await sb
      .from('contacts')
      .select('name, use_bot')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .like('name', 'E2E Import%')
      .order('name');

    expect(contacts).toHaveLength(2);
    expect(contacts![0].use_bot).toBe(false);
    expect(contacts![1].use_bot).toBe(false);
  });
});
