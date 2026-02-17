import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSubscriptionOrder } from '@/lib/integrations/revolut'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Buscar dados do profissional
  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .select('name, email')
    .eq('id', user.id)
    .single()

  if (profError || !professional) {
    return NextResponse.json(
      { error: 'Professional not found' },
      { status: 404 }
    )
  }

  const apiKey = process.env.REVOLUT_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Revolut integration not configured' },
      { status: 500 }
    )
  }

  try {
    // Criar ordem de assinatura
    const order = await createSubscriptionOrder(
      user.id,
      professional.email,
      professional.name,
      apiKey
    )

    // Salvar no banco
    const { data: payment, error: paymentError } = await supabase
      .from('revolut_payments')
      .insert({
        professional_id: user.id,
        revolut_order_id: order.id,
        merchant_order_ref: order.merchantOrderExtRef,
        amount: 9.99,
        currency: 'EUR',
        description: 'CircleHood Booking - Assinatura Mensal',
        customer_email: professional.email,
        customer_name: professional.name,
        checkout_url: order.checkoutUrl,
        status: 'pending',
        metadata: {
          plan: 'monthly',
          created_via: 'api'
        }
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error saving payment:', paymentError)
      return NextResponse.json(
        { error: 'Order created but failed to save to database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      payment,
      checkoutUrl: order.checkoutUrl,
      orderId: order.id
    })
  } catch (error: any) {
    console.error('Revolut API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create Revolut order' },
      { status: 500 }
    )
  }
}
