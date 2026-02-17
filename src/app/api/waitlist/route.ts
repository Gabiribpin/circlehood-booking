import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Listar waitlist (Professional only)
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    const { data: waitlist, error } = await supabase
      .from('waitlist')
      .select(
        `
        *,
        services (name, price)
      `
      )
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ waitlist });
  } catch (error: any) {
    console.error('Error fetching waitlist:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Adicionar na waitlist (Public)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const {
    professional_id,
    service_id,
    contact_name,
    contact_phone,
    contact_email,
    preferred_dates,
    preferred_time_slots,
    notes,
  } = body;

  try {
    // Validações
    if (!professional_id || !service_id || !contact_name || !contact_phone) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    if (!preferred_dates || preferred_dates.length === 0) {
      return NextResponse.json({ error: 'Selecione pelo menos uma data preferida' }, { status: 400 });
    }

    // Inserir na waitlist
    const { data: waitlistEntry, error: insertError } = await supabase
      .from('waitlist')
      .insert({
        professional_id,
        service_id,
        contact_name,
        contact_phone,
        contact_email,
        preferred_dates,
        preferred_time_slots: preferred_time_slots || [],
        notes,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: 'Você foi adicionado à lista de espera!',
      waitlist: waitlistEntry,
    });
  } catch (error: any) {
    console.error('Error adding to waitlist:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remover da waitlist
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('waitlist')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('professional_id', professional.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Removido da waitlist' });
  } catch (error: any) {
    console.error('Error removing from waitlist:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
