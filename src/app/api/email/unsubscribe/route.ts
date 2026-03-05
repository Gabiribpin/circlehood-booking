import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TOKEN_REGEX = /^[a-f0-9]{64}$/;

function htmlResponse(status: number, body: string): NextResponse {
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function processUnsubscribe(token: string) {
  const supabase = createAdminClient();

  const { data: professional, error } = await supabase
    .from('professionals')
    .select('id, business_name, marketing_emails_opted_out')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (error || !professional) {
    return { success: false as const };
  }

  if (!professional.marketing_emails_opted_out) {
    await supabase
      .from('professionals')
      .update({
        marketing_emails_opted_out: true,
        marketing_opted_out_at: new Date().toISOString(),
      })
      .eq('id', professional.id);
  }

  return { success: true as const, businessName: professional.business_name };
}

/**
 * GET /api/email/unsubscribe?token=<64-char-hex>
 * Renders an HTML confirmation page and marks the professional as opted-out.
 */
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';

    if (!TOKEN_REGEX.test(token)) {
      return htmlResponse(
        400,
        page('Token inválido', '<p>O link de cancelamento é inválido ou expirou.</p>')
      );
    }

    const result = await processUnsubscribe(token);

    if (!result.success) {
      return htmlResponse(
        400,
        page('Token inválido', '<p>O link de cancelamento é inválido ou expirou.</p>')
      );
    }

    return htmlResponse(
      200,
      page(
        'Inscrição cancelada',
        `<p>Pronto! Você não receberá mais emails de marketing do CircleHood Booking.</p>
         <p style="color:#666;font-size:14px;">Emails transacionais (confirmações de agendamento, conta, etc.) continuarão sendo enviados normalmente.</p>`
      )
    );
  } catch (err) {
    logger.error('[email/unsubscribe] GET', err);
    return htmlResponse(500, page('Erro', '<p>Ocorreu um erro ao processar sua solicitação.</p>'));
  }
}

/**
 * POST /api/email/unsubscribe?token=<64-char-hex>
 * RFC 8058 one-click unsubscribe (used by email clients).
 */
export async function POST(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const result = await processUnsubscribe(token);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[email/unsubscribe] POST', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function page(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — CircleHood Booking</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px; color: #111; }
    h1 { font-size: 1.5em; }
    p { line-height: 1.6; }
    .footer { margin-top: 40px; font-size: 0.8em; color: #888; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${content}
  <p class="footer">CircleHood Tech — Dublin, Ireland</p>
</body>
</html>`;
}
