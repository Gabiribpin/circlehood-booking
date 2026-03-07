import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendBulkEmails } from '@/lib/integrations/email-marketing'
import { isRateLimited } from '@/lib/rate-limit'

const CAMPAIGN_RATE_LIMIT = 5 // max campaign sends per window
const CAMPAIGN_RATE_WINDOW = 3600 // 1 hour in seconds

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Lookup professional_id from auth user
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 })
  }

  // Rate limiting por professional_id — 5 campaigns per hour
  if (await isRateLimited(`campaign-send:${professional.id}`, CAMPAIGN_RATE_LIMIT, CAMPAIGN_RATE_WINDOW)) {
    return NextResponse.json(
      { error: 'Too many campaigns sent. Try again later.' },
      { status: 429 }
    )
  }

  // Buscar campanha
  const { data: campaign, error: campaignError } = await supabase
    .from('email_campaigns')
    .select(`
      *,
      professional:professionals(
        name,
        slug
      )
    `)
    .eq('id', id)
    .eq('professional_id', professional.id)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json(
      { error: 'Campaign not found' },
      { status: 404 }
    )
  }

  // Verificar se já foi enviada
  if (campaign.status === 'sent') {
    return NextResponse.json(
      { error: 'Campaign already sent' },
      { status: 400 }
    )
  }

  // Buscar contatos do segmento
  const { data: contacts, error: contactsError } = await supabase.rpc(
    'get_contacts_by_segment',
    {
      p_professional_id: professional.id,
      p_segment: campaign.target_segment,
      p_custom_filters: campaign.custom_filters || {}
    }
  )

  if (contactsError || !contacts || contacts.length === 0) {
    return NextResponse.json(
      { error: 'No contacts found for this segment' },
      { status: 400 }
    )
  }

  // Atualizar status para "sending"
  await supabase
    .from('email_campaigns')
    .update({ status: 'sending' })
    .eq('id', id)

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const bookingLink = `${baseUrl}/${campaign.professional.slug}`

    // Preparar destinatários com personalização
    const recipients = contacts
      .filter((c: any) => c.email && c.email.trim() !== '')
      .map((contact: any) => ({
        email: contact.email,
        name: contact.name || 'Cliente',
        personalization: {
          CLIENT_NAME: contact.name || 'Cliente',
          PROFESSIONAL_NAME: campaign.professional.name,
          BOOKING_LINK: bookingLink,
          DAYS_SINCE_VISIT: contact.last_booking_date
            ? Math.floor((Date.now() - new Date(contact.last_booking_date).getTime()) / (1000 * 60 * 60 * 24)).toString()
            : '0'
        }
      }))

    // Enviar emails em lote
    const results = await sendBulkEmails({
      fromName: campaign.from_name,
      fromEmail: campaign.from_email,
      replyTo: campaign.reply_to,
      subject: campaign.subject,
      htmlContent: campaign.html_content,
      textContent: campaign.text_content,
      recipients,
      tags: [
        { name: 'campaign_id', value: campaign.id },
        { name: 'professional_id', value: professional.id }
      ]
    })

    // Salvar destinatários individuais
    const recipientsData = results
      .filter(r => r.success && r.id)
      .map(r => ({
        campaign_id: id,
        contact_email: r.email,
        resend_message_id: r.id,
        sent_at: new Date().toISOString()
      }))

    if (recipientsData.length > 0) {
      await supabase
        .from('email_campaign_recipients')
        .insert(recipientsData)
    }

    // Atualizar estatísticas da campanha
    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    await supabase
      .from('email_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        total_sent: successCount,
        total_recipients: recipients.length
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      total: recipients.length
    })
  } catch (error: any) {
    logger.error('Error sending campaign:', error)

    // Reverter status para draft
    await supabase
      .from('email_campaigns')
      .update({ status: 'failed' })
      .eq('id', id)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
