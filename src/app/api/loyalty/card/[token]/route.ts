import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  try {
    // Buscar cartão de fidelidade
    const { data: card, error: cardError } = await supabase
      .from('loyalty_cards')
      .select(
        `
        *,
        professionals (
          business_name,
          slug,
          profile_image_url
        )
      `
      )
      .eq('card_token', token)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    }

    // Buscar transações recentes
    const { data: transactions } = await supabase
      .from('loyalty_transactions')
      .select(
        `
        *,
        bookings (
          booking_date,
          services (name)
        )
      `
      )
      .eq('loyalty_card_id', card.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      card: {
        ...card,
        next_reward_in: 10 - card.current_stamps,
        progress_percent: (card.current_stamps / 10) * 100,
      },
      transactions: transactions || [],
    });
  } catch (error: any) {
    console.error('Error fetching loyalty card:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
