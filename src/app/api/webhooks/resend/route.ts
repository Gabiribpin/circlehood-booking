import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const body = await request.json()

  console.log('Resend webhook event:', body.type)

  try {
    const { type, data } = body

    // Extrair campaign_id das tags
    const campaignTag = data.tags?.find((t: any) => t.name === 'campaign_id')
    const campaignId = campaignTag?.value

    if (!campaignId) {
      console.warn('No campaign_id in webhook tags')
      return NextResponse.json({ received: true })
    }

    // Buscar destinatário individual
    const { data: recipient } = await supabase
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('contact_email', data.to)
      .single()

    // Atualizar estatísticas do destinatário individual
    if (recipient) {
      const updates: any = {}

      switch (type) {
        case 'email.delivered':
          updates.delivered_at = data.created_at
          break
        case 'email.opened':
          updates.opened_at = data.created_at
          break
        case 'email.clicked':
          updates.clicked_at = data.created_at
          break
        case 'email.bounced':
          updates.bounced_at = data.created_at
          break
        case 'email.complained':
          updates.complained_at = data.created_at
          break
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('email_campaign_recipients')
          .update(updates)
          .eq('id', recipient.id)
      }
    }

    // Incrementar contadores da campanha
    const eventFieldMap: Record<string, string> = {
      'email.delivered': 'total_delivered',
      'email.opened': 'total_opened',
      'email.clicked': 'total_clicked',
      'email.bounced': 'total_bounced',
      'email.complained': 'total_complained'
    }
    const incrementField = eventFieldMap[type]

    if (incrementField) {
      // Buscar campanha atual
      const { data: campaign } = await supabase
        .from('email_campaigns')
        .select(incrementField)
        .eq('id', campaignId)
        .single()

      if (campaign) {
        const currentValue = (campaign as any)[incrementField] || 0

        await supabase
          .from('email_campaigns')
          .update({
            [incrementField]: currentValue + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Error processing Resend webhook:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
