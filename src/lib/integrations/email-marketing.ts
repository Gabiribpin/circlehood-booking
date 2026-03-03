import { logger } from '@/lib/logger';
/**
 * Email Marketing Library
 * Gerencia campanhas de email via Resend
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailRecipient {
  email: string
  name: string
  personalization?: Record<string, string>
}

export interface EmailCampaign {
  fromName: string
  fromEmail: string
  replyTo?: string
  subject: string
  htmlContent: string
  textContent?: string
  recipients: EmailRecipient[]
  tags?: { name: string; value: string }[]
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  description: string
  htmlContent: string
  variables: string[]
}

/**
 * Templates de email pré-prontos
 */
export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  promotion: {
    id: 'promotion',
    name: 'Promoção Especial',
    subject: '🎉 Promoção Especial: {{SERVICE_NAME}} por €{{PRICE}}',
    description: 'Template para divulgar promoções de serviços',
    variables: ['CLIENT_NAME', 'SERVICE_NAME', 'PRICE', 'BOOKING_LINK', 'PROFESSIONAL_NAME'],
    htmlContent: `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promoção Especial</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Promoção Especial!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333; margin: 0 0 20px;">Olá, <strong>{{CLIENT_NAME}}</strong>!</p>

              <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 30px;">
                Temos uma promoção especial preparada especialmente para você! Não perca essa oportunidade incrível.
              </p>

              <!-- Promo Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 30px; margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <h2 style="color: white; margin: 0 0 15px; font-size: 24px;">{{SERVICE_NAME}}</h2>
                    <p style="color: rgba(255,255,255,0.9); margin: 0 0 20px; font-size: 18px;">Valor especial:</p>
                    <p style="color: white; margin: 0 0 30px; font-size: 36px; font-weight: bold;">€{{PRICE}}</p>
                    <a href="{{BOOKING_LINK}}" style="display: inline-block; background: white; color: #667eea; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Agendar Agora
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #999; margin: 0; text-align: center;">
                Vagas limitadas! Aproveite enquanto dá tempo.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #666;">
                {{PROFESSIONAL_NAME}}<br>
                CircleHood Booking
              </p>
              <p style="margin: 0; font-size: 12px; color: #999;">
                Você está recebendo este email porque agendou serviços conosco anteriormente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  },

  follow_up: {
    id: 'follow_up',
    name: 'Follow-up de Clientes Inativos',
    subject: 'Sentimos sua falta, {{CLIENT_NAME}}! 💜',
    description: 'Template para reengajar clientes que não visitam há tempo',
    variables: ['CLIENT_NAME', 'DAYS_SINCE_VISIT', 'BOOKING_LINK', 'PROFESSIONAL_NAME'],
    htmlContent: `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sentimos sua falta</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <h1 style="font-size: 32px; margin: 0 0 20px;">💜</h1>
              <h2 style="color: #667eea; margin: 0 0 20px; font-size: 24px;">Olá, {{CLIENT_NAME}}!</h2>

              <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 20px;">
                Faz <strong>{{DAYS_SINCE_VISIT}} dias</strong> que não te vemos por aqui e sentimos muito a sua falta!
              </p>

              <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 30px;">
                Estamos com novidades e adoraríamos ter você de volta. Que tal agendar um horário?
              </p>

              <a href="{{BOOKING_LINK}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Agendar Horário
              </a>

              <p style="font-size: 14px; color: #999; margin: 30px 0 0;">
                Com carinho,<br>
                <strong>{{PROFESSIONAL_NAME}}</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  },

  newsletter: {
    id: 'newsletter',
    name: 'Newsletter Mensal',
    subject: '📰 Novidades de {{MONTH}}: {{PROFESSIONAL_NAME}}',
    description: 'Template para newsletter mensal com novidades',
    variables: ['CLIENT_NAME', 'MONTH', 'NEWS_CONTENT', 'BOOKING_LINK', 'PROFESSIONAL_NAME'],
    htmlContent: `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📰 Novidades de {{MONTH}}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333; margin: 0 0 20px;">Olá, <strong>{{CLIENT_NAME}}</strong>!</p>

              <div style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 30px;">
                {{NEWS_CONTENT}}
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                <tr>
                  <td align="center">
                    <a href="{{BOOKING_LINK}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Agendar Horário
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                {{PROFESSIONAL_NAME}} | CircleHood Booking
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  }
}

/**
 * Substituir variáveis no template
 */
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, value || '')
  })

  return result
}

/**
 * Enviar email individual
 */
export async function sendEmail(params: {
  from: string
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
}) {
  try {
    const result = await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      tags: params.tags
    })

    return { success: true, id: result.data?.id }
  } catch (error: any) {
    logger.error('Error sending email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar campanha em lote (batch de 100)
 */
export async function sendBulkEmails(campaign: EmailCampaign) {
  const results = []
  const BATCH_SIZE = 100

  for (let i = 0; i < campaign.recipients.length; i += BATCH_SIZE) {
    const batch = campaign.recipients.slice(i, i + BATCH_SIZE)

    for (const recipient of batch) {
      const personalizedSubject = replaceVariables(campaign.subject, recipient.personalization || {})
      const personalizedHtml = replaceVariables(campaign.htmlContent, recipient.personalization || {})
      const personalizedText = campaign.textContent
        ? replaceVariables(campaign.textContent, recipient.personalization || {})
        : undefined

      const result = await sendEmail({
        from: `${campaign.fromName} <${campaign.fromEmail}>`,
        to: recipient.email,
        subject: personalizedSubject,
        html: personalizedHtml,
        text: personalizedText,
        replyTo: campaign.replyTo,
        tags: campaign.tags
      })

      results.push({
        email: recipient.email,
        ...result
      })

      // Rate limiting: aguardar 100ms entre emails
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

/**
 * Obter template com variáveis substituídas
 */
export function renderTemplate(
  templateId: string,
  variables: Record<string, string>
): { subject: string; html: string } {
  const template = EMAIL_TEMPLATES[templateId]

  if (!template) {
    throw new Error(`Template ${templateId} não encontrado`)
  }

  return {
    subject: replaceVariables(template.subject, variables),
    html: replaceVariables(template.htmlContent, variables)
  }
}

/**
 * Validar endereço de email
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

/**
 * Obter estatísticas de uma campanha (via Resend API)
 */
export async function getCampaignStats(messageIds: string[]) {
  // Resend não fornece analytics direto via API
  // As estatísticas são atualizadas via webhooks
  // Esta função é um placeholder para futuras implementações
  return {
    total: messageIds.length,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0
  }
}
