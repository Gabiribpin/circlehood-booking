import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const BATCH_SIZE = 30; // max mensagens por execução (evitar timeout)

export async function POST(request: NextRequest) {
  // Verificar autorização do cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;

  try {
    // 1. Buscar envios pendentes com scheduled_for expirado
    //    Fazer join direto para obter config do WhatsApp em uma query
    const { data: pendingSends, error: fetchError } = await supabase
      .from('campaign_sends')
      .select(`
        id,
        campaign_id,
        phone,
        name,
        campaigns!inner (
          message,
          professional_id,
          professionals!inner (
            user_id
          )
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[campaign-cron] Erro ao buscar envios:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingSends || pendingSends.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: 'Nenhum envio pendente' });
    }

    // 2. Para cada envio pendente, buscar config WhatsApp e enviar
    const campaignCounters: Record<string, { sent: number; failed: number }> = {};

    for (const send of pendingSends) {
      const campaign = send.campaigns as any;
      const professional = campaign?.professionals as any;
      const professionalId = campaign?.professional_id;
      const userId = professional?.user_id;
      const message = (campaign?.message ?? '').replace('{nome}', send.name ?? '');

      if (!professionalId || !userId || !send.phone) {
        await supabase.from('campaign_sends')
          .update({ status: 'failed', error: 'Dados de campanha incompletos', sent_at: new Date().toISOString() })
          .eq('id', send.id);
        failed++;
        if (!campaignCounters[send.campaign_id]) campaignCounters[send.campaign_id] = { sent: 0, failed: 0 };
        campaignCounters[send.campaign_id].failed++;
        continue;
      }

      // Buscar config WhatsApp ativa para este profissional
      const { data: wc } = await supabase
        .from('whatsapp_config')
        .select('provider, phone_number_id, access_token, evolution_api_url, evolution_api_key, evolution_instance')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!wc) {
        await supabase.from('campaign_sends')
          .update({ status: 'failed', error: 'Sem config WhatsApp ativa', sent_at: new Date().toISOString() })
          .eq('id', send.id);
        failed++;
        if (!campaignCounters[send.campaign_id]) campaignCounters[send.campaign_id] = { sent: 0, failed: 0 };
        campaignCounters[send.campaign_id].failed++;
        continue;
      }

      try {
        if (wc.provider === 'evolution') {
          await sendEvolution(send.phone, message, wc);
        } else {
          await sendMeta(send.phone, message, wc);
        }

        await supabase.from('campaign_sends')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', send.id);

        sent++;
        if (!campaignCounters[send.campaign_id]) campaignCounters[send.campaign_id] = { sent: 0, failed: 0 };
        campaignCounters[send.campaign_id].sent++;
      } catch (sendErr: any) {
        console.error(`[campaign-cron] Erro ao enviar para ${send.phone}:`, sendErr.message);
        await supabase.from('campaign_sends')
          .update({ status: 'failed', error: sendErr.message, sent_at: new Date().toISOString() })
          .eq('id', send.id);
        failed++;
        if (!campaignCounters[send.campaign_id]) campaignCounters[send.campaign_id] = { sent: 0, failed: 0 };
        campaignCounters[send.campaign_id].failed++;
      }
    }

    // 3. Atualizar contadores das campanhas afetadas
    for (const [campaignId, counts] of Object.entries(campaignCounters)) {
      // Buscar totais atuais
      const { data: camp } = await supabase
        .from('campaigns')
        .select('sent_count, failed_count, total_count')
        .eq('id', campaignId)
        .single();

      if (!camp) continue;

      const newSent = (camp.sent_count ?? 0) + counts.sent;
      const newFailed = (camp.failed_count ?? 0) + counts.failed;
      const total = camp.total_count ?? 0;

      // Verificar se ainda há envios pendentes para esta campanha
      const { count: pendingCount } = await supabase
        .from('campaign_sends')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending');

      const newStatus = (pendingCount === 0 && total > 0) ? 'completed' : 'sending';

      await supabase
        .from('campaigns')
        .update({ sent_count: newSent, failed_count: newFailed, status: newStatus })
        .eq('id', campaignId);
    }

    return NextResponse.json({ sent, failed });
  } catch (error: any) {
    console.error('[campaign-cron] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Helpers de envio ────────────────────────────────────────────────────────

async function sendEvolution(phone: string, message: string, wc: any) {
  const normalized = phone.replace(/[^0-9]/g, '');
  const url = `${wc.evolution_api_url}/message/sendText/${wc.evolution_instance}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: wc.evolution_api_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: normalized, text: message }),
  });
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${await res.text()}`);
}

async function sendMeta(phone: string, message: string, wc: any) {
  const url = `https://graph.facebook.com/v18.0/${wc.phone_number_id}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wc.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    }),
  });
  if (!res.ok) throw new Error(`Meta ${res.status}: ${await res.text()}`);
}
