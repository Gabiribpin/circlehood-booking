import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET - Listar campanhas de email
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('email_campaigns')
    .select('*')
    .eq('professional_id', user.id)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: campaigns, error } = await query

  if (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaigns })
}

// POST - Criar nova campanha de email
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    subject,
    fromName,
    fromEmail,
    replyTo,
    targetSegment,
    customFilters,
    templateType,
    htmlContent,
    textContent,
    scheduledFor
  } = body

  // Validar campos obrigatórios
  if (!name || !subject || !fromName || !fromEmail || !htmlContent) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(fromEmail)) {
    return NextResponse.json(
      { error: 'Invalid from_email address' },
      { status: 400 }
    )
  }

  // Calcular total de destinatários (simulado)
  const { data: contactsCount } = await supabase.rpc(
    'get_contacts_by_segment',
    {
      p_professional_id: user.id,
      p_segment: targetSegment || 'all',
      p_custom_filters: customFilters || {}
    }
  )

  const totalRecipients = contactsCount?.length || 0

  // Criar campanha
  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .insert({
      professional_id: user.id,
      name,
      subject,
      from_name: fromName,
      from_email: fromEmail,
      reply_to: replyTo,
      target_segment: targetSegment || 'all',
      custom_filters: customFilters || {},
      template_type: templateType || 'custom',
      html_content: htmlContent,
      text_content: textContent,
      scheduled_for: scheduledFor,
      total_recipients: totalRecipients,
      status: scheduledFor ? 'scheduled' : 'draft'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaign }, { status: 201 })
}
