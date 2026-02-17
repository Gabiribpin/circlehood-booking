import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
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

    const { data: cards, error } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('professional_id', professional.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ cards: cards || [] });
  } catch (error: any) {
    console.error('Error fetching loyalty cards:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
