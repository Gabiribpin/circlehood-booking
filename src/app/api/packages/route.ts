import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Listar pacotes
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const professionalId = searchParams.get('professionalId');

  try {
    let query = supabase
      .from('service_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (professionalId) {
      query = query.eq('professional_id', professionalId);
    }

    const { data: packages, error } = await query;

    if (error) throw error;

    return NextResponse.json({ packages: packages || [] });
  } catch (error: any) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Criar pacote (Professional only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, service_ids, package_price } = body;

  try {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    // Buscar serviços para calcular preço original e duração
    const { data: services } = await supabase
      .from('services')
      .select('price, duration_minutes')
      .in('id', service_ids);

    if (!services || services.length !== service_ids.length) {
      return NextResponse.json({ error: 'Alguns serviços não foram encontrados' }, { status: 400 });
    }

    const original_price = services.reduce((sum, s) => sum + Number(s.price), 0);
    const duration_minutes = services.reduce((sum, s) => sum + s.duration_minutes, 0);

    if (package_price >= original_price) {
      return NextResponse.json(
        { error: 'Preço do pacote deve ser menor que a soma dos serviços' },
        { status: 400 }
      );
    }

    const { data: packageData, error: insertError } = await supabase
      .from('service_packages')
      .insert({
        professional_id: professional.id,
        name,
        description,
        service_ids,
        original_price,
        package_price,
        duration_minutes,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      package: packageData,
    });
  } catch (error: any) {
    console.error('Error creating package:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
