/**
 * Revolut Payments Library
 * Gerencia pagamentos via Revolut Merchant API
 */

const REVOLUT_API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://merchant.revolut.com/api/1.0'
  : 'https://sandbox-merchant.revolut.com/api/1.0'

export interface RevolutConfig {
  apiKey: string
  webhookSecret: string
}

export interface CreateOrderParams {
  amount: number // em centavos (ex: 999 = €9.99)
  currency: string // 'EUR', 'GBP', 'USD'
  merchantOrderRef: string // Referência única interna
  description: string
  customerEmail?: string
  customerName?: string
  successUrl?: string
  cancelUrl?: string
  metadata?: Record<string, any>
}

export interface RevolutOrder {
  id: string
  publicId: string
  type: string
  state: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  merchantOrderExtRef: string
  orderAmount: {
    value: number
    currency: string
  }
  orderOutstandingAmount: {
    value: number
    currency: string
  }
  checkoutUrl: string
  email?: string
  phone?: string
  payments?: RevolutPayment[]
}

export interface RevolutPayment {
  id: string
  state: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  amount: {
    value: number
    currency: string
  }
  paymentMethod: {
    type: string
  }
}

export interface WebhookEvent {
  event: string
  timestamp: string
  order: RevolutOrder
}

/**
 * Criar uma ordem de pagamento
 */
export async function createOrder(
  params: CreateOrderParams,
  apiKey: string
): Promise<RevolutOrder> {
  const response = await fetch(`${REVOLUT_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      merchant_order_ext_ref: params.merchantOrderRef,
      description: params.description,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Revolut API error: ${error.message || 'Unknown error'}`)
  }

  const data = await response.json()

  return {
    id: data.id,
    publicId: data.public_id,
    type: data.type,
    state: data.state,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
    merchantOrderExtRef: data.merchant_order_ext_ref,
    orderAmount: data.order_amount,
    orderOutstandingAmount: data.order_outstanding_amount,
    checkoutUrl: data.checkout_url,
    email: data.email,
    phone: data.phone,
    payments: data.payments
  }
}

/**
 * Obter detalhes de uma ordem
 */
export async function getOrder(orderId: string, apiKey: string): Promise<RevolutOrder> {
  const response = await fetch(`${REVOLUT_API_BASE}/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Revolut API error: ${error.message || 'Unknown error'}`)
  }

  const data = await response.json()

  return {
    id: data.id,
    publicId: data.public_id,
    type: data.type,
    state: data.state,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
    merchantOrderExtRef: data.merchant_order_ext_ref,
    orderAmount: data.order_amount,
    orderOutstandingAmount: data.order_outstanding_amount,
    checkoutUrl: data.checkout_url,
    email: data.email,
    phone: data.phone,
    payments: data.payments
  }
}

/**
 * Cancelar uma ordem
 */
export async function cancelOrder(orderId: string, apiKey: string): Promise<RevolutOrder> {
  const response = await fetch(`${REVOLUT_API_BASE}/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Revolut API error: ${error.message || 'Unknown error'}`)
  }

  return await response.json()
}

/**
 * Fazer refund de uma ordem
 */
export async function refundOrder(
  orderId: string,
  amount: number | null, // null = refund total
  apiKey: string
): Promise<any> {
  const body: any = {}

  if (amount !== null) {
    body.amount = amount
  }

  const response = await fetch(`${REVOLUT_API_BASE}/orders/${orderId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Revolut API error: ${error.message || 'Unknown error'}`)
  }

  return await response.json()
}

/**
 * Listar todas as ordens
 */
export async function listOrders(
  apiKey: string,
  options?: {
    limit?: number
    createdBefore?: string
    state?: string[]
  }
): Promise<RevolutOrder[]> {
  const params = new URLSearchParams()

  if (options?.limit) {
    params.append('limit', options.limit.toString())
  }

  if (options?.createdBefore) {
    params.append('created_before', options.createdBefore)
  }

  if (options?.state && options.state.length > 0) {
    options.state.forEach(s => params.append('state', s))
  }

  const url = `${REVOLUT_API_BASE}/orders${params.toString() ? '?' + params.toString() : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Revolut API error: ${error.message || 'Unknown error'}`)
  }

  return await response.json()
}

/**
 * Verificar assinatura do webhook
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  const crypto = require('crypto')

  const hmac = crypto.createHmac('sha256', webhookSecret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')

  return signature === expectedSignature
}

/**
 * Processar evento de webhook
 */
export function parseWebhookEvent(payload: string): WebhookEvent {
  const event = JSON.parse(payload)

  return {
    event: event.event,
    timestamp: event.timestamp,
    order: {
      id: event.order.id,
      publicId: event.order.public_id,
      type: event.order.type,
      state: event.order.state,
      createdAt: event.order.created_at,
      updatedAt: event.order.updated_at,
      completedAt: event.order.completed_at,
      merchantOrderExtRef: event.order.merchant_order_ext_ref,
      orderAmount: event.order.order_amount,
      orderOutstandingAmount: event.order.order_outstanding_amount,
      checkoutUrl: event.order.checkout_url,
      email: event.order.email,
      phone: event.order.phone,
      payments: event.order.payments
    }
  }
}

/**
 * Estados possíveis de uma ordem
 */
export enum OrderState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AUTHORISED = 'AUTHORISED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  REVERTED = 'REVERTED'
}

/**
 * Eventos de webhook
 */
export enum WebhookEventType {
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_AUTHORISED = 'ORDER_AUTHORISED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_PAYMENT_DECLINED = 'ORDER_PAYMENT_DECLINED',
  ORDER_PAYMENT_FAILED = 'ORDER_PAYMENT_FAILED'
}

/**
 * Criar subscription de assinatura mensal
 */
export async function createSubscriptionOrder(
  professionalId: string,
  email: string,
  name: string,
  apiKey: string
): Promise<RevolutOrder> {
  const merchantOrderRef = `circlehood_subscription_${professionalId}_${Date.now()}`

  return await createOrder(
    {
      amount: 999, // €9.99
      currency: 'EUR',
      merchantOrderRef,
      description: 'CircleHood Booking - Assinatura Mensal',
      customerEmail: email,
      customerName: name,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?payment=success&provider=revolut`,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?payment=cancelled`,
      metadata: {
        professionalId,
        type: 'subscription',
        plan: 'monthly'
      }
    },
    apiKey
  )
}

/**
 * Formatar valor em centavos para EUR
 */
export function formatAmount(cents: number, currency: string = 'EUR'): string {
  const value = cents / 100

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency
  }).format(value)
}

/**
 * Comparar taxas Stripe vs Revolut
 */
export function compareProviderFees(amount: number) {
  const stripeFee = (amount * 0.014) + 0.25 // 1.4% + €0.25
  const revolutFee = (amount * 0.012) + 0.20 // 1.2% + €0.20

  return {
    stripe: {
      fee: stripeFee,
      net: amount - stripeFee,
      percentage: (stripeFee / amount) * 100
    },
    revolut: {
      fee: revolutFee,
      net: amount - revolutFee,
      percentage: (revolutFee / amount) * 100
    },
    savings: stripeFee - revolutFee
  }
}
