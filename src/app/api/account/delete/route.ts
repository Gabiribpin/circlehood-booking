import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const CONFIRMATION_WORDS: Record<string, string> = {
  'pt-BR': 'EXCLUIR',
  'en-US': 'DELETE',
  'es-ES': 'ELIMINAR',
};

export async function POST(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { confirmation, locale } = await request.json();

    const expectedWord = CONFIRMATION_WORDS[locale as string] ?? CONFIRMATION_WORDS['pt-BR'];
    if (!confirmation || confirmation.trim().toUpperCase() !== expectedWord) {
      return NextResponse.json(
        { error: `Type "${expectedWord}" to confirm deletion` },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, business_name, stripe_customer_id, email')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Mark for deletion and deactivate public page
    await supabase
      .from('professionals')
      .update({
        deleted_at: new Date().toISOString(),
        deletion_scheduled_for: deletionDate.toISOString(),
        is_active: false,
      })
      .eq('id', professional.id);

    // Cancel Stripe subscription IMMEDIATELY (not at period end) to avoid future charges.
    // Queries both 'active' and 'trialing' to catch trial-to-paid conversions.
    if (professional.stripe_customer_id) {
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2026-01-28.clover',
        });
        // No status filter → returns active + trialing + past_due (all non-cancelled)
        const subscriptions = await stripe.subscriptions.list({
          customer: professional.stripe_customer_id,
          limit: 5,
        });
        for (const sub of subscriptions.data) {
          if (sub.status !== 'canceled') {
            // Immediate cancellation — no further charges
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (stripeError) {
        console.error('[account-delete] Stripe cancellation failed:', stripeError);
        // Non-fatal — continue with deletion
      }
    }

    // Send confirmation email
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@circlehood-tech.com';
      const formattedDate = deletionDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      await resend.emails.send({
        from: fromEmail,
        to: user.email!,
        subject: 'Sua conta será excluída — CircleHood Booking',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; color: #111;">
            <h2>Solicitação de exclusão recebida</h2>
            <p>Olá, ${professional.business_name}.</p>
            <p>Recebemos sua solicitação de exclusão de conta. Seus dados serão permanentemente removidos em:</p>
            <p style="font-size: 1.2em; font-weight: bold; color: #e53e3e;">${formattedDate}</p>
            <p>Se você mudar de ideia, faça login antes dessa data e cancele a exclusão nas Configurações.</p>
            <p>Até lá, sua página pública foi desativada.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="font-size: 0.8em; color: #888;">CircleHood Tech — Dublin, Ireland<br/>privacy@circlehood-tech.com</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('[account-delete] Email failed:', emailError);
      // Non-fatal
    }

    // Sign out the user
    await serverSupabase.auth.signOut();

    return NextResponse.json({
      success: true,
      deletionDate: deletionDate.toISOString(),
    });
  } catch (error: any) {
    console.error('[account-delete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
