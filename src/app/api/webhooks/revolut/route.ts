import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, parseWebhookEvent, OrderState } from '@/lib/integrations/revolut'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const signature = request.headers.get('Revolut-Signature')
  const body = await request.text()

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 401 }
    )
  }

  const webhookSecret = process.env.REVOLUT_WEBHOOK_SECRET!

  if (!webhookSecret) {
    console.error('REVOLUT_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    )
  }

  // Verificar assinatura
  const isValid = verifyWebhookSignature(body, signature, webhookSecret)

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  try {
    const event = parseWebhookEvent(body)

    console.log('Revolut webhook event:', event.event, event.order.id)

    // Buscar pagamento no banco
    const { data: payment, error: paymentError } = await supabase
      .from('revolut_payments')
      .select('*, professional:professionals(*)')
      .eq('revolut_order_id', event.order.id)
      .single()

    if (paymentError || !payment) {
      console.error('Payment not found:', event.order.id)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Atualizar webhook events history
    const webhookEvents = Array.isArray(payment.webhook_events)
      ? payment.webhook_events
      : []
    webhookEvents.push({
      event: event.event,
      timestamp: event.timestamp,
      state: event.order.state
    })

    // Atualizar status do pagamento
    const updates: any = {
      status: event.order.state.toLowerCase(),
      webhook_events: webhookEvents,
      updated_at: new Date().toISOString()
    }

    if (event.order.state === OrderState.AUTHORISED) {
      updates.authorised_at = new Date().toISOString()
    }

    if (event.order.state === OrderState.COMPLETED) {
      updates.completed_at = new Date().toISOString()
    }

    if (event.order.state === OrderState.CANCELLED || event.order.state === OrderState.FAILED) {
      updates.cancelled_at = new Date().toISOString()
    }

    await supabase
      .from('revolut_payments')
      .update(updates)
      .eq('id', payment.id)

    // Ativar assinatura quando pagamento completar
    if (event.order.state === OrderState.COMPLETED) {
      await supabase
        .from('professionals')
        .update({
          subscription_status: 'active',
          subscription_provider: 'revolut',
          subscription_current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000 // +30 dias
          ).toISOString()
        })
        .eq('id', payment.professional_id)

      console.log('Subscription activated for professional:', payment.professional_id)
    }

    // Cancelar assinatura se pagamento falhar
    if (event.order.state === OrderState.FAILED || event.order.state === OrderState.CANCELLED) {
      await supabase
        .from('professionals')
        .update({
          subscription_status: 'cancelled',
          subscription_cancelled_at: new Date().toISOString()
        })
        .eq('id', payment.professional_id)

      console.log('Subscription cancelled for professional:', payment.professional_id)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Error processing Revolut webhook:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
