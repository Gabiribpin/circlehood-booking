import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, business_name, deleted_at')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    if (!professional.deleted_at) {
      return NextResponse.json(
        { error: 'No pending deletion found' },
        { status: 400 }
      );
    }

    // Cancel the deletion
    await supabase
      .from('professionals')
      .update({
        deleted_at: null,
        deletion_scheduled_for: null,
        is_active: true,
      })
      .eq('id', professional.id);

    // Send confirmation email
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@circlehood-tech.com';

      await resend.emails.send({
        from: fromEmail,
        to: user.email!,
        subject: 'Exclusão cancelada — CircleHood Booking',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; color: #111;">
            <h2>Exclusão cancelada com sucesso</h2>
            <p>Olá, ${professional.business_name}!</p>
            <p>Sua solicitação de exclusão foi cancelada. Sua conta está ativa novamente e sua página pública foi reativada.</p>
            <p>Se você não fez esta solicitação, entre em contato conosco imediatamente em <a href="mailto:privacy@circlehood-tech.com">privacy@circlehood-tech.com</a>.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="font-size: 0.8em; color: #888;">CircleHood Tech — Dublin, Ireland<br/>privacy@circlehood-tech.com</p>
          </div>
        `,
      });
    } catch (emailError) {
      logger.error('[cancel-deletion] Email failed:', emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('[cancel-deletion] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
