import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp/evolution';

interface EvolutionContact {
  id: string; // e.g. "5511999999999@s.whatsapp.net"
  name?: string;
  notify?: string;
  profilePictureUrl?: string;
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

    // Fetch WhatsApp config (must be Evolution API)
    // whatsapp_config uses user_id as identifier (not professional_id)
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

    // Call Evolution API: GET /chat/findContacts/{instance}
    const url = `${config.evolution_api_url}/chat/findContacts/${config.evolution_instance}`;
    const evolutionRes = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: config.evolution_api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!evolutionRes.ok) {
      const errorText = await evolutionRes.text();
      console.error('[import-whatsapp] Evolution API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch contacts from Evolution API', detail: errorText },
        { status: 502 }
      );
    }

    const evolutionContacts: EvolutionContact[] = await evolutionRes.json();

    // Fetch existing contact phones to detect duplicates
    const { data: existing } = await supabase
      .from('contacts')
      .select('phone')
      .eq('professional_id', professional.id);

    const existingPhones = new Set<string>(
      (existing ?? []).map((c) => c.phone?.replace(/\D/g, '') ?? '')
    );

    let imported = 0;
    let skipped = 0;
    const toInsert: { professional_id: string; name: string; phone: string; source: string }[] = [];

    for (const contact of evolutionContacts) {
      // Extract phone number from WhatsApp JID (e.g. "5511999999999@s.whatsapp.net")
      const rawPhone = contact.id.split('@')[0];
      if (!rawPhone || rawPhone.includes('-')) {
        // Skip group JIDs (contain hyphens)
        skipped++;
        continue;
      }

      const name = contact.name || contact.notify || rawPhone;

      // Normalise phone
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneForWhatsApp(rawPhone);
      } catch {
        skipped++;
        continue;
      }

      // Check duplicate
      if (existingPhones.has(normalizedPhone.replace(/\D/g, ''))) {
        skipped++;
        continue;
      }

      existingPhones.add(normalizedPhone.replace(/\D/g, ''));
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
      imported = toInsert.length;
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped: evolutionContacts.length - imported,
      total: evolutionContacts.length,
    });
  } catch (error: any) {
    console.error('[import-whatsapp] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
