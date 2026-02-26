/**
 * DELETE /api/test/cleanup-professional/[id]
 *
 * Remove um profissional criado para testes E2E (usuário + dados associados).
 * Bloqueado em produção.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ENVS = ['test', 'development'];

function serviceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!ALLOWED_ENVS.includes(process.env.NODE_ENV ?? '')) {
    return NextResponse.json({ error: 'Not available in this environment' }, { status: 403 });
  }

  const { id: professionalId } = await params;
  const supabase = serviceRoleClient();

  try {
    // Buscar user_id antes de deletar
    const { data: professional } = await supabase
      .from('professionals')
      .select('user_id')
      .eq('id', professionalId)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    // Deletar dados associados (ordem importa por FKs)
    await supabase.from('payments').delete().eq('professional_id', professionalId);
    await supabase.from('bookings').delete().eq('professional_id', professionalId);
    await supabase.from('services').delete().eq('professional_id', professionalId);
    await supabase.from('working_hours').delete().eq('professional_id', professionalId);
    await supabase.from('stripe_connect_accounts').delete().eq('professional_id', professionalId);
    await supabase.from('professionals').delete().eq('id', professionalId);

    // Deletar utilizador Supabase Auth
    await supabase.auth.admin.deleteUser(professional.user_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[test/cleanup-professional]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
