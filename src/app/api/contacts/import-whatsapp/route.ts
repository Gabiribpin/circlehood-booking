import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp/evolution';

// Allow up to 60s — needed for large contact lists (Evolution API can be slow)
export const maxDuration = 60;

// Evolution API v2 contact shape
interface EvolutionContact {
  remoteJid: string; // e.g. "5511999999999@s.whatsapp.net" or "...@g.us" (groups)
  pushName?: string;
  profilePicUrl?: string;
  // v1 fallback fields (some self-hosted instances still return these)
  id?: string;
  name?: string;
  notify?: string;
}

export async function POST(_request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch professional
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    // Fetch WhatsApp config (whatsapp_config uses user_id, not professional_id)
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('provider, evolution_api_url, evolution_api_key, evolution_instance, is_active')
      .eq('user_id', user.id)
      .single();

    if (!config || config.provider !== 'evolution') {
      return NextResponse.json(
        { error: 'Evolution API not configured' },
        { status: 400 }
      );
    }

    if (!config.evolution_api_url || !config.evolution_instance || !config.evolution_api_key) {
      return NextResponse.json(
        { error: 'Incomplete Evolution API configuration' },
        { status: 400 }
      );
    }

    // Normalise base URL (remove trailing slash to avoid double-slash)
    const baseUrl = config.evolution_api_url.replace(/\/+$/, '');
    const instance = config.evolution_instance;

    // Evolution API v2: POST /chat/findContacts/{instance} with empty body
    // GET also works on some versions; POST is more reliable across v1/v2
    const url = `${baseUrl}/chat/findContacts/${instance}`;
    console.log(`[import-whatsapp] Fetching contacts from: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000); // 55s — within maxDuration

    let evolutionRes: Response;
    try {
      evolutionRes = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: config.evolution_api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      const isTimeout = fetchError.name === 'AbortError';
      console.error('[import-whatsapp] Fetch error:', fetchError.message);
      return NextResponse.json(
        { error: isTimeout ? 'Evolution API timeout' : 'Failed to reach Evolution API', detail: fetchError.message },
        { status: 502 }
      );
    }
    clearTimeout(timeout);

    console.log(`[import-whatsapp] Evolution API status: ${evolutionRes.status}`);

    if (!evolutionRes.ok) {
      const errorText = await evolutionRes.text();
      console.error(`[import-whatsapp] Evolution API error (${evolutionRes.status}):`, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch contacts from Evolution API', detail: errorText, status: evolutionRes.status },
        { status: 502 }
      );
    }

    const rawBody = await evolutionRes.text();
    let evolutionContacts: EvolutionContact[];
    try {
      evolutionContacts = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[import-whatsapp] Failed to parse Evolution response:', rawBody.slice(0, 500));
      return NextResponse.json(
        { error: 'Invalid response from Evolution API', detail: rawBody.slice(0, 200) },
        { status: 502 }
      );
    }

    if (!Array.isArray(evolutionContacts)) {
      console.error('[import-whatsapp] Expected array, got:', typeof evolutionContacts, JSON.stringify(evolutionContacts).slice(0, 200));
      return NextResponse.json(
        { error: 'Unexpected Evolution API response format' },
        { status: 502 }
      );
    }

    console.log(`[import-whatsapp] Received ${evolutionContacts.length} contacts from Evolution API`);

    // Fetch existing contact phones to detect duplicates
    const { data: existing } = await supabase
      .from('contacts')
      .select('phone')
      .eq('professional_id', professional.id);

    const existingPhones = new Set<string>(
      (existing ?? []).map((c) => c.phone?.replace(/\D/g, '') ?? '')
    );

    let skipped = 0;
    const toInsert: { professional_id: string; name: string; phone: string; source: string }[] = [];

    for (const contact of evolutionContacts) {
      // Evolution API v2 uses remoteJid; v1 uses id — support both
      const jid = contact.remoteJid ?? contact.id ?? '';

      // Only process individual contacts (not groups)
      if (!jid.endsWith('@s.whatsapp.net')) {
        skipped++;
        continue;
      }

      const rawPhone = jid.split('@')[0];
      if (!rawPhone) {
        skipped++;
        continue;
      }

      // Name: v2 uses pushName; v1 uses name/notify
      const name = contact.pushName || contact.name || contact.notify || rawPhone;

      // Normalise phone
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneForWhatsApp(rawPhone);
      } catch {
        skipped++;
        continue;
      }

      // Check duplicate
      const digitsOnly = normalizedPhone.replace(/\D/g, '');
      if (existingPhones.has(digitsOnly)) {
        skipped++;
        continue;
      }

      existingPhones.add(digitsOnly);
      toInsert.push({
        professional_id: professional.id,
        name,
        phone: normalizedPhone,
        source: 'whatsapp',
      });
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('contacts').insert(toInsert);
      if (insertError) {
        console.error('[import-whatsapp] Insert error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const imported = toInsert.length;
    console.log(`[import-whatsapp] Done — imported: ${imported}, skipped: ${skipped}`);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: evolutionContacts.length,
    });
  } catch (error: any) {
    console.error('[import-whatsapp] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
