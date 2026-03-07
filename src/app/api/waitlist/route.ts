import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { isRateLimited } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const waitlistSchema = z.object({
  professional_id: z.string().uuid(),
  service_id: z.string().uuid(),
  contact_name: z.string().min(1).max(200),
  contact_phone: z.string().min(1).max(30),
  contact_email: z.string().email().max(254).optional().nullable(),
  preferred_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  preferred_time_slots: z.array(z.string().max(20)).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

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
    logger.error('Error fetching waitlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Adicionar na waitlist (Public)
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await isRateLimited(`waitlist:${ip}`, 5, 60)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = await createClient();
  const body = await request.json();

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }

  const {
    professional_id,
    service_id,
    contact_name,
    contact_phone,
    contact_email,
    preferred_dates,
    preferred_time_slots,
    notes,
  } = parsed.data;

  try {

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
    logger.error('Error adding to waitlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    logger.error('Error removing from waitlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
